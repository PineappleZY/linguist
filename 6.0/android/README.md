# Linguist Android APK

这个目录把 `6.0/dist/linguist_6.5.0.html` 原样装入一个最小 Android WebView 外壳，并生成可直接侧载安装的通用 APK。

| 项目 | 值 |
| --- | --- |
| 包名 | `app.linguist.dictionary` |
| 版本 | `6.5.0`（versionCode `6500`） |
| 最低系统 | Android 6.0（API 23） |
| 目标系统 | Android 14（API 34） |
| 架构 | 通用；无原生 ABI |
| 产物 | `dist/Linguist-6.5.0.apk` |

## 行为

- HTML、CSS、JavaScript 和 PDF 工具全部内置，正文页面无需联网即可打开。
- 模型查词仍需要网络、DeepSeek API Key 和账户余额。
- 原生壳保留 WebView 的本地存储，因此历史、收藏、设置和 API Key 会随应用保留。
- 文件分析使用 Android 系统文件选择器，不需要读取整个存储空间。
- 备份导出使用系统“保存文件”对话框，不需要存储权限。
- DeepSeek 官网等外部链接交给系统浏览器打开。
- 应用关闭 Android 自动备份，避免把 API Key 纳入系统云备份；可在应用内手动导出 JSON 备份。

## 安装

1. 把 `dist/Linguist-6.5.0.apk` 发送到 Android 手机。
2. 点击 APK；如系统提示，允许当前文件管理器“安装未知应用”。
3. 安装后从桌面打开 `Linguist`。
4. 在 Profile 中填入自己的 DeepSeek API Key。

APK 使用本项目自签名证书签名，能够正常安装，但没有 Google Play 的分发背书。以后若用同一密钥签名，可直接覆盖升级；请保留 `keystore/`，不要公开它。

## HarmonyOS / 鸿蒙

- HarmonyOS 4.x 及更早的安卓兼容版本可以侧载这个 APK。
- HarmonyOS NEXT 不直接运行 APK。请使用系统浏览器打开 Linguist 网页版，再选择“添加到桌面”。
- 当前没有原生 HarmonyOS HAP 产物。

## 重新构建

工具链和下载缓存都在本目录内：

```powershell
cd "D:\codex_work\智能辞典微信小程序开发\6.0\android"
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

构建脚本会从上游 `linguist_6.5.0.html` 重新复制页面、编译原生壳、签名 APK，并在 `dist/SHA256.txt` 写入散列。工具链位于 `toolchain/`，原始下载包位于 `.cache/`；两者均不应提交到公开仓库。
