# Linguist 6.5 — Windows 落地

这个目录只放桌面端外壳与产物；6.5 的网页源码仍在 `../6.0/`，不改动。

```
落地/
├── windows/                      Electron 工程
│   ├── main.js                   主进程（linguist://app 协议、单实例、外链）
│   ├── scripts/prepare.mjs       冻结 6.5 离线包并记录 SHA-256
│   ├── app/linguist_6.5.0.html   从 6.0/dist 复制的离线包
│   ├── build/icon.ico            Windows 多尺寸图标
│   └── dist/                     打包产物
└── README.md
```

## 产物

| 文件 | 说明 |
| --- | --- |
| `windows/dist/Linguist-6.5.0-portable.exe` | 免安装单文件，双击即用 |
| `windows/dist/win-unpacked/Linguist.exe` | 解包版，启动更快，可整个目录拷走 |

## 重新打包

```powershell
cd 落地/windows
npm install
node scripts/prepare.mjs
npm run dist
```

首次构建会下载 Electron、NSIS 与 winCodeSign；官方源不可用时可用
`ELECTRON_MIRROR` 与 `ELECTRON_BUILDER_BINARIES_MIRROR` 指向 npmmirror。

## 运行与数据

- 窗口通过 `linguist://app/index.html` 加载离线包。这个来源是固定的，所以
  即使 portable exe 每次解压到不同临时目录，历史、星标与设置仍会保留。
- 用户数据在 `%APPDATA%\Linguist`；删除 exe 不会自动删除这些数据。
- 网页版与桌面版存储彼此独立。需要迁移时，在网页版 Profile → 导出 JSON 备份，
  再到桌面版 Profile → 导入备份。
- 外部链接（例如 platform.deepseek.com）用系统浏览器打开，不在应用内导航。
- API Key 不随程序分发，首次使用需在 Profile 里自行填写。

## 已知限制

- 未做代码签名，Windows 第一次运行可能出现 SmartScreen 提示；选择
  「更多信息 → 仍要运行」即可。
- portable 单文件每次启动要先解包到 `%TEMP%\Linguist-6.5.0`，首次约十几秒；
  频繁使用可直接运行 `win-unpacked/Linguist.exe`，启动更快。
- 只构建 Windows x64；不含 ARM64、安装器或自动更新。

## 构建结果

构建日期：2026-10-17。Electron 44.9.0 / electron-builder 26.15.3，Windows x64。

| 产物 | 大小 | SHA-256 |
| --- | --- | --- |
| `windows/dist/Linguist-6.5.0-portable.exe` | 100,794,713 B（约 96.1 MiB） | `c74489950f6bb90e258d3d3912cd675f232e49fb472a415c1bab8396413a068d` |
| `windows/dist/win-unpacked/Linguist.exe` | 247,184,896 B | `03155a9855beb11768dd791a5f17ce05bd014f483226c7a49cd14a79450c6f93` |

冻结的离线包 `app/linguist_6.5.0.html` 为 2,190,324 B，SHA-256
`2bdf8dde677b3e29d8ae1e6d7f37f54ccdfb1099b732212e3a0d19ca6b77ca30`，
与 `6.0/dist/linguist_6.5.0.html` 完全一致。

验收记录：

- 网页基线：`node 6.0/web/tests/smoke.js` → 765 passed, 0 failed。
- 开发态 `npm run smoke` 连续两次通过，第二次读到第一次写入的 localStorage 标记。
- `dist/win-unpacked/Linguist.exe --smoke-test`：exit 0，`packaged: true`，版本 6.5.0。
- `Linguist-6.5.0-portable.exe --smoke-test` 连续两次通过：第二次的 `previous`
  等于第一次的 `current`，证明 portable 每次解包到临时目录也不会丢数据。
- `--smoke-clean` 已清除自检标记，退出码 0。

`dist/SHA256SUMS.txt` 记录了两个 exe 的校验和，可直接用于分发核对。
