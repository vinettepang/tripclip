# 发布到 GitHub Pages — 手动操作手册

> 自动部署已配置好（`.github/workflows/deploy.yml`），你只需**新建仓库 + 推送一次**，之后每次 push 到 `main` 都自动更新线上站点。

## 你需要做的（一次性，约 5 分钟）

### 第 1 步：在 GitHub 网页新建仓库

1. 打开 https://github.com/new
2. **Repository name** 填：`tripclip`
3. 选 **Public**（符合"免费工具"定位；数据只存用户本地浏览器，仓库里没有敏感信息）
4. 不要勾选 "Add a README" / ".gitignore" / "license"（避免和本地冲突）
5. 点 **Create repository**

### 第 2 步：本地绑定远程仓库并推送

在本机终端执行（把 `<你的用户名>` 换成你的 GitHub 用户名，如 `VinettePang`）：

```bash
cd /Users/vinette/WorkBuddy/2026-08-19-11-01-19/tripclip

# 方式一（推荐）：SSH，无需每次输密码（需已配置 SSH key）
git remote add origin git@github.com:<你的用户名>/tripclip.git

# 方式二：HTTPS，首次推送会让你输入 GitHub 账号密码或 Personal Access Token
# git remote add origin https://github.com/<你的用户名>/tripclip.git

git push -u origin main
```

推送完成后，GitHub 会自动触发 workflow（仓库页面顶部会出现 `Deploy to GitHub Pages` 的黄色/绿色状态）。

### 第 3 步：开启 GitHub Pages

1. 打开仓库页面 → **Settings** → 左侧 **Pages**
2. **Source** 选 **GitHub Actions**（注意：不是 "Deploy from a branch"）
3. 等待 Actions 里 `Deploy to GitHub Pages` 跑完（绿色 ✓）

### 第 4 步：访问你的站点

```
https://<你的用户名>.github.io/tripclip/
```

例如：`https://vinettepang.github.io/tripclip/`

页面右上角版本徽标应显示 **v0.3**。

---

## 以后每次更新怎么发布

**什么都不用做。** 本地改完代码后：

```bash
git add -A
git commit -m "更新内容描述"
git push
```

push 到 `main` 后约 1 分钟，线上自动更新。在仓库 **Actions** 页可看到每次部署记录。

## 手动重新部署 / 回滚

- **重新部署**：仓库 **Actions** → 左侧 `Deploy to GitHub Pages` → 右侧 **Run workflow** → 绿色按钮
- **回滚到旧版本**：仓库 **Commits** 找到历史提交 → 点 `...` → **Revert** → push，自动重新部署

## 常见问题

| 现象 | 解决 |
|---|---|
| Actions 里 workflow 是红色 ✗ | 点进去看日志；最常见是第 3 步没做（Source 未选 GitHub Actions） |
| 站点 404 | 检查 URL 是否少了仓库名 `/tripclip/`；或部署刚完成，等 1-2 分钟刷新 |
| 想改站点里的文件 | 修改 `index.html` 提交推送即可；workflow 只打包 `index.html`（加文件见 workflow 内注释） |
| 国内访问慢 | GitHub Pages 国内可达性一般，可考虑后续接 Cloudflare 等 CDN（二期再说） |

## 为什么用这个方案

- **GitHub 官方 Actions** 部署，不依赖第三方插件
- 权限最小化：workflow 只拿 `pages: write`，不会动仓库其他内容
- 站点目录只包含 `index.html`，二期资产（`index.v0.4.html`、`worker.js`、`DEPLOY.md`）不暴露到站点路径
- 纯静态单文件应用，localStorage 数据存在访问者浏览器里，托管在哪都不影响功能
