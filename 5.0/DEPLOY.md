# 把 Radicle 分享出去的三种方式

打包产物统一由 `node tools/build.mjs` 生成。每次发布前**先提升 `web/sw.js` 里的 `CACHE_VERSION`**，否则已安装的用户会继续用缓存里的旧外壳。

| 产物 | 说明 |
| --- | --- |
| `dist/site/` | 可部署的 PWA 文件夹，上传这个目录的**内容** |
| `dist/radicle-site.zip` | 同上，打成 zip，`index.html` 在压缩包根目录 |
| `dist/radicle-offline.html` | 单文件自包含版，双击即用 |

三条路的共同验收标准见文末。

---

## 路线 A：买域名 + 绑定 EdgeOne（大陆受众体验最好）

1. 任意注册商买一个域名（年费通常几十元）。
2. EdgeOne Makers 控制台 → 左侧 **Domains** → **Add custom domain**。
3. 填域名，按提示到注册商处添加平台给出的 DNS 记录（一般是 CNAME）。
4. 选择节点区域：
   - **大陆节点**：需要 ICP 备案。个人主体可备案，需要身份证，整体约 1–3 周。
   - **境外节点**：不需要备案，但大陆访问会明显变慢。
5. HTTPS：自定义域名绑定后，平台可申请免费证书（Domains 列表里的 `HTTPS configuration` 列届时才可配置）。
6. 部署产物：Build & Deploy → 上传 `dist/radicle-site.zip`。

> 注意：项目自带的 `radicle.edgeone.dev` 是**预览域**，即使状态显示 `Effective`，对外访问也一律返回 401，只能用带 `eo_token` 的短时效签名链接自己看。它不能用来分享。

---

## 路线 B：换一家给免费子域名的托管（最快拿到可分享链接）

不需要买域名，也不需要备案，几分钟出结果。代价是大陆访问不稳定。

**Cloudflare Pages**

1. 控制台 → Workers & Pages → Create → Pages → Upload assets。
2. 项目名随意，上传 `dist/radicle-site.zip`（或 `dist/site/` 的内容）。
3. 部署后得到 `https://<项目名>.pages.dev`。

**Netlify**

1. 打开 <https://app.netlify.com/drop>。
2. 把 `dist/site` 文件夹直接拖进去。
3. 得到 `https://<随机名>.netlify.app`；登录后可改名与长期保留。

**Vercel**

1. `npx vercel deploy --prod dist/site`（需要先登录）。
2. 得到 `https://<项目名>.vercel.app`。

三家都不需要重写规则：应用全部走 hash 路由，任意路径都会落到 `index.html`。

---

## 路线 C：只发离线单文件（零成本、零等待）

把 `dist/radicle-offline.html`（约 117 KB）直接发给需要的人，对方双击就能用。

- 已经内联全部样式与 9 个模块，剥离了 Service Worker 注册（`file://` 没有安全上下文，注册必然失败）。
- 没有安装入口、没有离线外壳缓存，但查词、历史、收藏、导入导出全部可用。
- 适合"发给几个朋友"，不适合公开传播。

---

## 共同验收清单

不论走哪条路，拿到公开地址后按顺序确认：

1. 打开地址能看到搜索框与底部 Dictionary / Profile，**不是 404、也不是目录列表**。
2. 进 Profile 填 DeepSeek Key，回 Dictionary 查一个词能出结果——这一步同时验证了 HTTPS 与跨域。
3. DevTools → Application → Cache Storage：应该只有静态资源，**不该出现任何 `api.deepseek.com` 条目**。
4. 地址栏出现安装图标，或 Profile → Account 出现 Install 按钮；装完能在独立窗口启动，图标是蓝底白 R。
5. 断网重开：外壳能打开（Service Worker 生效），查词给的是网络错误提示而不是白屏。
6. 手机开一次；iOS 走"分享 → 添加到主屏幕"，确认图标与名称。

## 预期管理

分享链接**不会**共享数据：每个人的 API Key、历史、收藏都只在自己设备上，互相看不见。每个使用者都需要自己去 DeepSeek 注册并充值一个 Key。PWA 安装后**只有应用外壳能离线打开**，查词始终需要联网。
