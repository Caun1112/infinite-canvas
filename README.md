# 无限画布 (infinite-canvas)

无限画布是一款面向图片创作的开源工作台。它把画布编排、AI 图片生成、参考图编辑、对话助手、提示词库和素材沉淀放在同一个界面里，适合用来探索视觉方案并连续迭代图片结果。

## 上游来源

本项目 fork 自 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)，原作者和原项目署名保留。原项目使用 GNU Affero General Public License v3.0，本 fork 继续遵循 AGPL-3.0，许可证见 [LICENSE](LICENSE)。

## 本 fork 的改动

- 保留上游 0.2.5 版本线的无限画布、AI 创作、画布助手、提示词库和本地素材能力。
- 新增 macOS App 与 iPhone 未签名 IPA 的 Tauri App 壳构建入口。
- 增加 iPhone 视口、安全区、输入框字号和基础触控适配。
- 后续继续补齐移动端节点菜单、相册保存/分享回退和图片编辑器能力。

## 技术栈

- 前端：Next.js App Router、React、TypeScript、Ant Design、Tailwind、Zustand、localforage。
- 后端：Go、Gin、GORM。
- App 壳：Tauri 2。
- 部署：Docker。

## 快速开始

```bash
cp .env.example .env
docker compose -f docker-compose.local.yml up -d --build
```

运行后默认访问 `http://localhost:3000`。

前端开发：

```bash
cd web
npm install
npm run dev
```

后端开发：

```bash
go run .
```

## 构建说明

Docker 构建仍以 Web 服务为主：

```bash
docker compose up -d --build
```

macOS App zip：

```bash
cd web
APP_VERSION=v0.1.0 APP_URL=http://localhost:3000 npm run app:macos
```

iPhone 未签名 IPA：

```bash
cd web
APP_VERSION=v0.1.0 APP_URL=http://localhost:3000 npm run app:ios
```

产物会输出到 `dist/release-assets/`，例如：

- `InfiniteCanvas_0.1.0_macOS_app.zip`
- `InfiniteCanvas_0.1.0_unsigned.ipa`

当前 App 壳基于 0.2.5 Web 服务构造，`APP_URL` 需要指向可访问的无限画布服务。移动端真机安装前请先确认该地址在设备上可打开。

## 文档

AI 开发文档索引见 [docs/index.md](docs/index.md)。待办和待测试事项位于：

- [TODO](docs/content/docs/progress/todo.mdx)
- [待测试](docs/content/docs/progress/pending-test.mdx)

## 开源协议

本项目使用 GNU Affero General Public License v3.0。二次开发、分发和网络服务使用时请遵守 AGPL-3.0，并保留上游项目与作者署名。
