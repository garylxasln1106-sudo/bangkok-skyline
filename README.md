# Gary 的作品库（密码保护版）

分享入口：https://gary-private-library.garygg.chatgpt.site/

原 GitHub Pages 已关闭；GitHub 源码仓库为私有。访问密码只保存在托管平台的 `SITE_PASSWORD` 运行时密钥中，不写入源码。

## 访问保护

- 页面、利润数据、图片、字幕和视频都在私有 R2 存储中，`content/` 是私有源码备份。
- Worker 在每次请求时验证 D1 会话后才读取文件，支持视频 Range 分段播放。
- Cookie 为 Secure / HttpOnly / SameSite=Lax；退出会删除服务端会话。
- 登录有按来源 IP 和全站的错误尝试限制。共享密码可被持有人转发，授权访客可以保存已经看到的内容。
- 不要将 `content/` 复制进 `public/`、公开静态目录或公开 Git 仓库。

## 维护

使用 Sites 项目 `.openai/hosting.json` 中的 project_id；不要重复创建项目。修改密码请更新 Sites 运行时密钥并重新部署已保存版本。

依赖安装后运行 `npm run db:generate` 生成数据库变更，再用 Sites 的 build-site / site-workflow 工具构建、同步并发布。D1 migrations 位于 `drizzle/`。

`npm start -- --port 8771` 提供本机 Worker 预览。内容已导入私有 R2，生产代码中的上传接口已移除，相关运行时密钥也已删除。未来更新内容须通过新的受控导入流程；不得开放匿名上传。`scripts/upload-content.mjs` 仅保留为初始导入工具记录，当前线上没有其对应接口。

## 内容

- 首页：作品分类和入口。
- `/videos/thailand-bd-focus/`：内部培训视频、文稿和字幕。
- `/skyline.html`：曼谷酒店利润沙盘；保留原始数据口径。
