import is from 'electron-is'
import path from 'path'

const getVideoSnifferUrl = () => {
  if (is.dev()) {
    return `file://${path.resolve(__dirname, '../pages/video-sniffer.html').replace(/\\/g, '/')}`
  }
  return `file://${path.join(__dirname, 'pages/video-sniffer.html').replace(/\\/g, '/')}`
}

export default {
  index: {
    attrs: {
      title: 'LinkCore Download Manager',
      width: 1024,
      height: 768,
      minWidth: 478,
      minHeight: 420,
      transparent: is.macOS()
    },
    bindCloseToHide: true,
    openDevTools: is.dev(),
    url: is.dev() ? 'http://localhost:9080' : `file://${path.join(__dirname, 'index.html').replace(/\\/g, '/')}`
  },
  'video-detection-settings': {
    attrs: {
      title: '视频嗅探设置',
      width: 500,
      height: 399,
      resizable: false,
      maximizable: false,
      minimizable: true
    },
    bindCloseToHide: false,
    openDevTools: is.dev(),
    url: getVideoSnifferUrl()
  }
}
