# Connectors & Credentials

本插件的 skill（`xiaohongshu-cover` / `xiaohongshu-prohibited-word` / `xiaohongshu-rewrite` / `xiaohongshu-title-score` / `xiaohongshu-write`）使用红狐数据 API。

---

## 需要的凭据

| 环境变量 | 用途 | 是否必需 | 获取地址 |
| --- | --- | --- | --- |
| `REDFOX_API_KEY` | 调用红狐数据 API 时经 `X-API-Key` 请求头传入 | 是 | <https://redfox.hk/settings/api-keys?source=qoder> |

---

## 配置方式

### 方案 A：写入 shell 配置文件（推荐）

在 `~/.zshrc` 或 `~/.bash_profile` 中添加：

```bash
export REDFOX_API_KEY="ak_xxxx..."
```

保存后执行 `source ~/.zshrc`，重启 Qoder 即可生效。

### 方案 B：临时会话

```bash
export REDFOX_API_KEY="ak_xxxx..."
```

仅对当前 shell 生效。

---

## 网络要求

| 项 | 值 |
| --- | --- |
| 目标域名 | `redfox.hk` |
| 协议 | HTTPS |
| 超时 | 10-30 秒 |

---

## 常见问题

**Q：如何获取 API Key？**
A：访问 <https://redfox.hk/settings/api-keys?source=qoder> 注册并获取。

**Q：API Key 收费吗？**
A：新用户注册获赠免费积分，部分接口免费不扣积分。
