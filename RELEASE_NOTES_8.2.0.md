# Linguist 8.2.0

本次为网页版更新，收敛 Roots 页面层级并明确词根复习范围。

## 更新

- Root Detail 隐藏重复的子视图状态栏，主页面与详情页职责更清楚。
- My Map 与 Review 只接受显式收藏的词根。
- 普通来源词的星标只作为提示，不会自动扩大复习范围。
- Personal Root Map 保留来源关系，但不会混入复习入口。
- 延续统一 rootId、星标同步、同根词查询、解释缓存和 Context 回流。
- 更新 Roots 相关本地化文案与移动端页面层级。

## 交付物

| 文件 | 说明 |
| --- | --- |
| `linguist_8.2.0.html` | 单文件自包含网页版 |
| `Linguist-8.2.0-web.zip` | 可部署的 PWA 网站文件 |
| `Linguist-8.2.0.apk` | Android 6.0+ 通用 WebView 安装包 |
| `Linguist-8.2.0-Setup.exe` | Windows x64 NSIS 安装器 |
| `Linguist-8.2.0-SHA256SUMS.txt` | 网页与 Android 产物 SHA-256 |

在线版本：https://pineapplezy.github.io/linguist/

## 平台状态

- Web / PWA / HarmonyOS NEXT：**8.2.0**
- Android APK：**8.2.0**，支持覆盖升级 6.5.0
- Windows Setup：**8.2.0**，Windows x64 安装器

Android APK 与网页共用 8.2.0 内容，包名 `app.linguist.dictionary`，versionCode `8200`。Windows 安装器约 107 MiB，未做商业代码签名，首次运行可能显示 SmartScreen 提示。

## 验证

`node 8.0/web/tests/smoke.js`：809 passed，0 failed。
