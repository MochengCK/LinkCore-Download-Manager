import { EventEmitter } from 'node:events'
import { resolve } from 'node:path'
import { dialog } from 'electron'
import is from 'electron-is'
import { autoUpdater } from 'electron-updater'

import { PROXY_SCOPES } from '@shared/constants'
import logger from './Logger'
import { getI18n } from '../ui/Locale'

if (is.dev()) {
  autoUpdater.updateConfigPath = resolve(__dirname, '../../../app-update.yml')
}

export default class UpdateManager extends EventEmitter {
  constructor (options = {}) {
    super()
    this.options = options
    this.i18n = getI18n()

    this.isChecking = false
    this.updater = autoUpdater
    this.updater.autoDownload = false
    this.updater.autoInstallOnAppQuit = true
    this.updater.logger = logger
    logger.info('[Motrix] setup proxy:', this.options.proxy)
    this.setupProxy(this.options.proxy)

    this.autoCheckData = {
      checkEnable: this.options.autoCheck,
      userCheck: false
    }
    this.init()
  }

  setupProxy (proxy) {
    const { enable, server, scope = [] } = proxy
    if (!enable || !server || !scope.includes(PROXY_SCOPES.UPDATE_APP)) {
      this.updater.netSession.setProxy({
        proxyRules: undefined
      })
      return
    }

    const url = new URL(server)
    const { username, password, protocol = 'http:', host, port } = url
    const proxyRules = `${protocol}//${host}`

    logger.info(`[Motrix] setup proxy: ${proxyRules}`, username, password, protocol, host, port)
    this.updater.netSession.setProxy({
      proxyRules
    })

    if (server.includes('@')) {
      this.updater.signals.login((_authInfo, callback) => {
        callback(username, password)
      })
    }
  }

  init () {
    // Event: error
    // Event: checking-for-update
    // Event: update-available
    // Event: update-not-available
    // Event: download-progress
    // Event: update-downloaded

    this.updater.on('checking-for-update', this.checkingForUpdate.bind(this))
    this.updater.on('update-available', this.updateAvailable.bind(this))
    this.updater.on('update-not-available', this.updateNotAvailable.bind(this))
    this.updater.on('download-progress', this.updateDownloadProgress.bind(this))
    this.updater.on('update-downloaded', this.updateDownloaded.bind(this))
    this.updater.on('update-cancelled', this.updateCancelled.bind(this))
    this.updater.on('error', this.updateError.bind(this))

    if (this.autoCheckData.checkEnable && !this.isChecking) {
      this.autoCheckData.userCheck = false
      this.updater.checkForUpdates()
    }
  }

  check () {
    this.autoCheckData.userCheck = true
    this.updater.checkForUpdates()
  }

  // 手动下载更新
  downloadUpdate () {
    this.emit('download-start')
    this.updater.downloadUpdate()
  }

  checkingForUpdate () {
    this.isChecking = true
    this.emit('checking')
    // 向所有窗口发送检查更新事件
    const windows = global.application?.windowManager?.getWindowList() || []
    windows.forEach(window => {
      window.webContents.send('checking-for-update')
    })
  }

  updateAvailable (event, info) {
    this.emit('update-available', info)
    // 向所有窗口发送更新可用事件，包含新版本号
    const windows = global.application?.windowManager?.getWindowList() || []

    // 调试日志，查看info对象结构
    logger.info('[Motrix] updateAvailable info:', JSON.stringify(info, null, 2))

    // 检查info对象中的版本号字段，electron-updater通常使用info.version
    const version = info?.version || info?.releaseName || 'unknown'

    // 如果版本号仍然是unknown，尝试从其他可能的字段获取
    let finalVersion = version
    if (version === 'unknown') {
      // 检查info对象中是否有其他版本相关字段
      if (info && typeof info === 'object') {
        for (const key in info) {
          if (key.toLowerCase().includes('version') || key.toLowerCase().includes('release')) {
            const value = info[key]
            if (value && value !== 'unknown' && typeof value === 'string') {
              finalVersion = value
              break
            }
          }
        }
      }
    }

    logger.info('[Motrix] Sending update-available with version:', finalVersion)

    windows.forEach(window => {
      window.webContents.send('update-available', finalVersion)
    })

    // 保存更新状态到配置文件，实现状态持久化
    if (global.application?.configManager) {
      global.application.configManager.setUserConfig('update-available', true)
      global.application.configManager.setUserConfig('new-version', finalVersion)
      global.application.configManager.setUserConfig('last-check-update-time', Date.now())
    }

    // 不再自动下载更新，等待用户手动触发下载
  }

  updateNotAvailable (event, info) {
    this.isChecking = false
    this.emit('update-not-available', info)
    // 向所有窗口发送更新不可用事件
    const windows = global.application?.windowManager?.getWindowList() || []
    windows.forEach(window => {
      window.webContents.send('update-not-available')
    })

    // 保存更新状态到配置文件，实现状态持久化
    if (global.application?.configManager) {
      global.application.configManager.setUserConfig('update-available', false)
      global.application.configManager.setUserConfig('new-version', '')
      global.application.configManager.setUserConfig('last-check-update-time', Date.now())
    }
  }

  /**
   * autoUpdater:download-progress
   * @param {Object} event
   * progress,
   * bytesPerSecond,
   * percent,
   * total,
   * transferred
   */
  updateDownloadProgress (event) {
    this.emit('download-progress', event)
  }

  updateDownloaded (event, info) {
    this.emit('update-downloaded', info)
    this.updater.logger.log(`Update Downloaded: ${info}`)
    this.isChecking = false
    this.emit('will-updated')
    // Notify renderer process about the downloaded update
    const windows = global.application?.windowManager?.getWindowList() || []
    windows.forEach(window => {
      window.webContents.send('update-downloaded')
    })
  }

  updateCancelled () {
    this.isChecking = false
  }

  updateError (event, error) {
    this.isChecking = false
    this.emit('update-error', error)
    // 向所有窗口发送更新错误事件
    const windows = global.application?.windowManager?.getWindowList() || []
    windows.forEach(window => {
      window.webContents.send('update-error')
    })
    const msg = (error == null)
      ? this.i18n.t('app.update-error-message')
      : (error.stack || error).toString()

    this.updater.logger.warn(`[Motrix] update-error: ${msg}`)
    dialog.showErrorBox('Error', msg)
  }
}
