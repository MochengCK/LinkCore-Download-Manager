# LinkCore Download Manager

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
  English | <a href="./README-CN.md">简体中文</a>
</p>

## 📖 Overview

LinkCore Download Manager is a powerful, cross-platform download manager built with modern web technologies. It provides a clean, intuitive interface while supporting a wide range of download protocols, making it an ideal choice for all your downloading needs.

Originally forked from <a href="https://github.com/agalwood/Motrix">Motrix</a>, LinkCore has been enhanced with improved performance, a refined user interface, and additional features to deliver an exceptional downloading experience.

## ✨ Key Features

### 🚀 Performance & Reliability
- **High-Speed Downloads**: Optimized for maximum download performance
- **Multi-Threading**: Support for up to 64 threads per task
- **Concurrent Downloads**: Manage up to 10 simultaneous download tasks
- **Stable Connections**: Robust error handling and automatic retry mechanisms

### � Protocol Support
- **HTTP/HTTPS**: Direct downloads from web servers
- **FTP/SFTP**: File transfers from FTP servers
- **BitTorrent**: Full torrent file support with selective downloading
- **Magnet Links**: Instant torrent downloads without .torrent files

### 🎨 User Experience
- **Clean Interface**: Modern, intuitive design with dark mode support
- **System Tray Integration**: Quick access and status monitoring
- **Download Notifications**: Real-time alerts when downloads complete
- **Speed Control**: Set upload and download speed limits
- **File Management**: Organize downloads by category and location

### 🔧 Advanced Features
- **Tracker Updates**: Daily automatic tracker list updates for improved torrent performance
- **UPnP/NAT-PMP**: Automatic port mapping for better connectivity
- **User-Agent Spoofing**: Customize user-agent strings for compatibility
- **Task Scheduling**: Set download times and priorities
- **Batch Downloads**: Import and export download lists

## 🖥️ Platforms

LinkCore Download Manager is available for:
- **Windows** (7, 8, 10, 11)
- **macOS** (10.13+)
- **Linux** (Ubuntu, Fedora, Debian, Arch, etc.)

## � Installation

### Windows

1. Visit the [GitHub Releases](https://github.com/HuanXinStudio/-LinkCore-Download-Manager/releases) page
2. Download the latest `LinkCore-Download-Manager-Setup-x.y.z.exe` installer
3. Run the installer and follow the on-screen instructions

### macOS

#### Homebrew (Recommended)
```bash
brew install linkcore-download-manager
```

#### DMG File
1. Download the latest `LinkCore-Download-Manager-x.y.z.dmg` from [releases](https://github.com/HuanXinStudio/-LinkCore-Download-Manager/releases)
2. Open the DMG file and drag LinkCore to your Applications folder

### Linux

#### AppImage
1. Download the latest `LinkCore-Download-Manager-x.y.z.AppImage` from [releases](https://github.com/HuanXinStudio/-LinkCore-Download-Manager/releases)
2. Make the file executable:
   ```bash
   chmod +x LinkCore-Download-Manager-x.y.z.AppImage
   ```
3. Run the AppImage:
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

## �️ Screenshots

<p align="center">
  <img src="./screenshots/linkcore-screenshot-task.png" alt="Task Management Interface" width="600" />
  <br>
  <em>Task Management Interface</em>
</p>

## �🚀 Quick Start

### Basic Usage

1. **Add a Download Task**:
   - Click the "+ New Download" button
   - Enter the download URL or upload a torrent file
   - Configure download settings (optional)
   - Click "OK" to start downloading

2. **Manage Downloads**:
   - Pause/resume downloads with a single click
   - Monitor download progress in real-time
   - View detailed information about each task

3. **Torrent Downloads**:
   - Select specific files to download from a torrent
   - View peer and seed information
   - Adjust torrent-specific settings

### Keyboard Shortcuts

- `Ctrl/Cmd + N`: New download task
- `Ctrl/Cmd + R`: Resume selected task(s)
- `Ctrl/Cmd + P`: Pause selected task(s)
- `Ctrl/Cmd + D`: Delete selected task(s)
- `Ctrl/Cmd + Q`: Quit the application

## 🛠️ Development

### Prerequisites

- Node.js (v16.0.0 or higher)
- npm or yarn
- Git

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/HuanXinStudio/-LinkCore-Download-Manager.git
   cd LinkCore-Download-Manager
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

### Project Structure

```
LinkCore-Download-Manager/
├── src/                  # Main source code
│   ├── main/             # Electron main process
│   ├── renderer/         # Electron renderer process (Vue.js)
│   └── shared/           # Shared utilities
├── static/               # Static assets
├── .electron-vue/        # Electron-Vue configuration
├── screenshots/          # Screenshots for documentation
├── package.json          # Project configuration
└── README.md             # This file
```

## 🤝 Contributing

Contributions are welcome! Whether you're fixing bugs, adding new features, or improving documentation, your help is appreciated.

### How to Contribute

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add some feature'`)
5. Push to the branch (`git push origin feature/your-feature`)
6. Create a Pull Request

### Development Guidelines

- Follow the existing code style
- Write clear, concise commit messages
- Include tests for new features
- Update documentation as needed

## � License

LinkCore Download Manager is licensed under the [MIT License](LICENSE).

## 🙏 Credits

- **Original Project**: [Motrix](https://github.com/agalwood/Motrix) by Dr_rOot
- **UI Framework**: [Vue.js](https://vuejs.org/)
- **Desktop Framework**: [Electron](https://www.electronjs.org/)
- **Torrent Library**: [WebTorrent](https://webtorrent.io/)

## 📞 Support

If you encounter any issues or have questions:

- Open an [issue](https://github.com/HuanXinStudio/-LinkCore-Download-Manager/issues) on GitHub
- Join our community for discussions and support

---

<p align="center">
  Made with ❤️ by HuanXinStudio
</p>