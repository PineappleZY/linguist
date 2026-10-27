# Linguist 8.0.0

本次是网页版更新，把词根学习从索引与复习扩展为可持续维护的个人知识地图。

## 新增

- **Root Atlas**：集中查看词根、别名、词族、来源、掌握状态和关联词条。
- **Personal Root Map**：把查询、个人笔记、词族操作与复习关系组织成自己的词根地图。
- **Context-to-Root**：从句子或文件的上下文找回相关词根和词族。
- **RootEntity**：词根使用稳定实体和别名，避免因拼写变体或解释语言切换而分裂。
- **个人词族整理**：添加关联、笔记和本地词族操作。
- **搜索与筛选**：按词根、别名、语言、掌握状态和个人关系筛选 Atlas。
- **兼容升级**：延续 7.x 的存储与历史，不新增 AI 自动补根。

## 交付物

| 文件 | 说明 |
| --- | --- |
| `linguist_8.0.0.html` | 单文件自包含网页版 |
| `Linguist-8.0.0-web.zip` | 可部署的 PWA 网站文件 |
| `Linguist-8.0.0-SHA256SUMS.txt` | 网页产物 SHA-256 |

在线版本：https://pineapplezy.github.io/linguist/

## 平台状态

- Web / PWA / HarmonyOS NEXT：**8.0.0**
- Android APK：仍为 **6.5.0**
- Windows EXE：仍为 **6.5.0**

本版没有生成 Android 或 Windows 8.0 安装包。原生包链接固定指向 `v6.5.0`。

## 验证

`node 8.0/web/tests/smoke.js`：804 passed，0 failed。
