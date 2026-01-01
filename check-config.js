const { app } = require('electron')
const path = require('path')
const fs = require('fs')

// 设置正确的应用名称
app.setName('LinkCore Download Manager')

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData')
  const userConfigPath = path.join(userDataPath, 'user.json')
  
  console.log('应用名称:', app.getName())
  console.log('配置文件路径:', userConfigPath)
  console.log('')
  
  if (fs.existsSync(userConfigPath)) {
    const content = fs.readFileSync(userConfigPath, 'utf8')
    const config = JSON.parse(content)
    
    console.log('当前视频嗅探配置:')
    console.log('  video-sniffer-enabled:', config['video-sniffer-enabled'])
    console.log('  video-sniffer-auto-combine:', config['video-sniffer-auto-combine'])
    console.log('')
    console.log('  video-sniffer-formats (数组长度: ' + (config['video-sniffer-formats'] || []).length + '):')
    if (Array.isArray(config['video-sniffer-formats'])) {
      config['video-sniffer-formats'].forEach((format, index) => {
        console.log('    [' + index + '] .' + format)
      })
    } else {
      console.log('    不是数组类型:', typeof config['video-sniffer-formats'])
    }
    
    console.log('')
    // 检查是否还有驼峰式的键
    if (config.videoSnifferEnabled !== undefined || 
        config.videoSnifferFormats !== undefined || 
        config.videoSnifferAutoCombine !== undefined) {
      console.log('警告: 配置文件中仍存在驼峰式的键:')
      console.log('  videoSnifferEnabled:', config.videoSnifferEnabled)
      console.log('  videoSnifferAutoCombine:', config.videoSnifferAutoCombine)
      if (Array.isArray(config.videoSnifferFormats)) {
        console.log('  videoSnifferFormats (数组长度: ' + config.videoSnifferFormats.length + '):')
        config.videoSnifferFormats.forEach((format, index) => {
          console.log('    [' + index + '] .' + format)
        })
      }
    } else {
      console.log('✓ 驼峰式的旧键已清理')
    }
  } else {
    console.log('配置文件不存在')
  }
  
  app.quit()
})
