# Linguist 8.1.2

本次为网页版更新，完善词根、星标、默认单词本和词条入口之间的同步。

## 更新

- 词条星标同步进入默认单词本，Roots 与 Starred 状态保持一致。
- Root Atlas 中的同根词可以直接打开词条查询。
- 解释语言切换优先命中默认语言的缓存结果。
- 补充更清晰的反查与句子翻译入口。
- Roots 的收藏和笔记改为图标操作，收敛重复提示。
- 延续统一 `rootId`、Personal Root Map 并集和 Context-to-Root。
- 修复清理旧结构、保存词族和词根版本生成中的兼容问题。

## 交付物

| 文件 | 说明 |
| --- | --- |
| `linguist_8.1.2.html` | 单文件自包含网页版 |
| `Linguist-8.1.2-web.zip` | 可部署的 PWA 网站文件 |
| `Linguist-8.1.2-SHA256SUMS.txt` | 网页产物 SHA-256 |

在线版本：https://pineapplezy.github.io/linguist/

## 平台状态

- Web / PWA / HarmonyOS NEXT：**8.1.2**
- Android APK：仍为 **6.5.0**
- Windows EXE：仍为 **6.5.0**

本版没有生成 Android 或 Windows 8.1.2 安装包。原生包链接固定指向 `v6.5.0`。

## 验证

`node 8.0/web/tests/smoke.js`：806 passed，0 failed。
