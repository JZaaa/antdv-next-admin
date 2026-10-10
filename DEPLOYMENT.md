# GitHub Pages 部署指南

本项目已配置为可自动部署到 GitHub Pages。

## 📦 部署地址

- **在线体验**: https://jzaaa.github.io/antdv-next-admin
- **项目仓库**: https://github.com/JZaaa/antdv-next-admin

GitHub Pages 部署的是启用浏览器端模拟接口的 Demo 版本。

## 🚀 自动部署

项目使用 GitHub Actions 实现自动化部署：

1. 当代码推送到 `main` 分支时，会自动触发部署流程
2. GitHub Actions 会自动构建项目并部署到 GitHub Pages
3. 部署完成后，可以通过上述地址访问

## ⚙️ 配置说明

### 1. Vite 配置
```typescript
// vite.config.ts
base: '/'
```

Pages 构建通过命令行 `--base=/antdv-next-admin/` 设置仓库子路径。

### 2. GitHub Actions
- 工作流文件: `.github/workflows/deploy.yml`
- 触发条件: 推送到 main 分支或手动触发
- 构建命令: `pnpm run build:demo --base=/antdv-next-admin/`

### 3. SPA 路由支持
- `public/404.html`: 处理 404 重定向
- `index.html`: 接收重定向并恢复路由
- `public/.nojekyll`: 禁用 Jekyll 处理

## 📝 手动部署步骤

推荐在仓库 Actions 中选择 **Deploy to GitHub Pages → Run workflow** 手动触发，沿用自动部署的构建和检查流程。

如果需要从本地发布到 `gh-pages` 分支，则执行以下命令，并将 Settings → Pages → Source 改为 **Deploy from a branch**，选择 `gh-pages` 分支的 `/ (root)`。此方式与下方 GitHub Actions 发布方式二选一；推送命令会覆盖该部署分支。

```bash
# 1. 构建项目
npm run build:demo -- --base=/antdv-next-admin/
npm run check:compat:dist

# 2. 进入构建目录
cd dist

# 3. 初始化 git 仓库
git init
git add -A
git commit -m 'deploy'

# 4. 推送到 gh-pages 分支
git push -f git@github.com:JZaaa/antdv-next-admin.git HEAD:gh-pages

# 5. 返回项目根目录
cd ..
```

## 🔧 GitHub 仓库设置

使用推荐的 GitHub Actions 发布方式时，确保在 `JZaaa/antdv-next-admin` 仓库设置中：

1. 进入仓库 Settings → Pages
2. Source 选择 "GitHub Actions"
3. 等待首次部署完成

## 📊 查看部署状态

- 在 GitHub 仓库的 "Actions" 标签页查看部署进度
- 绿色勾号表示部署成功
- 红色叉号表示部署失败，点击查看日志

## 🐛 常见问题

### 1. 404 错误
- 确保 `base` 配置正确
- 检查 GitHub Pages 设置是否正确

### 2. 路由不工作
- 确保 `404.html` 和 `index.html` 中的重定向脚本存在
- 检查浏览器控制台是否有错误

### 3. 样式/资源 404
- 确保 `base` 路径配置正确
- 检查构建后的资源路径是否正确

## 🔐 权限说明

GitHub Actions 需要以下权限：
- `contents: read` - 读取代码
- `pages: write` - 写入 Pages
- `id-token: write` - 身份验证

这些权限已在 workflow 文件中配置。
