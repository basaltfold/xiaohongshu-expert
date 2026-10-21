#!/usr/bin/env node
/*
 * 小红书专家 (xiaohongshu-expert) — 自检脚本
 * Copyright (C) 2026 basaltfold
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * 自检：不依赖 DSH 进程，直接以假 ctx 加载 lib/index.js，
 * 校验 11 个技能能被 list/get、frontmatter 可解析、正文能取到、运行时块已注入。
 *
 * 用法： node scripts/selftest.mjs
 */

const root = new URL('../', import.meta.url);
const entry = new URL('./lib/index.js', root);

const mod = await import(entry.href);

const checks = [];
const fail = (msg) => checks.push(['FAIL', msg]);
const ok = (msg) => checks.push(['ok', msg]);

if (mod.name !== 'xiaohongshu-expert') fail(`插件名应为 xiaohongshu-expert，实为 ${mod.name}`);
else ok('插件名 xiaohongshu-expert');
if (!Array.isArray(mod.inject) || !mod.inject.includes('skills')) fail('inject 必须包含 skills');
else ok(`inject = ${JSON.stringify(mod.inject)}`);
if (typeof mod.apply !== 'function') fail('缺少 apply()');

let registered = null;
const ctx = {
  skills: {
    registerProvider(factory) {
      registered = factory({ signal: new AbortController().signal, invalidate() {} });
      return () => {};
    },
  },
};

mod.apply(ctx, {});
if (registered === null) fail('apply() 未调用 skills.registerProvider()');
else ok(`已注册 provider "${registered.name}"`);

const list = await registered.list();
if (list.length !== 11) fail(`技能数应为 11，实为 ${list.length}`);
else ok('技能数 11');

for (const candidate of list) {
  const skill = await registered.get(candidate, {});
  if (!skill.description || skill.description.length < 8) fail(`${skill.name} description 过短`);
  if (!skill.content || skill.content.length < 50) fail(`${skill.name} content 过短（${skill.content?.length}）`);
  if (!skill.content.includes('REDFOX_API_KEY')) fail(`${skill.name} 未注入运行时块`);
  if (!skill.content.includes('## 运行时（本机已就绪）')) fail(`${skill.name} 运行时块标题缺失`);
  if (skill.provider !== 'dsh-xiaohongshu-expert') fail(`${skill.name} provider 不符: ${skill.provider}`);
  if (skill.resourceBase?.kind !== 'directory') fail(`${skill.name} resourceBase 应为 directory`);
  if (!skill.resourceBase.path.includes('assets')) fail(`${skill.name} resourceBase 未指向 assets`);
  // resourceBase 目录必须真实存在
  const { statSync } = await import('node:fs');
  if (!statSync(skill.resourceBase.path).isDirectory()) fail(`${skill.name} resourceBase 目录不存在`);
  // 摘要字段必须是可序列化纯数据
  const summary = { ...skill };
  delete summary.content;
  JSON.stringify(summary);
}

const names = list.map((s) => s.name).sort();
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
if (dupes.length > 0) fail(`技能名重复: ${dupes.join(', ')}`);
else ok(`技能名唯一: ${names.join(', ')}`);

const pyInfo = list[0] ? await registered.get(list[0], {}) : null;
const pyMatch = pyInfo ? /"python":\s*"([^"]+)"/.exec(pyInfo.content) : null;
if (pyMatch === null) fail('运行时块里没有 python 路径');
else {
  const { existsSync } = await import('node:fs');
  const exists = existsSync(pyMatch[1]);
  // 该路径是「本机 DSH 运行时」的绝对路径，CI runner 上必然不存在。
  // 默认只作提示；设 REQUIRE_PYTHON=1 才升为硬失败（本机验收用）。
  if (exists) ok(`python 路径存在: ${pyMatch[1]}`);
  else if (process.env.REQUIRE_PYTHON === '1') fail(`python 路径不存在: ${pyMatch[1]}`);
  else console.log(`SKIP  python 路径在非本机环境不存在（CI 正常）: ${pyMatch[1]}`);
}

const failed = checks.filter(([state]) => state === 'FAIL');
for (const [state, msg] of checks) console.log(`${state === 'ok' ? ' OK ' : 'FAIL'}  ${msg}`);
console.log(`\n${failed.length === 0 ? 'PASS' : 'FAILED'} — ${checks.length - failed.length}/${checks.length}`);
process.exit(failed.length === 0 ? 0 : 1);
