// 视频资源嗅探器 - 基于文件扩展名检测
(function () {
  'use strict'

  // 调试日志控制
  const DEBUG = false
  const log = (...args) => {
    if (DEBUG) {
      console.log('[Video Sniffer]', ...args)
    }
  }

  log('========== Script loaded! ==========')
  log('Current URL:', window.location.href)
  log('Document ready state:', document.readyState)

  // 默认配置
  let config = {
    enabled: true,
    formats: ['m4s', 'mp4', 'flv', 'm3u8', 'ts'],
    autoCombine: true,
    excludeFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'ico']
  }

  let configLoaded = false

  log('Default config:', config)

  // 存储嗅探到的资源
  const sniffedResources = {
    video: [],
    audio: [],
    combined: []
  }

  // 从应用读取配置
  function loadConfig() {
    log('Loading config from storage...')
    try {
      if (!chrome || !chrome.storage || !chrome.storage.local) {
        console.warn('[Video Sniffer] Chrome storage API not available')
        return
      }
      chrome.storage.local.get(['videoSnifferEnabled', 'videoSnifferFormats', 'videoSnifferAutoCombine'], (result) => {
        log('Storage result:', JSON.stringify(result, null, 2))
        if (chrome.runtime.lastError) {
          console.error('[Video Sniffer] Storage error:', chrome.runtime.lastError)
          return
        }
        let configChanged = false
        if (result.videoSnifferEnabled !== undefined) {
          config.enabled = result.videoSnifferEnabled
          log('Loaded videoSnifferEnabled:', config.enabled)
          configChanged = true
        }
        if (result.videoSnifferFormats && Array.isArray(result.videoSnifferFormats)) {
          const oldFormats = config.formats
          config.formats = result.videoSnifferFormats.map(f => f.toLowerCase())
          log('Loaded videoSnifferFormats:', config.formats, 'Previous:', oldFormats)
          configChanged = true
        } else {
          log('videoSnifferFormats not found or not array in storage, using default:', config.formats)
        }
        if (result.videoSnifferAutoCombine !== undefined) {
          config.autoCombine = result.videoSnifferAutoCombine
          log('Loaded videoSnifferAutoCombine:', config.autoCombine)
          configChanged = true
        }
        log('Final config after loading:', JSON.stringify(config, null, 2))

        if (configChanged) {
          configLoaded = true
          log('Config loaded from storage, marking as loaded and rechecking all resources')
          sniffedResources.video = []
          sniffedResources.audio = []
          sniffedResources.combined = []

          const resources = window.performance.getEntriesByType('resource')
          log('Rechecking', resources.length, 'resources after loading config')
          resources.forEach(entry => {
            addResource(entry.name)
          })
          checkMediaElements()
        }
      })
    } catch (e) {
      console.error('[Video Sniffer] Failed to load config:', e)
    }
  }

  // 监听配置变化
  try {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        log('Storage changed:', changes, namespace)
        if (namespace === 'local') {
          let configChanged = false
          if (changes.videoSnifferEnabled) {
            config.enabled = changes.videoSnifferEnabled.newValue
            log('videoSnifferEnabled changed to:', config.enabled)
            configChanged = true
          }
          if (changes.videoSnifferFormats) {
            const oldFormats = config.formats
            config.formats = changes.videoSnifferFormats.newValue.map(f => f.toLowerCase())
            log('videoSnifferFormats changed from:', oldFormats, 'to:', config.formats)
            configChanged = true
          }
          if (changes.videoSnifferAutoCombine) {
            config.autoCombine = changes.videoSnifferAutoCombine.newValue
            log('videoSnifferAutoCombine changed to:', config.autoCombine)
            configChanged = true
          }
          log('Config updated:', config)

          if (configChanged) {
            log('Config changed, clearing all sniffed resources')
            sniffedResources.video = []
            sniffedResources.audio = []
            sniffedResources.combined = []
            updateUI()

            log('Rechecking all resources after config change')
            const resources = window.performance.getEntriesByType('resource')
            log('Found', resources.length, 'resources in performance API')
            resources.forEach(entry => {
              addResource(entry.name)
            })
            checkMediaElements()
            log('Config change handling complete')
          }
        }
      })
    }
  } catch (e) {
    console.error('[Video Sniffer] Failed to setup storage listener:', e)
  }

  // 从URL提取文件扩展名
  function getExtension(url) {
    try {
      const urlWithoutQuery = url.split('?')[0].split('#')[0]
      const atIndex = urlWithoutQuery.lastIndexOf('@.')
      if (atIndex !== -1) {
        const extAfterAt = urlWithoutQuery.substring(atIndex + 2).toLowerCase()
        if (extAfterAt) return extAfterAt
      }

      // 只在路径部分查找扩展名，避免误判域名中的点
      const urlObj = new URL(url)
      const pathname = urlObj.pathname

      const lastDotIndex = pathname.lastIndexOf('.')
      if (lastDotIndex === -1) return ''

      const ext = pathname.substring(lastDotIndex + 1).toLowerCase()
      const slashIndex = ext.indexOf('/')
      if (slashIndex !== -1) {
        return ext.substring(0, slashIndex)
      }
      return ext
    } catch (e) {
      return ''
    }
  }

  // 从MIME类型获取扩展名
  function getExtensionFromMimeType(mimeType) {
    if (!mimeType) return ''
    const mimeToExt = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
      'video/x-flv': 'flv',
      'video/x-matroska': 'mkv',
      'video/3gpp': '3gp',
      'video/3gpp2': '3g2',
      'video/mp2t': 'ts',
      'video/x-m4v': 'm4v',
      'video/x-mpeg': 'mpeg',
      'video/x-ms-wmv': 'wmv',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/mp3': 'mp3',
      'audio/webm': 'webm',
      'audio/ogg': 'oga',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/x-ms-wma': 'wma',
      'audio/x-aac': 'aac',
      'audio/aac': 'aac',
      'application/x-mpegURL': 'm3u8',
      'application/vnd.apple.mpegurl': 'm3u8',
      'application/dash+xml': 'mpd'
    }
    return mimeToExt[mimeType.toLowerCase().split(';')[0]] || ''
  }

  // 从URL参数中提取mime_type
  function getExtensionFromUrlParams(url) {
    try {
      const urlObj = new URL(url)
      const mimeType = urlObj.searchParams.get('mime_type')
      if (mimeType) {
        const mimeToExt = {
          'video_mp4': 'mp4',
          'video_webm': 'webm',
          'video_ogg': 'ogv',
          'video_mov': 'mov',
          'video_avi': 'avi',
          'video_flv': 'flv',
          'video_mkv': 'mkv',
          'video_3gp': '3gp',
          'video_3g2': '3g2',
          'video_ts': 'ts',
          'video_m4v': 'm4v',
          'video_mpeg': 'mpeg',
          'video_wmv': 'wmv',
          'audio_mp3': 'mp3',
          'audio_m4a': 'm4a',
          'audio_aac': 'aac',
          'audio_ogg': 'oga',
          'audio_wav': 'wav',
          'audio_wma': 'wma',
          'audio_webm': 'webm'
        }
        const ext = mimeToExt[mimeType.toLowerCase()]
        if (ext) {
          log('Found mime_type in URL params:', mimeType, '->', ext)
          return ext
        }
      }
      return ''
    } catch (e) {
      return ''
    }
  }

  // 检查URL是否应该被嗅探
  function shouldSniff(url, mimeType) {
    if (!configLoaded) {
      log('Config not loaded yet, skipping:', url.substring(0, 100))
      return false
    }
    if (!config.enabled || !url) return false

    const lowerUrl = url.toLowerCase()

    // 跳过blob URL（浏览器内部使用的临时URL）
    if (lowerUrl.startsWith('blob:')) {
      return false
    }

    if (lowerUrl.includes('/log/') ||
      lowerUrl.includes('/api/') ||
      lowerUrl.includes('/stat') ||
      lowerUrl.includes('analytics') ||
      lowerUrl.includes('tracking') ||
      lowerUrl.includes('beacon') ||
      lowerUrl.includes('metric')) {
      return false
    }

    let ext = ''

    // 优先使用 MIME 类型检测（更准确）
    if (mimeType) {
      ext = getExtensionFromMimeType(mimeType)
      if (ext) {
        log('Extension from MIME type:', mimeType, '->', ext, 'URL:', url.substring(0, 100))
      }
    }

    // 如果 MIME 类型没有提供扩展名，尝试从 URL 获取
    if (!ext) {
      ext = getExtension(url)
    }

    // 如果还是没有扩展名，尝试从 URL 参数中的 mime_type 获取
    if (!ext) {
      ext = getExtensionFromUrlParams(url)
    }

    if (!ext) {
      // 只在调试模式下输出，并且过滤空 URL
      if (DEBUG && url && url.length > 0) {
        log('No extension found for:', url.substring(0, 100), 'MIME:', mimeType || 'none')
      }
      return false
    }

    if (config.excludeFormats.includes(ext)) {
      log('Excluded format:', ext, url.substring(0, 100))
      return false
    }

    const shouldSniff = config.formats.includes(ext)
    if (!shouldSniff) {
      log('Format not in list:', ext, 'Available:', config.formats.join(', '), 'URL:', url.substring(0, 100))
    } else {
      log('Format matched:', ext, 'URL:', url.substring(0, 100))
    }
    return shouldSniff
  }

  // 解析资源信息
  function parseResource(url, mimeType, size) {
    // 优先使用 MIME 类型获取扩展名（更准确）
    let ext = ''
    if (mimeType) {
      ext = getExtensionFromMimeType(mimeType)
      if (ext) {
        log('Using extension from MIME type for parsing:', mimeType, '->', ext)
      }
    }

    // 如果 MIME 类型没有提供扩展名，从 URL 获取
    if (!ext) {
      ext = getExtension(url)
    }

    // 如果还是没有，尝试从 URL 参数获取
    if (!ext) {
      ext = getExtensionFromUrlParams(url)
    }

    const info = {
      url: url,
      ext: ext || 'video',
      type: 'video',
      quality: '',
      size: 0,
      name: '',
      timestamp: Date.now()
    }

    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const parts = pathname.split('/')
      let baseName = parts[parts.length - 1] || 'unknown'

      // 如果文件名没有正确的扩展名，但我们从 MIME 类型得到了扩展名
      if (ext && baseName && !baseName.toLowerCase().endsWith('.' + ext.toLowerCase())) {
        // 移除原有的错误扩展名（如果有）
        const lastDotIndex = baseName.lastIndexOf('.')
        if (lastDotIndex > 0) {
          // 检查是否是有效的扩展名
          const currentExt = baseName.substring(lastDotIndex + 1).toLowerCase()
          // 如果当前扩展名不在配置的格式列表中，就移除它
          if (!config.formats.includes(currentExt)) {
            baseName = baseName.substring(0, lastDotIndex)
          }
        }
        // 添加正确的扩展名
        info.name = baseName + '.' + ext
        log('文件名更新:', baseName, '->', info.name, '(使用 MIME 类型的扩展名:', ext + ')')
      } else {
        info.name = baseName
      }

      if (ext === 'm4s') {
        const u = new URL(url)
        const host = u.hostname
        if (host.endsWith('.bilivideo.com') || host.endsWith('.hdslb.com')) {
        const qualityMap = {
          '100027': '8K', '100026': '1080P', '100025': '4K', '100024': '720P',
          '100023': '480P', '100022': '360P', '100021': '240P',
          '30127': '8K', '30126': 'Dolby', '30125': 'HDR', '30120': '4K',
          '30116': '1080P60', '30112': '1080P+', '30080': '1080P',
          '30074': '720P60', '30064': '720P', '30032': '480P',
          '30016': '360P', '30006': '240P', '30280': 'Audio'
        }

        let qualityFound = false
        for (const [code, quality] of Object.entries(qualityMap)) {
          if (url.includes(code)) {
            info.quality = quality
            qualityFound = true
            break
          }
        }

        if (url.includes('audio') || url.includes('-30280.m4s') || url.includes('/audio/') || info.quality === 'Audio') {
          info.type = 'audio'
          if (!qualityFound) info.quality = 'Audio'
        } else if (!qualityFound) {
          const match = url.match(/-(\d+)\.m4s/)
          if (match) {
            info.quality = match[1]
          } else {
            info.quality = 'Unknown'
          }
        }

        const params = new URLSearchParams(urlObj.search)
        if (params.has('len')) {
          info.size = parseInt(params.get('len')) || 0
        }
        }
      } else {
        info.quality = ext.toUpperCase()
        info.type = 'video'
      }

      // 如果传入了有效的大小，使用传入的大小（优先级高于URL参数）
      if (size && size > 0) {
        info.size = size
      }
    } catch (e) {
      console.error('[Video Sniffer] Parse error:', e)
    }

    return info
  }

  // 合并M4S格式的音视频流
  function combineM4SStreams() {
    const combined = []
    const videoStreams = sniffedResources.video.filter(r => r.ext === 'm4s')
    const audioStreams = sniffedResources.audio.filter(r => r.ext === 'm4s')

    videoStreams.forEach(video => {
      const matchedAudio = audioStreams.find(audio => {
        const timeDiff = Math.abs(video.timestamp - audio.timestamp)
        return timeDiff < 5000
      })

      if (matchedAudio) {
        combined.push({
          quality: video.quality,
          videoUrl: video.url,
          audioUrl: matchedAudio.url,
          name: `${video.quality} 视频`,
          timestamp: video.timestamp,
          size: (video.size || 0) + (matchedAudio.size || 0)
        })
      }
    })

    return combined
  }

  // 添加资源
  function addResource(url, mimeType, size) {
    if (!shouldSniff(url, mimeType)) return

    const exists = sniffedResources.video.some(r => r.url === url) ||
      sniffedResources.audio.some(r => r.url === url)
    if (exists) return

    const info = parseResource(url, mimeType, size)

    if (info.type === 'audio') {
      sniffedResources.audio.push(info)
      log('✓ Audio detected:', info.quality, info.name, url.substring(0, 100))
    } else {
      sniffedResources.video.push(info)
      log('✓ Video detected:', info.quality, info.name, url.substring(0, 100))
    }

    updateUI()
  }

  // 更新UI显示
  function updateUI() {
    let m4sResources = []
    const videoM4S = sniffedResources.video.filter(r => r.ext === 'm4s')
    const audioM4S = sniffedResources.audio.filter(r => r.ext === 'm4s')
    m4sResources = [...videoM4S, ...audioM4S]

    if (config.autoCombine) {
      const combined = combineM4SStreams()
      sniffedResources.combined = combined
    }

    const totalCount = sniffedResources.video.length + sniffedResources.audio.length

    log('UI Update:', {
      video: sniffedResources.video.length,
      audio: sniffedResources.audio.length,
      m4s: m4sResources.length,
      combined: sniffedResources.combined.length,
      total: totalCount
    })

    const event = new CustomEvent('linkcore-resources-updated', {
      detail: {
        video: sniffedResources.video,
        audio: sniffedResources.audio,
        m4s: m4sResources,
        combined: sniffedResources.combined,
        total: totalCount
      }
    })
    log('Dispatching event to document with total:', totalCount)
    document.dispatchEvent(event)
    log('Event dispatched')

    // 如果在 iframe 中，向父窗口发送消息
    try {
      if (window.top !== window) {
        console.log('[Video Sniffer] In iframe, sending message to parent')
        window.top.postMessage({
          type: 'linkcore-resources-updated',
          data: {
            video: sniffedResources.video,
            audio: sniffedResources.audio,
            m4s: m4sResources,
            combined: sniffedResources.combined,
            total: totalCount
          }
        }, '*')
      }
    } catch (e) {
      console.log('[Video Sniffer] Cannot access parent window:', e)
    }
  }

  // 拦截 XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url
    this._mimeType = null
    return originalXHROpen.apply(this, arguments)
  }

  const originalXHRSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function () {
    if (this._url) {
      const xhr = this
      const originalOnReadyStateChange = xhr.onreadystatechange
      xhr.onreadystatechange = function () {
        if (xhr.readyState === xhr.HEADERS_RECEIVED) {
          const contentType = xhr.getResponseHeader('Content-Type')
          const contentLength = xhr.getResponseHeader('Content-Length')
          if (contentType) {
            xhr._mimeType = contentType
          }
          if (contentLength) {
            xhr._size = parseInt(contentLength) || 0
          }
        }
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.apply(xhr, arguments)
        }
      }
      addResource(xhr._url, xhr._mimeType, xhr._size)
    }
    return originalXHRSend.apply(this, arguments)
  }

  // 拦截 Fetch API
  const originalFetch = window.fetch
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input.url || '')
    if (url) {
      const ext = getExtension(url)

      // 获取响应并检查Content-Type和Content-Length
      const fetchPromise = originalFetch.apply(this, arguments)
      fetchPromise.then(response => {
        const contentType = response.headers.get('Content-Type')
        const contentLength = response.headers.get('Content-Length')
        const size = contentLength ? parseInt(contentLength) || 0 : 0
        if (contentType) {
          addResource(url, contentType, size)
        } else {
          addResource(url, null, size)
        }
      }).catch((error) => {
        addResource(url)
      })

      return fetchPromise
    }
    return originalFetch.apply(this, arguments)
  }

  console.log('[Video Sniffer] Network interceptors installed')

  // 使用 PerformanceObserver
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // 跳过blob URL
        if (entry.name.toLowerCase().startsWith('blob:')) {
          continue
        }
        if (entry.initiatorType === 'xmlhttprequest' ||
          entry.initiatorType === 'fetch' ||
          entry.initiatorType === 'video' ||
          entry.initiatorType === 'audio') {
          addResource(entry.name)
        }
      }
    })
    observer.observe({ entryTypes: ['resource'] })
    console.log('[Video Sniffer] PerformanceObserver installed')
  } catch (e) {
    console.log('[Video Sniffer] PerformanceObserver not available')
  }

  // 检查已加载的资源
  function checkExistingResources() {
    if (!configLoaded) {
      console.log('[Video Sniffer] Config not loaded yet, skipping existing resources check')
      return
    }
    if (window.performance && window.performance.getEntriesByType) {
      const resources = window.performance.getEntriesByType('resource')
      console.log('[Video Sniffer] Checking', resources.length, 'existing resources')
      resources.forEach(entry => {
        // 跳过blob URL
        if (!entry.name.toLowerCase().startsWith('blob:')) {
          addResource(entry.name)
        }
      })
    }
  }

  // 检查媒体元素
  function checkMediaElements() {
    if (!configLoaded) {
      console.log('[Video Sniffer] Config not loaded yet, skipping media elements check')
      return
    }
    const mediaElements = document.querySelectorAll('video, audio')
    mediaElements.forEach(element => {
      const mimeType = element.getAttribute('type') || ''
      if (element.src) {
        const src = element.src
        console.log('[Video Sniffer] Found media src:', src.substring(0, 150), 'type:', mimeType)
        // 跳过blob URL
        if (!src.toLowerCase().startsWith('blob:')) {
          addResource(src, mimeType)
        }
      }
      if (element.currentSrc) {
        const src = element.currentSrc
        console.log('[Video Sniffer] Found media currentSrc:', src.substring(0, 150), 'type:', mimeType)
        // 跳过blob URL
        if (!src.toLowerCase().startsWith('blob:')) {
          addResource(src, mimeType)
        }
      }
      const sources = element.querySelectorAll('source')
      sources.forEach(source => {
        const sourceMimeType = source.getAttribute('type') || ''
        if (source.src) {
          const src = source.src
          console.log('[Video Sniffer] Found source src:', src.substring(0, 150), 'type:', sourceMimeType)
          // 跳过blob URL
          if (!src.toLowerCase().startsWith('blob:')) {
            addResource(src, sourceMimeType)
          }
        }
      })
    })
  }

  // 更频繁地检查媒体元素（每秒一次）
  setInterval(checkMediaElements, 1000)

  if (document.readyState === 'complete') {
    setTimeout(checkMediaElements, 200)
  } else {
    window.addEventListener('load', () => {
      setTimeout(checkMediaElements, 200)
    })
  }

  // 监听 video 元素的 loadstart 事件
  const observeVideoElements = () => {
    const videos = document.querySelectorAll('video')
    videos.forEach(video => {
      if (!video._linkcoreObserved) {
        video._linkcoreObserved = true
        const mimeType = video.getAttribute('type') || ''
        video.addEventListener('loadstart', () => {
          const src = video.src || video.currentSrc
          console.log('[Video Sniffer] Video loadstart, src:', src, 'type:', mimeType)
          // 跳过blob URL
          if (src && !src.toLowerCase().startsWith('blob:')) {
            addResource(src, mimeType)
          }
        })
        video.addEventListener('play', () => {
          const src = video.src || video.currentSrc
          console.log('[Video Sniffer] Video play, src:', src, 'type:', mimeType)
          // 跳过blob URL
          if (src && !src.toLowerCase().startsWith('blob:')) {
            addResource(src, mimeType)
          }
        })
      }
    })
  }

  setInterval(observeVideoElements, 1000)

  // 使用 MutationObserver 监听 DOM 变化
  const domObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
            console.log('[Video Sniffer] New media element added:', node.tagName)
            observeVideoElements()
            checkMediaElements()
          }
          // 检查子元素
          const mediaElements = node.querySelectorAll && node.querySelectorAll('video, audio')
          if (mediaElements && mediaElements.length > 0) {
            console.log('[Video Sniffer] New media elements found:', mediaElements.length)
            observeVideoElements()
            checkMediaElements()
          }
        }
      })
    })
  })

  domObserver.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  })
  console.log('[Video Sniffer] MutationObserver installed')

  // 监听资源请求
  window.addEventListener('linkcore-get-resources', () => {
    console.log('[Video Sniffer] Resource request received')
    updateUI()
  })

  // 监听清除资源事件（当切换到不同的视频预览时触发）
  window.addEventListener('linkcore-clear-resources', () => {
    console.log('[Video Sniffer] Clear resources request received')
    sniffedResources.video = []
    sniffedResources.audio = []
    sniffedResources.combined = []
    updateUI()
  })

  // 延迟加载配置
  setTimeout(() => {
    console.log('[Video Sniffer] Loading config...')
    loadConfig()
  }, 100)

  // 确保在页面完全加载后再次检查配置
  window.addEventListener('load', () => {
    console.log('[Video Sniffer] Page loaded, reloading config...')
    loadConfig()
  })

  console.log('[Video Sniffer] ========== Initialization complete ==========')
})()
