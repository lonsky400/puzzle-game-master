# 发布到公网（最简单方式）

项目已配置 **GitHub Actions** 自动构建并部署到 **GitHub Pages**。

## 公网地址

**https://lonsky400.github.io/puzzle-game-master/**

## 步骤

1. **开启 GitHub Pages**（只需做一次）  
   - 打开仓库：<https://github.com/lonsky400/puzzle-game-master>  
   - **Settings** → 左侧 **Pages**  
   - **Build and deployment** 里 **Source** 选 **GitHub Actions**  
   - 保存（无需改其它选项）

2. **推送代码触发部署**  
   ```bash
   git add -A && git commit -m "deploy" && git push origin main
   ```

3. **等部署完成**  
   - 打开 **Actions** 标签，看到 **Deploy to GitHub Pages** 跑绿即可  
   - 构建产物在 `dist/public/`（含 `bgm.mp3`、`all-bgm.mp3` 等），部署后背景音乐链接才会生效

## 背景音乐在公网不播？

若之前公网打开没有背景音乐，多半是**当时部署的产物里没有 mp3 文件**（例如未用本 workflow 部署）。  
现在仓库里已有 `.github/workflows/deploy-pages.yml`，每次推送到 `main` 都会执行「安装 → 构建 → 上传 `dist/public` → 部署」，`client/public` 下的 `bgm.mp3`、`all-bgm.mp3` 会一并打进 `dist/public` 并发布。  
部署完成后，在公网页面**点击一次「点击播放背景音乐」**即可播放（浏览器要求先有用户操作）。
