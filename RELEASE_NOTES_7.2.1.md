# Linguist 7.2.1

本次为网页版修复更新，重点修正 Roots 词根复习主流程。

## 修复

- 修复复习范围开关失效。
- 一轮复习固定为最多 5 个词根 × 3 个阶段，进度不再错位。
- 没有同根词时自动跳过对应阶段，不生成空题。
- 词条与 Roots 之间的词根链接在状态变化后立即刷新。
- 解释语言版本切换只显示当前版本组。
- 掌握度与复习统计去重，避免重复累计。
- 补充复习状态的无障碍文本、词池预热提示和文档一致性。

## 交付物

| 文件 | 说明 |
| --- | --- |
| `linguist_7.2.1.html` | 单文件自包含网页版 |
| `Linguist-7.2.1-web.zip` | 可部署的 PWA 网站文件 |
| `Linguist-7.2.1-SHA256SUMS.txt` | 两个网页产物的 SHA-256 |

在线版本：https://pineapplezy.github.io/linguist/

## 平台状态

- Web / PWA / HarmonyOS NEXT：**7.2.1**
- Android APK：仍为 **6.5.0**
- Windows EXE：仍为 **6.5.0**

本版没有生成 Android 或 Windows 7.2.1 安装包。原生包链接固定指向 `v6.5.0`。

## 验证

`node 7.0/web/tests/smoke.js`：800 passed，0 failed。
