# FFXIV 副本标题制作器

一个完全在浏览器中运行的 FFXIV 风格副本标题制作器。支持中文与英文、透明 PNG、白底 JPG，以及用户本地载入自己合法持有的 Adobe 黑体 Std。

> 本项目是非官方粉丝工具，与 Square Enix 无关联。项目不包含或分发 Adobe 黑体 Std，也不包含游戏截图、Logo 或其他官方素材。

## 功能

- 中文默认使用开源思源黑体，英文使用 Cinzel 罗马衬线体。
- 自动识别中英文预设，也可手动指定。
- Adobe 黑体文件只在当前浏览器内存中载入，不上传、不保存。
- 实时调整字号、字距、行距、横线、金色和辉光。
- 以 1×、2× 或 4× 导出透明 PNG 与白底 JPG。
- 纯静态站点，无账号、数据库、统计或服务端请求。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开终端中显示的本地地址。生产构建和测试：

```bash
npm test
npm run build
```

构建结果位于 `dist/`。

## Adobe 黑体本地载入

Adobe 黑体 Std 不是本项目的一部分。若你合法持有对应字体，可在页面中点击“选择本地字体”，选择 OTF、TTF、WOFF 或 WOFF2 文件。字体文件不会离开浏览器，刷新页面后即失效。

普通 Adobe Fonts 授权不允许将字体文件直接自托管到此类文字生成器中。公开部署前请保留页面中的字体版权提示，不要把 Adobe 字体文件提交到仓库。

## 部署到 Cloudflare Pages

1. 在 GitHub 创建公开仓库 `ffxiv-duty-title-maker`，将本项目推送到 `main` 分支。
2. 登录 Cloudflare，进入 **Workers & Pages → Create application → Pages → Connect to Git**。
3. 授权 GitHub，并选择刚创建的仓库。
4. 构建命令填写 `npm run build`，输出目录填写 `dist`。
5. 保存并部署。Cloudflare 会提供免费的 `*.pages.dev` 地址。

以后只需把更新推送到 `main`，Cloudflare Pages 就会自动重新构建并发布。其他分支会得到独立的预览地址。

## 常见问题

- **字体载入失败**：确认文件未损坏、扩展名正确且不超过 25MB。
- **4× 导出失败**：缩短标题或降低字号/清晰度，避免超过浏览器画布限制。
- **同时下载两个文件被拦截**：使用导出按钮下方出现的 PNG/JPG 独立保存按钮。
- **字体刷新后消失**：这是预期行为，本地字体不会被持久化或上传。

## 字体与许可

- 思源黑体来自 Adobe 官方开源仓库，Cinzel 由 Fontsource 打包；两者均在站点内自托管。
- 思源黑体与 Cinzel 使用 SIL Open Font License，对应许可随项目保留。
- 项目源码使用 [MIT License](./LICENSE)。
