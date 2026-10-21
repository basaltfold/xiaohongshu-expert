/**
 * 小红书专家 — Host 半区。
 *
 * 把 assets/ 下 11 个小红书技能注册进 DSH 技能注册表。
 * 技能源文件是 Qoder 市场的原始 SKILL.md（未改写），本插件只做三件事：
 *   1. 读 SKILL.md 的 YAML frontmatter 取 name / description；
 *   2. 以 directory 形态的 resourceBase 暴露整个技能目录（scripts/ references/ assets/ 原样可读）；
 *   3. 在技能正文末尾追加「运行时说明」——本机 Python 绝对路径、REDFOX_API_KEY。
 *
 * 不 import 任何 @deepseek-ai/* 包，避免 profile 侧模块解析失败。
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 插件在 Cordis 里的身份。 */
export const name = 'xiaohongshu-expert';

/** 依赖的技能注册表服务。 */
export const inject = ['skills'];

/** 与 dsh-skill 的 BUNDLED_SKILL_RANK 同值；不 import 该包。 */
const BUNDLED_SKILL_RANK = 600;

/** 技能名 = assets 下的目录名，11 个，扁平。 */
const SKILL_NAMES = [
  'xiaohongshu-cover',
  'xiaohongshu-crawler',
  'xiaohongshu-dailytop',
  'xiaohongshu-lowtop',
  'xiaohongshu-prohibited-word',
  'xiaohongshu-rewrite',
  'xiaohongshu-search',
  'xiaohongshu-similar-account',
  'xiaohongshu-title-score',
  'xiaohongshu-top-account',
  'xiaohongshu-write',
];

/** 候选 Python 解释器（按序取第一个存在的）。 */
function resolvePython(configured) {
  if (typeof configured === 'string' && configured.length > 0) return configured;
  if (typeof process.env.XHS_PYTHON === 'string' && process.env.XHS_PYTHON.length > 0) {
    return process.env.XHS_PYTHON;
  }
  const home = process.env.USERPROFILE ?? process.env.HOME ?? '';
  const candidates = [
    join(home, '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python', 'python.exe'),
    join(home, '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python', 'bin', 'python3'),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* 下一个候选 */
    }
  }
  return 'python';
}

/** 逐个技能解析 frontmatter（只确认有 description，不做业务校验）。 */
function parseSkill(raw, path) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw);
  if (frontmatter === null) throw new Error(`xiaohongshu-expert: ${path} 缺少 YAML frontmatter`);
  const block = frontmatter[1];
  const match = /^description:\s*(.*)$/mu.exec(block);
  if (match === null || match[1].trim().length === 0) {
    throw new Error(`xiaohongshu-expert: ${path} 缺少 description`);
  }
  let description = match[1].trim();
  if (
    (description.startsWith('"') && description.endsWith('"')) ||
    (description.startsWith("'") && description.endsWith("'"))
  ) {
    description = description.slice(1, -1);
  }
  return { description, content: raw.slice(frontmatter[0].length).trim() };
}

/** 追加到每个技能正文末尾的运行时事实。 */
function runtimeBlock(python) {
  return `

## 运行时（本机已就绪）

下面这些是本机实测可用的绝对路径与环境要求。执行本技能的 \`scripts/*.py\` 时一律用下面的解释器，
不要用系统 \`python\` / \`python3\`（本机 PATH 上是 Microsoft Store 存根，会直接失败）。

\`\`\`json
{
  "python": ${JSON.stringify(python)},
  "packages": ["requests", "beautifulsoup4", "python-docx", "playwright"],
  "apiKeyEnv": "REDFOX_API_KEY",
  "upstreamHost": "redfox.hk"
}
\`\`\`

- 调用形态：\`"<上面的 python 路径>" scripts/xxx.py --help\`（路径含空格或中文时务必加引号）。
- 所有数据接口走 \`https://redfox.hk\`，需要 \`REDFOX_API_KEY\`，通过 HTTP 头 \`X-API-Key\` 传递。
  Key 在 https://redfox.hk/settings/api-keys?source=qoder 申请。未配置 Key 时，涉及
  \`redfox.hk\` 的命令会返回鉴权错误——这属于预期，不要伪造数据，直接告诉用户去申请 Key。
- 纯本地能力（违禁词检测、文案改写规则、标题评分、笔记生成的结构化输出）不依赖 Key，可直接跑。

## 网络与浏览器增强能力（本机可用）

需要抓取小红书页面 / 渲染 SPA / 处理登录态时，不要自己拼 urllib，直接用本工作区已有的浏览器能力：
- 技能 \`browser-automation\`（Playwright / OpenReverse 统一入口）
- 技能 \`browser-skill\`（已登录 Chromium 的 bsk_* 工具）
- 技能 \`multi-search-engine\`（多引擎检索）

爬取类技能（crawler / search / dailytop / lowtop / top-account / similar-account）在上游接口
不可用时，可改用上述浏览器能力在同一频道内取数，但必须在输出里注明数据来源与获取方式。`;
}

/**
 * 注册 11 个小红书技能。
 * @param ctx Cordis 上下文，需带 skills 服务。
 * @param config 可选 { assetRoot, python }。
 */
export function apply(ctx, config = {}) {
  const assetRoot = config.assetRoot ?? fileURLToPath(new URL('../assets/', import.meta.url));
  if (!existsSync(assetRoot)) throw new Error(`xiaohongshu-expert: 资产目录不存在: ${assetRoot}`);
  const python = resolvePython(config.python);

  const candidates = SKILL_NAMES.map((skillName) => {
    const directory = join(assetRoot, skillName);
    const path = join(directory, 'SKILL.md');
    const { description } = parseSkill(readFileSync(path, 'utf8'), path);
    return {
      name: skillName,
      description,
      invocation: { modelInvocable: true, userInvocable: true },
      provider: 'dsh-xiaohongshu-expert',
      source: 'bundled',
      rank: BUNDLED_SKILL_RANK,
      resourceBase: { kind: 'directory', path: directory.split(sep).join('/') },
      locator: path,
    };
  });

  const provider = {
    name: 'dsh-xiaohongshu-expert',
    list: () => Promise.resolve(candidates),
    async get(candidate, options) {
      const { rank: _rank, locator, ...summary } = candidate;
      const raw = await readFile(locator, { encoding: 'utf8', signal: options.signal });
      return { ...summary, content: parseSkill(raw, locator).content + runtimeBlock(python) };
    },
  };

  ctx.skills.registerProvider(() => provider);
}
