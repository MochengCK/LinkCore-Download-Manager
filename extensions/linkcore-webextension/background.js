const defaults = {
  host: '127.0.0.1',
  port: 16800,
  secret: '',
  autoHijack: true
}

const extConfigDefaults = {
  interceptAllDownloads: false,
  silentDownload: false,
  skipFileExtensions: [],
  shiftToggleEnabled: false
}

let extConfig = { ...extConfigDefaults }
const AUTO_HIJACK_OVERRIDE_KEY = 'autoHijackTemporarilyDisabled'

const getConfig = () => {
  return new Promise((resolve) => {
    chrome.storage.local.get(defaults, (cfg) => resolve(cfg || defaults))
  })
}

const setConfig = (data) => {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => resolve(true))
  })
}

const tryRpc = async (host, port) => {
  try {
    const rpc = `http://${host}:${port}/jsonrpc`
    const body = { jsonrpc: '2.0', id: Date.now(), method: 'aria2.getVersion', params: [''] }
    const res = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) return { host, port }
  } catch (e) {}
  return null
}

const probeRpc = async () => {
  const candidates = [
    ['127.0.0.1', 16800],
    ['localhost', 16800],
    ['127.0.0.1', 6800],
    ['localhost', 6800]
  ]
  for (const [h, p] of candidates) {
    const ok = await tryRpc(h, p)
    if (ok) {
      await setConfig({ ...(await getConfig()), host: ok.host, port: ok.port })
      return ok
    }
  }
  return { host: defaults.host, port: defaults.port }
}

let lastConnectedAt = 0
let isHealthy = false // 添加健康状态标记

const fetchWithTimeout = (url, options = {}, timeout = 2000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout)
    fetch(url, options).then((res) => {
      clearTimeout(timer)
      resolve(res)
    }).catch((err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

const CHANNEL_PORT = 16900

// 语言代码映射:客户端语言 -> 浏览器语言
const localeMap = {
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  'en-US': 'en',
  'ja': 'ja',
  'ko': 'ko',
  'es': 'es',
  'fr': 'fr',
  'de': 'de',
  'ru': 'ru'
}

// 连接状态管理 - 简化版,实时检测
let lastConnectionCheck = {
  connected: false,
  lastCheckTime: 0
}

// 通知 popup 连接状态变化
const notifyConnectionChange = (connected) => {
  console.log('[Background] Connection state changed:', connected ? 'connected' : 'disconnected')
  chrome.runtime.sendMessage({
    type: 'connectionChanged',
    connected: connected
  }).catch(() => {
    // 忽略错误(可能没有打开的popup)
  })
}

const tryChannel = async (path, options = {}, timeout = 1000) => {
  const hosts = ['127.0.0.1', 'localhost']
  
  for (const h of hosts) {
    try {
      const url = `http://${h}:${CHANNEL_PORT}${path}`
      const resp = await fetchWithTimeout(url, options, timeout)
      if (resp && resp.ok) {
        // 检测连接状态变化
        if (!lastConnectionCheck.connected) {
          notifyConnectionChange(true)
        }
        lastConnectionCheck.connected = true
        lastConnectionCheck.lastCheckTime = Date.now()
        return { host: h, resp }
      }
    } catch (e) {
      // 静默处理连接失败,不打印日志
    }
  }
  
  // 所有主机都失败 - 检测连接状态变化
  if (lastConnectionCheck.connected) {
    notifyConnectionChange(false)
  }
  lastConnectionCheck.connected = false
  lastConnectionCheck.lastCheckTime = Date.now()
  return null
}

const syncExtConfigFromClient = async () => {
  try {
    const result = await tryChannel('/linkcore/ext-config', { method: 'GET' }, 1000)
    if (!result || !result.resp || !result.resp.ok) {
      return
    }
    const data = await result.resp.json().catch(() => null)
    if (!data) {
      return
    }
    const interceptAllDownloads = !!data.interceptAllDownloads
    const silentDownload = !!data.silentDownload
    const shiftToggleEnabled = !!data.shiftToggleEnabled
    const rawList = Array.isArray(data.skipFileExtensions) ? data.skipFileExtensions : []
    const skipFileExtensions = rawList.map(x => `${x}`.trim().toLowerCase()).filter(Boolean)
    const nextConfig = {
      interceptAllDownloads,
      silentDownload,
      skipFileExtensions,
      shiftToggleEnabled
    }
    const changed = JSON.stringify(extConfig) !== JSON.stringify(nextConfig)
    extConfig = nextConfig
  } catch (e) {
  }
}

let extConfigTimer = null
const startExtConfigPolling = () => {
  if (extConfigTimer) {
    clearInterval(extConfigTimer)
  }
  syncExtConfigFromClient()
  extConfigTimer = setInterval(syncExtConfigFromClient, 3000)
}

const addUri = async (url, referer) => {
  try {
    const headers = await getHeadersForUrl(url, referer)
    const ok = await tryChannel('/linkcore/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, referer, headers })
    }, 3000)
    if (!ok) return false
    const data = await ok.resp.json().catch(() => ({}))
    return !!(data && data.ok)
  } catch (e) {
    return false
  }
}
const getHeadersForUrl = async (url, referer) => {
  const hs = ['X-LinkCore-Source: BrowserExtension']
  try {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : ''
    if (ua) hs.push(`User-Agent: ${ua}`)
  } catch (_) {}
  if (referer) {
    hs.push(`Referer: ${referer}`)
  }
  try {
    const list = await new Promise((resolve) => {
      chrome.cookies.getAll({ url }, (cookies) => resolve(cookies || []))
    })
    if (Array.isArray(list) && list.length > 0) {
      const cookieStr = list.map(c => `${c.name}=${c.value}`).join('; ')
      if (cookieStr) hs.push(`Cookie: ${cookieStr}`)
    }
  } catch (_) {}
  return hs
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'linkcore-download',
    title: chrome.i18n.getMessage('contextMenuDownload'),
    contexts: ['link', 'page', 'selection', 'image', 'video', 'audio']
  })
  try {
    chrome.storage.local.set({ [AUTO_HIJACK_OVERRIDE_KEY]: false }, () => {})
  } catch (e) {}
  // 预探测一次,提升首用体验
  probeRpc()
  // 同步客户端语言
  syncLocaleFromClient()
  // 启动语言监听
  startLocalePolling()
  // 同步客户端扩展配置
  startExtConfigPolling()
})

// 启动时也要启动语言监听
chrome.runtime.onStartup.addListener(() => {
  try {
    chrome.storage.local.set({ [AUTO_HIJACK_OVERRIDE_KEY]: false }, () => {})
  } catch (e) {}
  syncLocaleFromClient()
  startLocalePolling()
  startExtConfigPolling()
})

const getAutoHijackOverride = () => {
  return new Promise((resolve) => {
    chrome.storage.local.get(AUTO_HIJACK_OVERRIDE_KEY, (res) => {
      resolve(!!(res && res[AUTO_HIJACK_OVERRIDE_KEY]))
    })
  })
}

const toggleAutoHijackOverride = async () => {
  const current = await getAutoHijackOverride()
  const next = !current
  await new Promise((resolve) => {
    chrome.storage.local.set({ [AUTO_HIJACK_OVERRIDE_KEY]: next }, () => resolve(true))
  })
  return next
}

if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === 'toggle-bypass-downloads') {
      toggleAutoHijackOverride()
    }
  })
}

// 当前已知的语言,用于检测变化
let lastKnownLocale = null

// 从客户端同步语言设置
const syncLocaleFromClient = async (notifyPopup = false) => {
  try {
    console.log('[Background] Syncing locale from client...')
    const result = await tryChannel('/linkcore/locale', { method: 'GET' }, 2000)
    if (result && result.resp && result.resp.ok) {
      const data = await result.resp.json()
      console.log('[Background] Received locale data:', data)
      if (data && data.locale) {
        const browserLocale = localeMap[data.locale] || localeMap['en-US']
        
        // 检测语言是否变化
        const localeChanged = lastKnownLocale && lastKnownLocale !== data.locale
        
        if (localeChanged) {
          console.log(`[Background] Locale changed: ${lastKnownLocale} -> ${data.locale}`)
        }
        
        lastKnownLocale = data.locale
        
        // 将语言信息存储到 storage,供 popup使用
        await setConfig({ clientLocale: data.locale, browserLocale })
        console.log(`[Background] Locale synced: ${data.locale} -> ${browserLocale}`)
        
        // 更新右键菜单文本
        updateContextMenu(browserLocale)
        
        // 如果语言变化了,通知所有打开的 popup
        if (localeChanged || notifyPopup) {
          notifyLocaleChange(browserLocale)
        }
        
        return { success: true, locale: data.locale, browserLocale }
      } else {
        console.log('[Background] Invalid locale data:', data)
      }
    } else {
      console.log('[Background] Failed to connect to client or invalid response')
    }
  } catch (e) {
    console.log('[Background] Failed to sync locale from client:', e)
  }
  return { success: false }
}

// 通知所有打开的 popup 语言已变化
const notifyLocaleChange = (browserLocale) => {
  console.log('[Background] Notifying popups about locale change:', browserLocale)
  // 向所有扩展页面广播语言变化消息
  chrome.runtime.sendMessage({
    type: 'localeChanged',
    locale: browserLocale
  }).catch(() => {
    // 忽略错误(可能没有打开的popup)
  })
}

// 定期轮询客户端语言
let localePollingTimer = null
const startLocalePolling = () => {
  if (localePollingTimer) {
    clearInterval(localePollingTimer)
  }
  
  // 每2秒检查一次语言变化
  localePollingTimer = setInterval(() => {
    syncLocaleFromClient(false)
  }, 2000)
  
  console.log('[Background] Started locale polling (every 3s)')
}

const stopLocalePolling = () => {
  if (localePollingTimer) {
    clearInterval(localePollingTimer)
    localePollingTimer = null
    console.log('[Background] Stopped locale polling')
  }
}

// 更新右键菜单
const updateContextMenu = (locale) => {
  const menuTexts = {
    en: 'Download with LinkCore',
    zh_CN: '使用 LinkCore 下载',
    zh_TW: '使用 LinkCore 下載',
    ja: 'LinkCore でダウンロード',
    ko: 'LinkCore로 다운로드',
    es: 'Descargar con LinkCore',
    fr: 'Télécharger avec LinkCore',
    de: 'Mit LinkCore herunterladen',
    ru: 'Скачать с LinkCore'
  }
  
  const title = menuTexts[locale] || menuTexts.en
  
  chrome.contextMenus.update('linkcore-download', {
    title: title
  }, () => {
    if (chrome.runtime.lastError) {
      console.log('Context menu update error:', chrome.runtime.lastError)
    }
  })
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'probe') {
    probeRpc().then(ok => sendResponse(ok))
    return true
  }
  
  if (msg && msg.type === 'syncLocale') {
    syncLocaleFromClient(true).then((result) => {
      sendResponse({ ok: result.success, ...result })
    })
    return true
  }
  
  if (msg && msg.type === 'tasks') {
    tryChannel('/linkcore/tasks', { method: 'GET' }, 1000)
      .then(ok => {
        if (!ok) {
          sendResponse({ connected: false, totalSpeed: 0, tasks: [] })
        } else {
          ok.resp.json()
            .then(data => {
              sendResponse({ 
                connected: true, 
                totalSpeed: data.totalSpeed || 0, 
                tasks: data.tasks || [] 
              })
            })
            .catch(() => {
              sendResponse({ connected: false, totalSpeed: 0, tasks: [] })
            })
        }
      })
      .catch(() => {
        sendResponse({ connected: false, totalSpeed: 0, tasks: [] })
      })
    return true
  }
  
  if (msg && msg.type === 'connection') {
    tryChannel('/linkcore/health', { method: 'GET' }, 1000)
      .then(result => {
        sendResponse({ connected: !!(result && result.resp && result.resp.ok) })
      })
      .catch(() => {
        sendResponse({ connected: false })
      })
    return true
  }
  
  if (msg && msg.type === 'version') {
    tryChannel('/linkcore/version', { method: 'GET' }, 1000)
      .then(ok => {
        if (ok && ok.resp && ok.resp.ok) {
          ok.resp.json()
            .then(data => {
              const version = data && data.version ? data.version : ''
              sendResponse({ connected: true, version })
            })
            .catch(() => {
              sendResponse({ connected: false, version: '' })
            })
        } else {
          sendResponse({ connected: false, version: '' })
        }
      })
      .catch(() => {
        sendResponse({ connected: false, version: '' })
      })
    return true
  }

  if (msg && msg.type === 'getExtConfig') {
    sendResponse({
      bypassHotkeyEnabled: !!extConfig.bypassHotkeyEnabled,
      bypassHotkey: extConfig.bypassHotkey || ''
    })
    return true
  }

  if (msg && msg.type === 'toggleAutoHijackOverride') {
    toggleAutoHijackOverride().then((disabled) => {
      sendResponse({ disabled })
    })
    return true
  }

  if (msg && msg.type === 'shiftHotkeyTriggered') {
    if (extConfig && extConfig.shiftToggleEnabled) {
      toggleAutoHijackOverride().then((disabled) => {
        sendResponse({ disabled })
      })
    } else {
      sendResponse({ disabled: null })
    }
    return true
  }
})
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let url = info.linkUrl || info.srcUrl || info.pageUrl
  const referer = tab && tab.url ? tab.url : ''
  if (url) {
    await addUri(url, referer)
  }
})

chrome.downloads.onCreated.addListener((item) => {
  const handleDownloadCreated = async () => {
    const overrideDisabled = await getAutoHijackOverride()
    if (overrideDisabled) {
      return
    }
    const cfg = await getConfig()
    const effectiveAutoHijack = !!cfg.autoHijack || !!extConfig.interceptAllDownloads
    if (!effectiveAutoHijack) return
    const url = item && item.url ? item.url : ''
    if (!url || !/^https?:/i.test(url)) return
    try {
      let name = ''
      if (item && item.filename) {
        name = item.filename
      } else {
        try {
          const u = new URL(url)
          name = u.pathname ? u.pathname.split('/').pop() || '' : ''
        } catch (e) {
          name = ''
        }
      }
      const ext = name && name.indexOf('.') !== -1 ? name.split('.').pop().toLowerCase() : ''
      if (ext && Array.isArray(extConfig.skipFileExtensions) && extConfig.skipFileExtensions.includes(ext)) {
        return
      }
    } catch (e) {
    }
    try {
      const ok = await addUri(url, item.referrer)
      if (ok) {
        chrome.downloads.cancel(item.id)
      }
    } catch (e) {
    }
  }
  handleDownloadCreated()
})
