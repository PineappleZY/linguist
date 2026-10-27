# Linguist 8.1.0

本次为网页版更新，重点统一 Root Atlas 的词根身份与个人地图数据。

## 更新

- 统一 `rootId`，让 Atlas、词条、版本组和个人地图共享同一词根身份。
- 新增词根级星标，星标词根直接进入个人地图。
- Personal Map 合并查询、星标、笔记与词族关系，不再互相覆盖。
- 本地维护词族成员和别名，Context-to-Root 使用同一套关系。
- 句子和文件中的上下文字根可以回流到 Atlas。
- 修复 Atlas 搜索、root version 生成与缓存刷新不一致。

## 交付物

| 文件 | 说明 |
| --- | --- |
| `linguist_8.1.0.html` | 单文件自包含网页版 |
| `Linguist-8.1.0-web.zip` | 可部署的 PWA 网站文件 |
| `Linguist-8.1.0-SHA256SUMS.txt` | 网页产物 SHA-256 |

在线版本：https://pineapplezy.github.io/linguist/

## 平台状态

- Web / PWA / HarmonyOS NEXT：**8.1.0**
- Android APK：仍为 **6.5.0**
- Windows EXE：仍为 **6.5.0**

本版没有生成 Android 或 Windows 8.1 安装包。原生包链接固定指向 `v6.5.0`。

## 验证

`node 8.0/web/tests/smoke.js`：806 passed，0 failed。
