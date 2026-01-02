(function () {
  'use strict'

  const log = (...args) => {
    console.log('[Video Sniffer Add Format]', ...args)
  }

  log('========== Script loaded! ==========')

  let locale = 'en-US'
  let translations = {}

  async function loadTranslations (locale) {
    try {
      const isDev = typeof __dirname === 'string' && __dirname.includes('src')
      const localePath = isDev ? `../../shared/locales/${locale}/window.js` : `../shared/locales/${locale}/window.js`
      try {
        const module = await import(localePath)
        translations = module.default || {}
        log('Translations loaded for locale:', locale)
      } catch (importError) {
        console.error('[Video Sniffer Add Format] Failed to import translations:', importError)
        const response = await fetch(localePath)
        if (response.ok) {
          const text = await response.text()
          const match = text.match(/export default\s*\{([\s\S]*?)\}/)
          if (match && match[1]) {
            const func = new Function(`return {${match[1]}}`)
            translations = func()
            log('Translations loaded for locale:', locale, '(fallback)')
          }
        }
      }
    } catch (e) {
      console.error('[Video Sniffer Add Format] Failed to load translations:', e)
    }
  }

  function t (key) {
    return translations[key] || key
  }

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
            const useCustomFrame = appConfig['hide-app-menu']
            log('Use custom frame:', useCustomFrame)
            if (useCustomFrame) {
              document.body.classList.add('use-custom-frame')
            } else {
              document.body.classList.remove('use-custom-frame')
            }
          }
        }).catch((e) => {
          console.error('[Video Sniffer Add Format] Failed to get theme:', e)
        })
      }
    } catch (e) {
      console.error('[Video Sniffer Add Format] Failed to get theme:', e)
    }
  }

  function applyTranslations () {
    const titleText = document.getElementById('titleText')
    const formatLabel = document.getElementById('formatLabel')
    const formatInput = document.getElementById('formatInput')
    const cancelBtn = document.getElementById('cancelBtn')
    const confirmBtn = document.getElementById('confirmBtn')

    if (titleText) {
      titleText.textContent = t('video-sniffer-add-format')
    }

    if (formatLabel) {
      formatLabel.textContent = t('video-sniffer-formats')
    }

    if (formatInput) {
      formatInput.placeholder = t('video-sniffer-format-placeholder')
    }

    if (cancelBtn) {
      cancelBtn.textContent = t('cancel')
    }

    if (confirmBtn) {
      confirmBtn.textContent = t('confirm')
    }
  }

  async function init () {
    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron')
        const appLocale = await ipcRenderer.invoke('get-app-locale')
        locale = appLocale || 'en-US'
        log('Current locale:', locale)
        await loadTranslations(locale)
      }
    } catch (e) {
      console.error('[Video Sniffer Add Format] Failed to get locale:', e)
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    log('DOM Content Loaded')
    await init()
    await getCurrentTheme()
    applyTranslations()

    const formatInput = document.getElementById('formatInput')
    const confirmBtn = document.getElementById('confirmBtn')
    const cancelBtn = document.getElementById('cancelBtn')
    const closeBtn = document.getElementById('closeBtn')

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
          console.error('[Video Sniffer Add Format] Failed to close window:', e)
          window.close()
        }
      })
    }

    const confirmHandler = () => {
      const format = formatInput.value.trim().toLowerCase()
      if (format) {
        try {
          if (window.require) {
            const { getCurrentWindow } = window.require('@electron/remote')
            const win = getCurrentWindow()
            const parentWindow = win.getParentWindow()
            
            if (parentWindow) {
              parentWindow.webContents.send('video-sniffer-format-added', format)
              log('Format sent via IPC:', format)
            } else {
              console.error('[Video Sniffer Add Format] No parent window found')
            }
          }
        } catch (e) {
          console.error('[Video Sniffer Add Format] Failed to send format via IPC:', e)
        }
      }
      try {
        if (window.require) {
          const { getCurrentWindow } = window.require('@electron/remote')
          const win = getCurrentWindow()
          if (win) {
            win.close()
          }
        }
      } catch (e) {
        console.error('[Video Sniffer Add Format] Failed to close window:', e)
        window.close()
      }
    }

    const cancelHandler = () => {
      try {
        if (window.require) {
          const { getCurrentWindow } = window.require('@electron/remote')
          const win = getCurrentWindow()
          if (win) {
            win.close()
          }
        }
      } catch (e) {
        console.error('[Video Sniffer Add Format] Failed to close window:', e)
        window.close()
      }
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', confirmHandler)
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelHandler)
    }

    if (formatInput) {
      formatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          confirmHandler()
        } else if (e.key === 'Escape') {
          cancelHandler()
        }
      })
      formatInput.focus()
    }

    try {
      if (window.require) {
        const { ipcRenderer } = window.require('electron')
        
        ipcRenderer.on('command', (event, command, ...args) => {
          log('Command received:', command, args)
          if (command === 'application:update-system-theme') {
            const data = args[0]
            log('System theme updated:', data)
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
          } else if (command === 'application:update-theme') {
            const data = args[0]
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
          }
        })
      }
    } catch (e) {
      console.error('[Video Sniffer Add Format] Failed to listen for theme changes:', e)
    }

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      try {
        if (window.require) {
          const { ipcRenderer } = window.require('electron')
          ipcRenderer.invoke('get-app-config').then((appConfig) => {
            if (appConfig && appConfig.theme === 'auto') {
              const isDark = e.matches
              applyTheme(isDark ? 'dark' : 'light')
              log('System theme changed:', isDark ? 'dark' : 'light')
            }
          }).catch((err) => {
            console.error('[Video Sniffer Add Format] Failed to get app config:', err)
          })
        }
      } catch (e) {
        console.error('[Video Sniffer Add Format] Failed to handle system theme change:', e)
      }
    })
  })
})()
