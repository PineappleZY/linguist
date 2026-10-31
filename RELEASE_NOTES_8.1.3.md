# Linguist 8.1.3

本次为网页版更新，完善默认释义、限定目标语言的翻译和个人词根地图。

## 更新

- 练习中缺失的默认解释语言释义会自动补全。
- 句子翻译明确锁定目标语言，避免输出语言漂移。
- My Map 以主页面卡片和轻量关系展示个人词根网络。
- Context 来源持久化到词根关系，保留句子与文件的回流线索。
- 查询与翻译入口的提示去重。
- 延续星标同步、同根词查询和解释缓存闭环。

## 交付物

| 文件 | 说明 |
| --- | --- |
| `linguist_8.1.3.html` | 单文件自包含网页版 |
| `Linguist-8.1.3-web.zip` | 可部署的 PWA 网站文件 |
| `Linguist-8.1.3-SHA256SUMS.txt` | 网页产物 SHA-256 |

在线版本：https://pineapplezy.github.io/linguist/

## 平台状态

- Web / PWA / HarmonyOS NEXT：**8.1.3**
- Android APK：仍为 **6.5.0**
- Windows EXE：仍为 **6.5.0**

本版没有生成 Android 或 Windows 8.1.3 安装包。原生包链接固定指向 `v6.5.0`。

## 验证

`node 8.0/web/tests/smoke.js`：806 passed，0 failed。
