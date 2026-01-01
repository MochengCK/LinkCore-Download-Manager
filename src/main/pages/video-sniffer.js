(function () {
  'use strict'

  const log = (...args) => {
    console.log('[Video Sniffer Settings]', ...args)
  }

  log('========== Script loaded! ==========')

  let config = {
    enabled: true,
    autoCombine: true,
    formats: ['m4s', 'mp4', 'flv', 'm3u8', 'ts']
  }

  let useCustomFrame = false

  const defaultFormats = ['m4s', 'mp4', 'flv', 'm3u8', 'ts']

  function applyTheme (theme) {
    const isDark = theme === 'dark'
    log('Applying theme:', theme, 'isDark:', isDark)

    if (isDark) {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
  }

  function getCurrentTheme () {
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron')
        ipcRenderer.invoke('get-app-config').then((appConfig) => {
          if (appConfig && appConfig.theme) {
            const theme = appConfig.theme
            log('Current theme from app config:', theme)
            if (theme === 'dark') {
              applyTheme('dark')
            } else if (theme === 'light') {
              applyTheme('light')
            } else if (theme === 'auto') {
              const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
              applyTheme(isDark ? 'dark' : 'light')
            }
          }

          if (appConfig && appConfig['hide-app-menu']) {
            useCustomFrame = appConfig['hide-app-menu']
            log('Use custom frame:', useCustomFrame)
            if (useCustomFrame) {
              document.body.classList.add('use-custom-frame')
            } else {
              document.body.classList.remove('use-custom-frame')
            }
          }
        }).catch((e) => {
          console.error('[Video Sniffer] Failed to get theme:', e)
        })
      }
    } catch (e) {
      console.error('[Video Sniffer] Failed to get theme:', e)
    }
  }

  function loadSettings () {
    log('Loading settings from localStorage...')
    try {
      const saved = localStorage.getItem('videoSnifferSettings')
      if (saved) {
        const parsed = JSON.parse(saved)
        config = { ...config, ...parsed }
        log('Loaded settings from localStorage:', config)
      }
    } catch (e) {
      console.error('[Video Sniffer] Failed to load settings:', e)
    }

    // 从主进程加载最新配置
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron')
        ipcRenderer.invoke('get-video-sniffer-config').then((mainConfig) => {
          if (mainConfig) {
            log('Loaded settings from main process:', mainConfig)
            config = { ...config, ...mainConfig }
            updateUI()
          }
        }).catch((e) => {
          console.error('[Video Sniffer] Failed to load settings from main process:', e)
        })
      }
    } catch (e) {
      console.error('[Video Sniffer] Failed to load settings from main process:', e)
    }
  }

  function saveSettings () {
    log('Saving settings...')
    try {
      localStorage.setItem('videoSnifferSettings', JSON.stringify(config))
      log('Settings saved to localStorage:', config)

      try {
        if (window.require && window.electronAPI) {
          window.electronAPI.sendVideoSnifferSettings(config)
          log('Settings sent via IPC:', config)
        } else if (window.require) {
          const { ipcRenderer } = window.require('electron')
          ipcRenderer.send('video-sniffer-settings-updated', config)
          log('Settings sent via IPC (legacy):', config)
        }
      } catch (e) {
        console.error('[Video Sniffer] Failed to send settings via IPC:', e)
      }
    } catch (e) {
      console.error('[Video Sniffer] Failed to save settings:', e)
    }
  }

  function updateUI () {
    const enabledCheckbox = document.getElementById('videoSnifferEnabled')
    const autoCombineCheckbox = document.getElementById('videoSnifferAutoCombine')
    const formatList = document.getElementById('formatList')

    if (enabledCheckbox) {
      enabledCheckbox.checked = config.enabled
    }

    if (autoCombineCheckbox) {
      autoCombineCheckbox.checked = config.autoCombine
    }

    if (formatList) {
      formatList.innerHTML = ''
      config.formats.forEach((format, index) => {
        const tag = document.createElement('div')
        tag.className = 'format-tag'
        tag.innerHTML = `
          ${format}
          <span class="remove-btn" data-index="${index}">×</span>
        `
        formatList.appendChild(tag)
      })
    }
  }

  function addFormat (format) {
    format = format.trim().toLowerCase()
    if (!format) return
    if (config.formats.includes(format)) {
      alert('该格式已存在')
      return
    }
    config.formats.push(format)
    updateUI()
  }

  function removeFormat (index) {
    config.formats.splice(index, 1)
    updateUI()
  }

  function resetSettings () {
    config = {
      enabled: true,
      autoCombine: true,
      formats: [...defaultFormats]
    }
    saveSettings()
    updateUI()
    log('Settings reset to default')
  }

  document.addEventListener('DOMContentLoaded', () => {
    log('DOM Content Loaded')
    getCurrentTheme()
    loadSettings()
    updateUI()

    const enabledCheckbox = document.getElementById('videoSnifferEnabled')
    const autoCombineCheckbox = document.getElementById('videoSnifferAutoCombine')
    const newFormatInput = document.getElementById('newFormat')
    const addFormatBtn = document.getElementById('addFormatBtn')
    const saveBtn = document.getElementById('saveBtn')
    const resetBtn = document.getElementById('resetBtn')
    const closeBtn = document.getElementById('closeBtn')
    const minimizeBtn = document.getElementById('minimizeBtn')

    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        try {
          if (window.require) {
            const { getCurrentWindow } = window.require('@electron/remote')
            const win = getCurrentWindow()
            if (win) {
              win.minimize()
            }
          }
        } catch (e) {
          console.error('[Video Sniffer] Failed to minimize window:', e)
        }
      })
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        try {
          if (window.require) {
            const { getCurrentWindow } = window.require('@electron/remote')
            const win = getCurrentWindow()
            if (win) {
              win.close()
            }
          }
        } catch (e) {
          console.error('[Video Sniffer] Failed to close window:', e)
          window.close()
        }
      })
    }

    if (enabledCheckbox) {
      enabledCheckbox.addEventListener('change', (e) => {
        config.enabled = e.target.checked
        log('Enabled changed:', config.enabled)
      })
    }

    if (autoCombineCheckbox) {
      autoCombineCheckbox.addEventListener('change', (e) => {
        config.autoCombine = e.target.checked
        log('AutoCombine changed:', config.autoCombine)
      })
    }

    if (addFormatBtn) {
      addFormatBtn.addEventListener('click', () => {
        if (newFormatInput) {
          addFormat(newFormatInput.value)
          newFormatInput.value = ''
        }
      })
    }

    if (newFormatInput) {
      newFormatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addFormat(newFormatInput.value)
          newFormatInput.value = ''
        }
      })
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        saveSettings()
        alert('设置已保存')
      })
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('确定要恢复默认设置吗？')) {
          resetSettings()
        }
      })
    }

    const formatList = document.getElementById('formatList')
    if (formatList) {
      formatList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) {
          const index = parseInt(e.target.dataset.index)
          removeFormat(index)
        }
      })
    }

    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron')
        ipcRenderer.on('application:update-system-theme', (event, data) => {
          log('Theme updated:', data)
          if (data && data.theme) {
            const theme = data.theme
            if (theme === 'dark') {
              applyTheme('dark')
            } else if (theme === 'light') {
              applyTheme('light')
            } else if (theme === 'auto') {
              const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
              applyTheme(isDark ? 'dark' : 'light')
            }
          }
        })
      }
    } catch (e) {
      console.error('[Video Sniffer] Failed to listen for theme changes:', e)
    }
  })
})()
