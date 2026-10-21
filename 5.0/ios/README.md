# 在 iPhone 上打开 Radicle 5.0

5.0 本来就是一个纯静态网页（hash 路由、无后端、自带 Key），所以「做成能在 iOS 里打开的东西」
真正缺的不是移植，而是**把它送到手机上**：iPhone 没有办法像电脑那样双击一个本地文件就跑起来。
这一层做两件事——把 5.0 补成手机上真的能用的样子，再给一条把它送到手机上的路。

## 最短路径

```powershell
cd D:\codex_work\智能辞典微信小程序开发\5.0
node ios/build-ios.mjs        # 产出 dist/ios-site/（可部署）与 dist/radicle_5.0.0.ios.html
node ios/serve.mjs            # 起局域网服务器，终端会打印地址和一个二维码
```

然后：**iPhone 连上和这台电脑同一个 Wi-Fi，用相机扫终端里的二维码**，Safari 打开即用。
进去后先到 **Profile** 填自己的 DeepSeek Key，再回 Dictionary 查词。

Key、历史、收藏都只存在那台手机自己的 Safari 里，不上传、不同步，电脑上看不到手机上的数据。

## 三条路，先看该走哪条

| 路线 | 拿到什么 | 代价 / 边界 |
| --- | --- | --- |
| **A 局域网**（`node ios/serve.mjs`） | 手机当下就能打开的地址 | 必须同一个 Wi-Fi；电脑要开着、服务器要跑着；地址里是内网 IP，重启路由器可能变；纯 http 下 **Service Worker 不注册**，所以只有"能打开"，没有"离线外壳" |
| **B 上传静态托管**（把 `dist/ios-site/` 传上去） | 一个永久 HTTPS 地址 | 需要有个账号（EdgeOne / Cloudflare Pages / Netlify Drop 都行，免费）；换来的是：任何网络下都能开、可以添加到主屏、离线外壳生效 |
| **C 单文件 `dist/radicle_5.0.0.ios.html`** | 一个文件，发给别人双击就用 | **iPhone 上基本用不了**：Safari 打不开 `file://`，文件 App 的预览也不执行脚本。这条只适合电脑和安卓——iPhone 请走 A 或 B |

## 路线 A：局域网（最快，不需要任何账号）

1. 电脑和 iPhone 连同一个 Wi-Fi（不要一个是 Wi-Fi、一个是手机热点）。
2. 在 `5.0` 目录里跑 `node ios/serve.mjs`。终端会打印：
   - 每个网卡对应的地址，推荐的那个后面标 `<-`；
   - 一个二维码（扫码用 iPhone 相机，不用装任何扫码 App）；
   - 同一个地址的纯文本，手输也行。
3. 手机打开后，Profile → 填 Key → Dictionary 查词。

常用参数：

```powershell
node ios/serve.mjs --port 8080        # 换端口
node ios/serve.mjs --dir web          # 直接服务未打包的源码，用来和 dist/ios-site 对照
node ios/serve.mjs --verbose          # 连每个静态资源都打日志
node ios/serve.mjs --no-qr            # 不要二维码
node ios/serve.mjs --open             # 顺手在这台电脑的浏览器里打开
```

### 打不开的话，按这个顺序查

1. **看服务器的日志**：终端里只有你请求时才出现 `200 ... 10.141.x.x` 这样的行。
   有行 = 手机已经连上了电脑，问题在页面；一行都没有 = 根本没连上，继续往下看。
2. **防火墙**（最常见）。以**管理员**身份开一次 PowerShell，放行这个端口：

   ```powershell
   New-NetFirewallRule -DisplayName "Radicle 5.0 LAN (TCP 5173)" `
     -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -Profile Private
   ```

   该网络是否被 Windows 归成 `Private`（公用网络默认更严）可以在「设置 → 网络和 Internet →
   WLAN → 当前网络」里看。
3. **地址选错了**：这台机器上有 `alijiasu`（代理网卡，`198.18.x.x`）和 WLAN 两块网卡。
   脚本按 `192.168.x → 10.x → 172.16–31.x` 排序，并且把 `198.18/198.19`、`169.254`、
   名字里带 virtual / vmware / vethernet / tun / tap 的都压到最后，但如果你还有别的虚拟网卡，
   手输标语里 `<-` 之外的那一条试试。
4. **网络本身隔离了客户端**（公司 Wi-Fi、酒店 Wi-Fi 常见）：同一网段但互相不可见，
   浏览器会一直转圈直到超时。这种情况直接用**手机热点**给电脑联网最快，或者改走路线 B。

## 路线 B：上传到静态托管（想要一个永久地址、想装到主屏）

产物是 `dist/ios-site/`（白名单内容，不含测试与文档），全是静态文件，应用走 hash 路由，
**不需要任何重写或 404 规则**。

- **Netlify Drop**：打开 <https://app.netlify.com/drop>，把 `dist/ios-site` 文件夹拖进去。
- **Cloudflare Pages**：Workers & Pages → Create → Pages → Upload assets → 传 `dist/ios-site/`。
- **EdgeOne Pages**（腾讯，大陆可达性最好）：Build & Deploy 上传该文件夹内容即可。

拿到 HTTPS 地址后：iPhone 上打开 → 分享 → **添加到主屏幕**，得到一个全屏、带图标的应用。
上了 HTTPS 之后 Service Worker 才会注册（`sw.js` 的 `CACHE_VERSION` 已经被这一层改成
`v5.0.0-ios`，和普通 5.0 的缓存互不覆盖）。

> 每次改完重新部署前记得让 `CACHE_VERSION` 再变一次，否则已安装的用户会一直用缓存里的旧外壳——
> 这里没有服务端失效机制。

## 这一层到底改了什么

冻结的 `web/` **一个字都没有动**。iOS 层是两个文件，在构建时插到 `app.css` / `app.js` 之后：

| 文件 | 修的是什么 | 不修会怎样 |
| --- | --- | --- |
| `overlay/ios.css` §1 | 输入框字号钉在 16px，`-webkit-text-size-adjust: 100%` | 聚焦搜索框 / 历史搜索 / Key 输入框时，Safari 会把整个页面放大；横屏还会自动放大正文 |
| `overlay/ios.css` §2 | `html { touch-action: manipulation }` | 连点两下（比如连点卡片标题想收起分组）会触发页面缩放；触屏点击也要多等 300ms |
| `overlay/ios.css` §3 | 触屏设备上把 `:hover` 的底色还原 | iOS 点过的按钮会一直留着"悬停"底色，直到点别处——语言选择器最明显 |
| `overlay/ios.css` §4 | 底部动作面板：`touch-action: pan-y` 只留给面板、`none` 只留给拖拽手柄；列表高度按 `dvh` 算 | 面板整个是 `touch-action: none`，里面的语言列表根本没法滚；横屏时面板比屏幕还高，最下面几项点不到 |
| `overlay/ios.css` §5 | 横屏时给左右加上 `env(safe-area-inset-left/right)` | 刘海屏横屏时内容压进圆角和传感器区域 |
| `overlay/ios.css` §6 + `overlay/ios.js` | 用 `visualViewport` 量出键盘高度，写成 `--keyboard-inset`，练习层底部让出这段空间 | iOS 弹键盘不会缩小布局视口，"对/下一个"这两个按钮被键盘挡住——而它们正是这一屏的出口 |

`overlay/ios.js` 只做上面这一件事（外加旋转时的复位），其余行为都交给 5.0 自己的代码。

## 已经验证过的

自动化能覆盖的都在这里，结论按"证据"列：

| 验证 | 结果 |
| --- | --- |
| `node ios/build-ios.mjs` 自带断言 | 17 项全过：覆盖样式确实插在 `app.css` 之后、脚本确实在最后、Service Worker 预缓存清单里有这两个文件、缓存版本号已改写、单文件版没有任何外部引用且带得动图标 |
| `node ios/test/qr.test.mjs` | 27 项全过。二维码**另外**用独立解码器 jsQR（多数扫码 App 的底层库）交叉验证：14 个 URL × 3 种像素尺度全部解回原文 |
| iPhone 14 Pro / iPhone SE / 两种横屏 / iPad mini 四种视口，无头 Chrome 实测 | Dictionary、Profile、Starred 三个页面横向溢出都是 **0px**；7 步新手引导每一步的卡片都完整在屏内 |
| 底部动作面板 | 修前 SE 横屏：面板顶部 −12px、`touch-action: none`、列表不可滚；修后：顶部 +57px、列表按 195px 限高可滚，首尾两项都点得到 |
| 手机宽度的词条页版式 | 用项目自带的 `tools/preview.mjs` 五个样例面板（英语词条、法语七时态、德语四格表、收藏夹、查词页）在 393×852 下实测，横向溢出全部 0px |
| 真的走一遍手机的网络路径 | 在 `http://10.141.235.23:5173` 这个手机可达地址下真发了一次 DeepSeek 查询：跨域通过、词条页正常渲染（说明 DeepSeek 会回显任意 Origin，纯 http 的局域网地址也能查词） |

### 只能在真机上确认的两件事

1. **键盘避让**（`--keyboard-inset`）按 iOS 的 `visualViewport` 行为写的，无头浏览器里没有真实键盘，
   所以只能到手机上验：进词条 → 点 `prac` → 输一个词，看底部"对/下一个"是否浮在键盘上方。
2. **局域网可达性**：同一 Wi-Fi 能否互通取决于路由器和 Windows 防火墙，这两件都在你手上。

## 目录

```
5.0/
├── web/                      冻结的 5.0 源码（这一层不修改它）
├── ios/
│   ├── overlay/ios.css       iOS 覆盖样式（构建时插入）
│   ├── overlay/ios.js        iOS 行为层（键盘避让）
│   ├── qrcode.mjs            自写的二维码编码器，无依赖
│   ├── serve.mjs             局域网服务器：打印地址 + 终端二维码
│   ├── build-ios.mjs         产出 dist/ios-site/ 与单文件版，带自检
│   └── test/qr.test.mjs      二维码回归测试
└── dist/
    ├── ios-site/             可部署的 iOS 版（也用于局域网服务器）
    └── radicle_5.0.0.ios.html  单文件版（电脑 / 安卓用；iPhone 用不上）
```

`dist/` 里的东西全是产物，删掉任何一个都不会丢源码：`node ios/build-ios.mjs` 随时重建。
想回报 upstream 的话，`overlay/` 里两个文件可以直接并进 `web/assets/app.css` 与
`web/js/`——它们本来就是按"能被搬走"的方式写的。
