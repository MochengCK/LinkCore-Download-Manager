# LinkCore Download Manager（联芯下载管理器）

<p align="center">
  <img src="./screenshots/屏幕截图 2025-12-09 052141.png" width="300" alt="LinkCore Download Manager Logo" />
</p>

<p align="center">
  <a href="https://github.com/HuanXinStudio/-LinkCore-Download-Manager/releases">
    <img src="https://img.shields.io/github/v/release/HuanXinStudio/-LinkCore-Download-Manager.svg" alt="GitHub release" />
  </a>
  <a href="https://github.com/HuanXinStudio/-LinkCore-Download-Manager/releases">
    <img src="https://img.shields.io/github/downloads/HuanXinStudio/-LinkCore-Download-Manager/total.svg" alt="Total Downloads" />
  </a>
  <a href="#platforms">
    <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Support Platforms" />
  </a>
  <a href="https://github.com/HuanXinStudio/-LinkCore-Download-Manager/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/HuanXinStudio/-LinkCore-Download-Manager.svg" alt="License" />
  </a>
</p>

<p align="center">
  <a href="./README.md">English</a> | 简体中文
</p>

## 📖 项目简介

LinkCore Download Manager（联芯下载管理器）是一款功能强大的跨平台下载管理器，采用现代Web技术构建。它提供简洁直观的界面，同时支持多种下载协议，是满足您所有下载需求的理想选择。

联芯下载管理器基于 <a href="https://github.com/agalwood/Motrix">Motrix</a> 项目进行二次开发，通过优化性能、改进用户界面和增加新功能，为用户提供卓越的下载体验。

## ✨ 核心功能

### 🚀 性能与可靠性
- **高速下载**：针对最大下载性能进行了优化
- **多线程支持**：每个任务最多支持64个线程
- **并发下载**：可同时管理多达10个下载任务
- **稳定连接**：强大的错误处理和自动重试机制

### 📁 协议支持
- **HTTP/HTTPS**：直接从Web服务器下载
- **FTP/SFTP**：从FTP服务器传输文件
- **BitTorrent**：完整支持种子文件，可选择性下载
- **磁力链接**：无需.torrent文件即可直接下载

### 🎨 用户体验
- **简洁界面**：现代直观的设计，支持深色模式
- **系统托盘集成**：快速访问和状态监控
- **下载通知**：下载完成时实时提醒
- **速度控制**：设置上传和下载速度限制
- **文件管理**：按类别和位置组织下载文件

### 🔧 高级功能
- **Tracker更新**：每日自动更新Tracker列表，提升种子下载性能
- **UPnP/NAT-PMP**：自动端口映射，提高连接性
- **User-Agent伪装**：自定义User-Agent字符串，增强兼容性
- **任务调度**：设置下载时间和优先级
- **批量下载**：导入和导出下载列表

## 🖥️ 支持平台

联芯下载管理器支持以下平台：
- **Windows** (7, 8, 10, 11)
- **macOS** (10.13+)
- **Linux** (Ubuntu, Fedora, Debian, Arch等)

## 📦 安装方式

### Windows

1. 访问 [GitHub Releases](https://github.com/HuanXinStudio/-LinkCore-Download-Manager/releases) 页面
2. 下载最新版本的 `LinkCore-Download-Manager-Setup-x.y.z.exe` 安装程序
3. 运行安装程序并按照屏幕提示完成安装

### macOS

#### Homebrew（推荐）
```bash
brew install linkcore-download-manager
```

#### DMG文件
1. 从 [releases](https://github.com/HuanXinStudio/-LinkCore-Download-Manager/releases) 下载最新的 `LinkCore-Download-Manager-x.y.z.dmg` 文件
2. 打开DMG文件，将LinkCore拖动到应用程序文件夹

### Linux

#### AppImage
1. 从 [releases](https://github.com/HuanXinStudio/-LinkCore-Download-Manager/releases) 下载最新的 `LinkCore-Download-Manager-x.y.z.AppImage` 文件
2. 赋予文件执行权限：
   ```bash
   chmod +x LinkCore-Download-Manager-x.y.z.AppImage
   ```
3. 运行AppImage：
   ```bash
   ./LinkCore-Download-Manager-x.y.z.AppImage
   ```

#### Snap
```bash
sudo snap install linkcore-download-manager
```

#### Debian/Ubuntu (DEB)
```bash
sudo dpkg -i linkcore-download-manager_x.y.z_amd64.deb
sudo apt-get install -f
```

## 🖥️ 界面截图

<p align="center">
  <img src="./screenshots/linkcore-screenshot-task.png" alt="任务管理界面" width="600" />
  <br>
  <em>任务管理界面</em>
</p>

## 🚀 快速开始

### 基本使用

1. **添加下载任务**：
   - 点击 "+ 新建下载" 按钮
   - 输入下载URL或上传种子文件
   - 配置下载设置（可选）
   - 点击 "确定" 开始下载

2. **管理下载**：
   - 一键暂停/恢复下载
   - 实时监控下载进度
   - 查看每个任务的详细信息

3. **种子下载**：
   - 从种子中选择特定文件下载
   - 查看Peer和Seed信息
   - 调整种子特定设置

### 键盘快捷键

- `Ctrl/Cmd + N`：新建下载任务
- `Ctrl/Cmd + R`：恢复选中任务
- `Ctrl/Cmd + P`：暂停选中任务
- `Ctrl/Cmd + D`：删除选中任务
- `Ctrl/Cmd + Q`：退出应用

## 🛠️ 开发指南

### 前置要求

- Node.js (v16.0.0或更高版本)
- npm 或 yarn
- Git

### 设置开发环境

1. 克隆仓库：
   ```bash
   git clone https://github.com/HuanXinStudio/-LinkCore-Download-Manager.git
   cd LinkCore-Download-Manager
   ```

2. 安装依赖：
   ```bash
   npm install
   # 或
   yarn install
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

4. 构建生产版本：
   ```bash
   npm run build
   ```

### 项目结构

```
LinkCore-Download-Manager/
├── src/                  # 主要源代码
│   ├── main/             # Electron主进程
│   ├── renderer/         # Electron渲染进程（Vue.js）
│   └── shared/           # 共享工具
├── static/               # 静态资源
├── .electron-vue/        # Electron-Vue配置
├── screenshots/          # 文档截图
├── package.json          # 项目配置
└── README.md             # 项目文档
```

## 🤝 参与贡献

欢迎贡献代码！无论您是修复bug、添加新功能还是改进文档，我们都非常感谢您的帮助。

### 如何贡献

1. Fork 本仓库
2. 创建新分支 (`git checkout -b feature/your-feature`)
3. 进行修改
4. 提交更改 (`git commit -m 'Add some feature'`)
5. 推送到分支 (`git push origin feature/your-feature`)
6. 创建 Pull Request

### 开发指南

- 遵循现有代码风格
- 编写清晰简洁的提交信息
- 为新功能添加测试
- 按需更新文档

## 📄 许可证

联芯下载管理器基于 [MIT License](LICENSE) 开源。

## 🙏 致谢

- **原始项目**：[Motrix](https://github.com/agalwood/Motrix) by Dr_rOot
- **UI框架**：[Vue.js](https://vuejs.org/)
- **桌面框架**：[Electron](https://www.electronjs.org/)
- **种子库**：[WebTorrent](https://webtorrent.io/)

## 📞 支持

如果您遇到任何问题或有疑问：

- 在GitHub上 [提交issue](https://github.com/HuanXinStudio/-LinkCore-Download-Manager/issues)
- 加入我们的社区进行讨论和获取支持

---

<p align="center">
  由 HuanXinStudio 用心打造 ❤️
</p>