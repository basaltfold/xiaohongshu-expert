# 小红书专家 (xiaohongshu-expert)

把 Qoder 上三个小红书插件的全部能力，去重整合成 **一个 DeepSeek Harness 宿主插件**：
11 个技能、16 个可执行脚本，装好后自动出现在 DSH 技能目录里。

---

## 装了什么

去重后 **11 个技能**（原三个插件共 16 个技能，5 个重名已合并）：

| 技能 | 干什么 | 来源 | 需要 Key |
|---|---|---|---|
| `xiaohongshu-write` | 一站式笔记生成，基于 2000+/日爆款数据 | redfox-xhs-creator | 是 |
| `xiaohongshu-cover` | 爆款封面方案设计 | redfox-xhs-creator | 是 |
| `xiaohongshu-title-score` | 10 个爆款标题生成 + 六维评分 | redfox-xhs-creator | 是 |
| `xiaohongshu-prohibited-word` | 违禁词检测 + 上下文替换建议 + 改写稿 | 三插件同名，取 redfox 版 | 云端检测要，本地规则不要 |
| `xiaohongshu-rewrite` | 文案改写成小红书风格 | 三插件同名，取 redfox 版 | 是 |
| `xiaohongshu-crawler` | 关键词爬作品，日期/排序筛选 | xiaohongshu-content-inspiration | 是 |
| `xiaohongshu-search` | 热门笔记搜索 + 评分排序 | xiaohongshu-content-inspiration | 是 |
| `xiaohongshu-dailytop` | 各赛道当日爆款榜 | xiaohongshu-content-inspiration | 是 |
| `xiaohongshu-lowtop` | 低粉爆款榜（粉丝<5000、互动>500） | xiaohongshu-content-inspiration | 是 |
| `xiaohongshu-top-account` | 账号日/周/月榜 TOP50 | xiaohongshu-content-inspiration | 是 |
| `xiaohongshu-similar-account` | 对标账号匹配（同阶可复制 + 高阶标杆） | xiaohongshu-content-inspiration | 是 |

**5 个重名技能取的是 `redfox-xhs-creator` 版本**：它的 `scripts/` 更完整，且带 `assets/`。
`xiaohongshu-viral-content-master` 版唯一的不同是数据文件用了中文名
（`AI工具_爆款数据.md` / `小红书运营_爆款数据.md`），内容与 redfox 版的
`ai_tools_hot_data.md` / `xhs_operation_hot_data.md` **逐行一致**（仅 CRLF/LF 差异），
所以只保留 redfox 版一份，没有数据丢失。

---

## 装法

```powershell
cd C:\AI\插件1021\xiaohongshu-expert
.\install.ps1          # 建立 junction + 写 dependencies + 写 bundles
```

然后**重启 DeepSeek Harness**。重启后技能目录里会出现 11 个 `xiaohongshu-*`。

`install.ps1` 干的三件事：

1. 在 `~/.dsh/profiles/desktop/node_modules/` 下建目录联接指向本仓库（改代码即时生效，不用重装）
2. `profile/package.json` 的 `dependencies` 加 `"xiaohongshu-expert": "file:C:/AI/插件1021/xiaohongshu-expert"`
3. 同文件 `dsh.profile.bundles` 数组末尾追加 `"xiaohongshu-expert"`

三处改动前都会备份成 `*.xhsbak-<时间戳>`。

卸载：

```powershell
.\uninstall.ps1                        # 移除三处改动 + 删 junction
.\uninstall.ps1 -Restore 20261021-101809   # 或直接还原某次备份
```

---

## Python 运行时（重要）

本机 PATH 上的 `python` / `python3` 是 **Microsoft Store 重定向存根**，跑任何脚本都会直接 exit 49。
不要用它。

插件里的 16 个 `.py` 脚本一律走 DSH 自带的真 Python（3.12.14，已装好 requests / bs4 / python-docx / playwright）：

```
C:\Users\11781\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe
```

这个路径已经写进每个技能的正文末尾「运行时（本机已就绪）」区块，模型加载技能时会读到，
不会再去误用系统 python。调用形态：

```powershell
& "C:\Users\11781\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" scripts\check_sensitive_words.py --content "..."
```

脚本输出中文，需 `PYTHONIOENCODING=utf-8`，否则控制台是乱码（不影响 JSON 本身）。

---

## 红狐 API Key

所有数据接口走 `https://redfox.hk`，Key 通过 HTTP 头 `X-API-Key` 传，环境变量名 `REDFOX_API_KEY`（格式 `ak_xxxxxxxx`）。

申请：<https://redfox.hk/settings/api-keys?source=qoder>（新用户赠免费积分）

```powershell
# 当前会话
$env:REDFOX_API_KEY = "ak_xxxxxxxx"
# 永久（用户级）
[Environment]::SetEnvironmentVariable("REDFOX_API_KEY", "ak_xxxxxxxx", "User")
```

脚本按优先级找 Key：环境变量 → `~/.zshrc` `~/.bashrc` `~/.bash_profile` `~/.profile` `~/.zprofile` → 提示配置。
**未配置时不会伪造数据**，脚本返回明确的鉴权错误 JSON，技能正文要求模型如实转述、不编结果。

不需要 Key 的能力：违禁词本地规则检测、文案改写规则、标题评分算法、笔记结构化输出。

---

## 结构

```
xiaohongshu-expert/
├── package.json          # DSH 插件清单，dsh.bundle.patch 指向 cordis.patch.yml
├── cordis.patch.yml      # bundle 层：insert 宿主插件
├── lib/index.js          # 宿主逻辑（154 行）：注册 11 个技能的 provider
├── assets/
│   ├── _brand-logo.png
│   └── skills/<11 个技能>/{SKILL.md, README.md, README.en.md, scripts/, references/, assets/}
├── locale/{zh,en}.json
├── CONNECTORS.md         # 凭据说明
├── install.ps1 / uninstall.ps1
└── scripts/selftest.mjs  # 不依赖 DSH 进程的自检
```

`lib/index.js` 用 DSH 的 `ctx.skills.registerProvider()` 注册一个 provider，
`list()` 返回 11 个候选、`get()` 读 `assets/skills/<name>/SKILL.md` 并追加运行时区块后返回。
`resourceBase` 指向技能自己的目录，所以 `references/`、`scripts/` 里的相对路径能正常解析。

---

## 自检

不启动 DSH 也能验：

```powershell
node scripts/selftest.mjs
```

覆盖：插件名 / inject / apply 是否注册 provider / 技能数 11 / 名字唯一 / description 与 content 非空 /
运行时区块已注入 / python 路径真实存在 / resourceBase 是真实目录 / 元数据可 JSON 序列化。

当前结果：**PASS — 6/6**。

---

## 与上游的差异

- **去重**：16 → 11。5 个重名技能取 redfox 版。master 版唯一的差异是数据文件用了中文名
  （`AI工具_爆款数据.md` / `小红书运营_爆款数据.md`），与 redfox 版的 `ai_tools_hot_data.md` /
  `xhs_operation_hot_data.md` 逐行一致（仅 CRLF/LF 差异），因此没有数据丢失。
- **改路径**：所有 `python` 调用改为 DSH 自带解释器绝对路径。
- **保留上游的一个冗余**：`xiaohongshu-similar-account/scripts/` 下有 `xiaohongshu-similar-account.py`
  和 `xiaohongshu_account_recommender.py`，两者 md5 完全相同（`a4b6c267...`），是上游自己复制出来的同一份。
  `SKILL.md` 只引用 `xiaohongshu_account_recommender.py`，那个文件存在，调用没有问题，
  所以没有删——保持与上游一致，避免以后对比时对不上。
- **加全局运行时块**：11 个技能正文末尾统一追加「运行时（本机已就绪）」+「网络与浏览器增强能力」两段，
  说明 python 路径、Key 位置、无 Key 时的正确行为、以及抓取类技能可回退到
  `browser-automation` / `browser-skill`。

---

## 已知边界

- 上游 API 是红狐数据（第三方付费服务）。**插件本身不绕过它**，没 Key 就没有云端数据。
  想完全脱钩，得把 6 个爬取类技能的取数改成 `browser-skill`（走你自己登录的 Chromium），
  这属于二次开发，不是当前插件的默认行为。
- `xiaohongshu-search` 和 `xiaohongshu-write` 的上游 SKILL.md 明确要求「仅在主 Agent 中执行，
  不派发给子 Agent」——这是上游的并发/限流约束，保留原样。
- PDF 不支持（违禁词检测只吃 TXT/DOC/DOCX/图片/URL）。

---

## 许可

GPL-3.0，见 [LICENSE](LICENSE)。

注意：本仓库的 11 个技能来自 Qoder 插件市场的三个上游插件
（`redfox-xhs-creator`、`xiaohongshu-content-inspiration`、`xiaohongshu-viral-content-master`），
上游未声明许可。这里是按 GPL-3.0 发布本仓库的整合与适配代码；
如果你要商用或再分发其中上游内容，请自行确认上游条款。

