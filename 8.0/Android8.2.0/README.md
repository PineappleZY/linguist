# Linguist 8.2.0 Android APK

此目录把 `8.0/dist/linguist_8.2.0.html` 原样装入 Android WebView 外壳，并生成可侧载安装的通用 APK。

| 项目 | 值 |
| --- | --- |
| 包名 | `app.linguist.dictionary` |
| 版本 | `8.2.0`（versionCode `8200`） |
| 最低系统 | Android 6.0（API 23） |
| 目标系统 | Android 14（API 34） |
| 架构 | 通用，无原生 ABI |
| APK | `dist/Linguist-8.2.0.apk` |

## 安装与升级

1. 将 `dist/Linguist-8.2.0.apk` 发送到 Android 手机。
2. 点击 APK；如系统提示，允许当前文件管理器安装未知应用。
3. 已安装 6.5.0 APK 时可直接覆盖升级，本地历史、收藏和设置会保留。
4. 8.2.0 仍需要联网和用户自己的 DeepSeek API Key。

APK 与本项目此前的 Android 版本使用同一签名证书，因此支持覆盖升级。签名材料和编译工具沿用 `6.0/android/` 中已验证的文件，最终 APK 与校验值保存在本目录。

## 重新构建

在项目根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File ".\8.0\Android8.2.0\build.ps1"
```

构建脚本会重新复制 8.2.0 单文件、编译原生壳、对齐并使用原 Android 签名密钥签名。
