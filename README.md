# LinkCore Download Manager (联芯下载管理器)

<p>
  <a href="https://github.com/your-username/LinkCore-Download-Manager">
    <img src="./static/512x512.png" width="256" alt="LinkCore Download Manager Icon" />
  </a>
</p>

## 基于 Motrix 二次开发的全功能下载管理器

[![GitHub release](https://img.shields.io/github/v/release/your-username/LinkCore-Download-Manager.svg)](https://github.com/your-username/LinkCore-Download-Manager/releases) ![Total Downloads](https://img.shields.io/github/downloads/your-username/LinkCore-Download-Manager/total.svg) ![Support Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)

English | [简体中文](./README-CN.md)

**LinkCore Download Manager**（中文名：联芯下载管理器）是基于 [Motrix](https://github.com/agalwood/Motrix) 开源项目二次开发的全功能下载管理器，支持 HTTP、FTP、BitTorrent、磁力链接等多种下载协议。

联芯下载管理器拥有简洁易用的界面，旨在为用户提供稳定高效的下载体验。🚀

## ✨ 项目特色

- 🎯 **基于 Motrix 二次开发** - 在成熟的 Motrix 项目基础上进行优化和改进
- 🚀 **性能优化** - 针对下载速度和稳定性进行了专门优化
- 🎨 **界面美化** - 改进了用户界面，提供更好的视觉体验
- 🔧 **功能增强** - 在原有功能基础上增加了实用特性
- 🌍 **多语言支持** - 完整支持中文界面

## ✨ 主要功能

- 🕹 简洁明了的用户界面
- 🦄 支持 BitTorrent 和磁力链接下载
- ☑️ BitTorrent 选择性下载
- 📡 每日自动更新 Tracker 列表
- 🔌 UPnP & NAT-PMP 端口映射
- 🎛 最多支持 10 个并发下载任务
- 🚀 单个任务最多支持 64 线程下载
- 🚥 支持下载速度限制
- 🕶 模拟 User-Agent
- 🔔 下载完成通知
- 🤖 系统托盘快速操作
- 🌑 深色模式支持
- 🗑 删除任务时可选择删除相关文件
- 🌍 国际化支持

## 💽 安装

### Windows

下载最新版本的安装包进行安装：

1. 前往 [GitHub Releases](https://github.com/your-username/LinkCore-Download-Manager/releases) 页面
2. 下载 `LinkCore-Download-Manager-Setup-x.y.z.exe`
3. 运行安装程序完成安装

### macOS

使用 Homebrew 安装：

```bash
brew install linkcore-download-manager
```

### Linux

#### AppImage
下载 AppImage 文件并赋予执行权限：

```bash
chmod +x LinkCore-Download-Manager-x.y.z.AppImage
./LinkCore-Download-Manager-x.y.z.AppImage
```

#### Snap
```bash
sudo snap install linkcore-download-manager
```

## 🖥 界面预览

![linkcore-screenshot-task.png](./screenshots/motrix-task-list-downloading-light@2x.png)

## 🛠 开发与构建

### 克隆代码

```bash
git clone https://github.com/your-username/LinkCore-Download-Manager.git
cd LinkCore-Download-Manager
```

### 安装依赖

```bash
npm install
# 或
yarn install
```

### 开发模式

```bash
npm run dev
# 或
yarn run dev
```

### 构建发布版本

```bash
npm run build
# 或
yarn run build
```

## 🛠 技术栈

- [Electron](https://electronjs.org/) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [VueX](https://vuex.vuejs.org/) - 状态管理
- [Element UI](https://element.eleme.io) - UI 组件库
- [Aria2](https://aria2.github.io/) - 轻量级多协议命令行下载工具

## 🤝 参与贡献

欢迎提交 Pull Request 和 Issue！如果您对项目有任何建议或发现了问题，请随时联系我们。

## 📜 许可证

本项目基于 [MIT 许可证](LICENSE) 开源。

**特别声明**：本项目基于 [Motrix](https://github.com/agalwood/Motrix) 项目进行二次开发，遵循原项目的开源协议。

## 📞 联系我们

- 项目主页：https://github.com/your-username/LinkCore-Download-Manager
- 问题反馈：https://github.com/your-username/LinkCore-Download-Manager/issues

---

*LinkCore Download Manager - 让下载更简单、更高效*