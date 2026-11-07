# Gary 的作品库

统一入口：<https://garylxasln1106-sudo.github.io/bangkok-skyline/>

此仓库通过 GitHub Pages 发布，根目录、`main` 分支，包含公开视频与交互作品。

## 当前内容

- [两家酒店，一个月 · 播放页](https://garylxasln1106-sudo.github.io/bangkok-skyline/videos/thailand-bd-focus/)
- [同一视频的 MP4 直链](https://garylxasln1106-sudo.github.io/bangkok-skyline/media/thailand-bd-two-hotels-one-month.mp4)
- [曼谷天际线沙盘 · 利润版](https://garylxasln1106-sudo.github.io/bangkok-skyline/skyline.html)
- [普吉岛天际线沙盘 · 利润版](https://garylxasln1106-sudo.github.io/bangkok-skyline/phuket/)

视频：英文配音，中英字幕，1920 × 1080，30 fps，162.5 秒。

沙盘于 2026-11-06 经用户明确授权，替换为含经营数据的公开利润版：323 家已定位酒店，保留 P1–P4 分级、具体房价、2024 全年利润及 2026 年 1–8 月利润。原版不含 2025 年利润；两个利润字段的时间口径不同。数据沿用原始版本，不代表实时经营数据。点击酒店标签或从“酒店清单”选择酒店即可查看。

## 后续增加作品

1. 视频放在 `media/`，封面放在 `library/previews/`。文件名使用稳定的英文小写和短横线。
2. 复制 `videos/thailand-bd-focus/index.html` 为新视频播放页，修改标题、资源路径、章节、文稿与分享元数据。
3. 在 `library/works.js` 增加作品条目。分类可用 `video`（视频剪辑）、`training`（内部培训）、`interactive`（交互工具）、`other`（其他作品）；一个作品可以同时属于多类。
4. 提交至 `main` 后 GitHub Pages 自动发布。保留现有 URL，避免已分享的链接失效。

目录分类不提供访问限制。此站点及视频为公开访问，上传前应选择适合公开分享的版本。视频规模增大时，可保留 Pages 播放页，将视频文件转移到专业视频托管服务，仅更新播放地址。

普吉岛沙盘自带全部资源，放在 `phuket/`（地形高程来自 AWS Terrain Tiles，地图数据 © OpenStreetMap 贡献者，图片署名见各地标卡片）；2026-11-07 经用户确认公开含 P 级、房价和利润的版本，口径与曼谷利润版相同。

原曼谷沙盘资源与图片署名保留在 `skyline.html`、`assets/`、`img/`、`photos/`。原页面位于同级路径，避免相对资源地址变化。
