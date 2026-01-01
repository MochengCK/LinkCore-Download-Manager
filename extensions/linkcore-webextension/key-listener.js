const matchHotkey = (event) => {
  if (!event) return false
  if (event.shiftKey) return true
  const key = (event.key || '').toLowerCase()
  return key === 'shift'
}

const sendToggleAutoHijackOverride = () => {
  try {
    chrome.runtime.sendMessage({ type: 'shiftHotkeyTriggered' }, () => { })
  } catch (e) {
  }
}

const buttonLocaleTexts = {
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

const normalizeButtonLocale = (locale) => {
  const s = `${locale || ''}`.toLowerCase()
  if (!s) return ''
  if (s.startsWith('zh-cn') || s.startsWith('zh_cn')) return 'zh_CN'
  if (s.startsWith('zh-tw') || s.startsWith('zh_tw')) return 'zh_TW'
  if (s.startsWith('ja')) return 'ja'
  if (s.startsWith('ko')) return 'ko'
  if (s.startsWith('es')) return 'es'
  if (s.startsWith('fr')) return 'fr'
  if (s.startsWith('de')) return 'de'
  if (s.startsWith('ru')) return 'ru'
  if (s.startsWith('en')) return 'en'
  return ''
}

const applyClientLocaleToButton = (btn) => {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.local) return
    chrome.storage.local.get(['browserLocale'], (result) => {
      const raw = result && result.browserLocale ? result.browserLocale : ''
      const direct = buttonLocaleTexts[raw]
      const key = direct ? raw : normalizeButtonLocale(raw)
      const text = buttonLocaleTexts[key]
      if (text) {
        btn.textContent = text
        btn.title = text
      }
    })
  } catch (e) {
  }
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('keydown', (event) => {
    if (matchHotkey(event)) {
      sendToggleAutoHijackOverride()
    }
  }, true)

  window.addEventListener('click', (event) => {
    if (matchHotkey(event)) {
      sendToggleAutoHijackOverride()
    }
  }, true)

  const isTopWindow = () => {
    try {
      return window.top === window
    } catch (e) {
      return true
    }
  }

  const isBilibiliVideoPage = (url) => {
    const s = (url || window.location.href || '').trim()
    if (!s) return false
    try {
      const u = new URL(s)
      const host = (u.hostname || '').toLowerCase()
      const path = (u.pathname || '').toLowerCase()
      if (!host) return false
      const isBilibiliHost = host === 'bilibili.com' ||
        host === 'www.bilibili.com' ||
        host.endsWith('.bilibili.com')
      const isShort = host === 'b23.tv' || host === 'www.b23.tv'
      if (isShort) return true
      if (!isBilibiliHost) return false
      if (path.startsWith('/video/')) return true
      if (path.startsWith('/bangumi/')) return true
      if (path.startsWith('/cheese/')) return true
      return false
    } catch (e) {
      return false
    }
  }

  // 存储嗅探到的视频资源
  let sniffedResources = {
    video: [],
    audio: [],
    m4s: [],
    combined: [], // 组合的视频（视频流+音频流）
    total: 0
  }

  // 调试日志控制
  const DEBUG = false
  const log = (...args) => {
    if (DEBUG) {
      console.log('[Key Listener]', ...args)
    }
  }

  // 监听视频资源更新事件
  log('Setting up event listeners...')

  // 只在 document 上监听（因为 video-sniffer.js 在 document 上触发）
  document.addEventListener('linkcore-resources-updated', (event) => {
    log('Resources updated:', event.detail)
    sniffedResources = event.detail || { video: [], audio: [], m4s: [], combined: [], total: 0 }
    log('Total resources:', sniffedResources.total)
    updateBilibiliButtonVisibility()
  })

  // 监听来自 iframe 的消息
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'linkcore-resources-updated') {
      log('Received message from iframe:', event.data.data)
      sniffedResources = event.data.data || { video: [], audio: [], m4s: [], combined: [], total: 0 }
      log('Total resources from iframe:', sniffedResources.total)
      updateBilibiliButtonVisibility()
    }
  })

  // 监听清除资源事件
  window.addEventListener('linkcore-clear-resources', () => {
    log('Clearing resources')
    log('Resources before clear:', JSON.stringify(sniffedResources))
    sniffedResources = {
      video: [],
      audio: [],
      m4s: [],
      combined: [],
      total: 0
    }
    log('Resources after clear:', JSON.stringify(sniffedResources))
    updateBilibiliButtonVisibility()
  })

  log('Event listeners registered')

  const sendBilibiliPageToClient = () => {
    try {
      const url = window.location.href || ''
      if (!url || !/^https?:/i.test(url)) return
      const referer = url
      chrome.runtime.sendMessage({ type: 'addUriFromContent', url, referer }, () => { })
    } catch (e) {
    }
  }

  const sendResourceToClient = (url, referer, suggestedFilename) => {
    try {
      if (!url || !/^https?:/i.test(url)) return
      const message = {
        type: 'addUriFromContent',
        url,
        referer
      }
      // 如果有建议的文件名，添加到消息中
      if (suggestedFilename) {
        message.suggestedFilename = suggestedFilename
      }
      chrome.runtime.sendMessage(message, () => { })
    } catch (e) {
    }
  }

  // 创建资源选择下拉框
  const createResourceDropdown = () => {
    const dropdown = document.createElement('div')
    dropdown.id = 'linkcore-resource-dropdown'
    const dStyle = dropdown.style
    dStyle.position = 'fixed'  // 使用 fixed 定位，不受容器限制
    dStyle.top = '0'
    dStyle.left = '0'
    dStyle.marginTop = '0'
    dStyle.width = '400px'
    dStyle.maxHeight = '400px'
    dStyle.backgroundColor = '#ffffff'
    dStyle.borderRadius = '6px'
    dStyle.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
    dStyle.zIndex = '999999'
    dStyle.display = 'none'
    dStyle.flexDirection = 'column'
    dStyle.overflow = 'hidden'
    dStyle.border = '1px solid #e5e5e5'

    // 内容区域
    const content = document.createElement('div')
    content.id = 'linkcore-resource-list'
    const cStyle = content.style
    cStyle.maxHeight = '400px'
    cStyle.overflowY = 'auto'
    cStyle.overflowX = 'hidden'

    dropdown.appendChild(content)

    return dropdown
  }

  // 更新资源列表
  const updateResourceList = () => {
    log('Updating resource list, resources:', JSON.stringify(sniffedResources))
    log('Video count:', sniffedResources.video?.length || 0)
    log('Audio count:', sniffedResources.audio?.length || 0)
    log('M4S count:', sniffedResources.m4s?.length || 0)
    log('Combined count:', sniffedResources.combined?.length || 0)
    const content = document.getElementById('linkcore-resource-list')
    if (!content) {
      log('Resource list container not found')
      return
    }

    content.innerHTML = ''

    const referer = window.location.href

    // 优先显示组合的DASH视频（视频+音频）
    if (sniffedResources.combined && sniffedResources.combined.length > 0) {
      const combinedSection = document.createElement('div')

      const combinedTitle = document.createElement('div')
      combinedTitle.textContent = 'DASH 完整视频 (视频+音频)'
      combinedTitle.style.fontSize = '12px'
      combinedTitle.style.fontWeight = 'bold'
      combinedTitle.style.padding = '10px 12px 5px'
      combinedTitle.style.color = '#00a1d6'
      combinedTitle.style.backgroundColor = '#f5f5f5'
      combinedSection.appendChild(combinedTitle)

      sniffedResources.combined.forEach((resource, index) => {
        const item = createCombinedResourceItem(resource, referer, index)
        combinedSection.appendChild(item)
      })

      content.appendChild(combinedSection)
    }

    // 显示 M4S 资源（B站 DASH 视频）
    if (sniffedResources.m4s && sniffedResources.m4s.length > 0) {
      const m4sSection = document.createElement('div')

      const m4sTitle = document.createElement('div')
      m4sTitle.textContent = 'DASH 单独流'
      m4sTitle.style.fontSize = '12px'
      m4sTitle.style.fontWeight = 'bold'
      m4sTitle.style.padding = '10px 12px 5px'
      m4sTitle.style.color = '#999'
      m4sTitle.style.backgroundColor = '#f5f5f5'
      m4sSection.appendChild(m4sTitle)

      sniffedResources.m4s.forEach((resource, index) => {
        const item = createResourceItem(resource, referer, index)
        m4sSection.appendChild(item)
      })

      content.appendChild(m4sSection)
    }

    // 显示普通视频资源
    if (sniffedResources.video && sniffedResources.video.length > 0) {
      const videoSection = document.createElement('div')

      const videoTitle = document.createElement('div')
      videoTitle.textContent = '视频资源'
      videoTitle.style.fontSize = '12px'
      videoTitle.style.fontWeight = 'bold'
      videoTitle.style.padding = '10px 12px 5px'
      videoTitle.style.color = '#333'
      videoTitle.style.backgroundColor = '#f5f5f5'
      videoSection.appendChild(videoTitle)

      sniffedResources.video.forEach((resource, index) => {
        if (!resource.url.includes('.m4s')) { // 排除已在M4S区显示的
          const item = createResourceItem(resource, referer, index)
          videoSection.appendChild(item)
        }
      })

      if (videoSection.children.length > 1) { // 除了标题还有其他内容
        content.appendChild(videoSection)
      }
    }

    // 显示音频资源
    if (sniffedResources.audio && sniffedResources.audio.length > 0) {
      const audioSection = document.createElement('div')

      const audioTitle = document.createElement('div')
      audioTitle.textContent = '音频资源'
      audioTitle.style.fontSize = '12px'
      audioTitle.style.fontWeight = 'bold'
      audioTitle.style.padding = '10px 12px 5px'
      audioTitle.style.color = '#333'
      audioTitle.style.backgroundColor = '#f5f5f5'
      audioSection.appendChild(audioTitle)

      sniffedResources.audio.forEach((resource, index) => {
        if (!resource.url.includes('.m4s')) { // 排除已在M4S区显示的
          const item = createResourceItem(resource, referer, index)
          audioSection.appendChild(item)
        }
      })

      if (audioSection.children.length > 1) {
        content.appendChild(audioSection)
      }
    }

    if (content.children.length === 0) {
      const noData = document.createElement('div')
      noData.style.textAlign = 'center'
      noData.style.color = '#999'
      noData.style.padding = '20px'
      noData.style.fontSize = '12px'

      const tip1 = document.createElement('div')
      tip1.textContent = '未检测到视频资源'
      tip1.style.marginBottom = '8px'

      const tip2 = document.createElement('div')
      tip2.textContent = '提示：右键点击页面上的链接，选择"使用 LinkCore 下载"'
      tip2.style.color = '#666'
      tip2.style.fontSize = '11px'

      noData.appendChild(tip1)
      noData.appendChild(tip2)
      content.appendChild(noData)
    }
  }

  // 创建组合资源项（视频+音频）
  const createCombinedResourceItem = (resource, referer, index) => {
    const item = document.createElement('div')
    const iStyle = item.style
    iStyle.padding = '8px 12px'
    iStyle.borderBottom = '1px solid #f0f0f0'
    iStyle.backgroundColor = '#ffffff'
    iStyle.cursor = 'pointer'
    iStyle.transition = 'background-color 0.2s ease'
    iStyle.fontSize = '12px'

    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = '#f5f5f5'
    })
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = '#ffffff'
    })

    const info = document.createElement('div')
    info.style.display = 'flex'
    info.style.justifyContent = 'space-between'
    info.style.alignItems = 'center'
    info.style.marginBottom = '4px'

    // 生成友好的文件名（与普通资源项相同的逻辑）
    let displayName = ''
    try {
      // 尝试从页面标题获取
      const pageTitle = document.title || window.top.document.title || ''
      const ext = 'DASH'

      if (pageTitle) {
        // 清理标题，移除常见后缀
        let cleanTitle = pageTitle
          .replace(/\s*[-_│|]\s*在线播放.*$/i, '')
          .replace(/\s*[-_│|]\s*在线观看.*$/i, '')
          .replace(/\s*[-_│|]\s*樱花动漫.*$/i, '')
          .replace(/\s*[-_│|]\s*\w+视频.*$/i, '')
          .trim()

        if (cleanTitle) {
          displayName = `${cleanTitle}, ${ext}完整视频`
          // 如果有质量信息，添加到文件名
          if (resource.quality) {
            displayName = `${cleanTitle}, ${resource.quality}, ${ext}完整视频`
          }
        } else {
          displayName = resource.name || `完整视频 ${index + 1}`
        }
      } else {
        displayName = resource.name || `完整视频 ${index + 1}`
      }
    } catch (e) {
      displayName = resource.name || `完整视频 ${index + 1}`
    }

    const name = document.createElement('div')
    name.textContent = displayName
    name.style.fontSize = '12px'
    name.style.fontWeight = '500'
    name.style.color = '#333'
    name.style.flex = '1'
    name.style.overflow = 'hidden'
    name.style.textOverflow = 'ellipsis'
    name.style.whiteSpace = 'nowrap'
    name.style.marginRight = '8px'

    const badges = document.createElement('div')
    badges.style.display = 'flex'
    badges.style.gap = '4px'
    badges.style.flexShrink = '0'

    // 质量徽章
    if (resource.quality) {
      const quality = document.createElement('span')
      quality.textContent = resource.quality
      quality.style.fontSize = '11px'
      quality.style.color = '#00a1d6'
      quality.style.fontWeight = 'bold'
      quality.style.padding = '2px 6px'
      quality.style.backgroundColor = '#e6f7ff'
      quality.style.borderRadius = '3px'
      badges.appendChild(quality)
    }

    // 完整标记
    const completeTag = document.createElement('span')
    completeTag.textContent = '完整'
    completeTag.style.fontSize = '11px'
    completeTag.style.color = '#52c41a'
    completeTag.style.fontWeight = 'bold'
    completeTag.style.padding = '2px 6px'
    completeTag.style.backgroundColor = '#f6ffed'
    completeTag.style.borderRadius = '3px'
    badges.appendChild(completeTag)

    // 文件大小
    if (resource.size && resource.size > 0) {
      const size = document.createElement('span')
      const sizeText = resource.size > 1024 * 1024
        ? `${(resource.size / 1024 / 1024).toFixed(2)}MB`
        : `${(resource.size / 1024).toFixed(2)}KB`
      size.textContent = sizeText
      size.style.fontSize = '11px'
      size.style.color = '#666'
      size.style.padding = '2px 6px'
      size.style.backgroundColor = '#f0f0f0'
      size.style.borderRadius = '3px'
      badges.appendChild(size)
    }

    info.appendChild(name)
    info.appendChild(badges)

    const desc = document.createElement('div')
    desc.textContent = '视频流 + 音频流 (自动下载两个文件)'
    desc.style.fontSize = '10px'
    desc.style.color = '#52c41a'
    desc.style.marginBottom = '2px'

    item.appendChild(info)
    item.appendChild(desc)

    item.addEventListener('click', () => {
      // 生成建议的文件名
      let videoFilename = ''
      let audioFilename = ''
      try {
        const pageTitle = document.title || window.top.document.title || ''

        if (pageTitle) {
          let cleanTitle = pageTitle
            .replace(/\s*[-_│|]\s*在线播放.*$/i, '')
            .replace(/\s*[-_│|]\s*在线观看.*$/i, '')
            .replace(/\s*[-_│|]\s*樱花动漫.*$/i, '')
            .replace(/\s*[-_│|]\s*\w+视频.*$/i, '')
            .replace(/[<>:"/\\|?*]/g, '_')  // 替换非法文件名字符
            .trim()

          if (cleanTitle) {
            // 视频流文件名
            videoFilename = `${cleanTitle}_视频.m4s`
            // 音频流文件名
            audioFilename = `${cleanTitle}_音频.m4s`
          }
        }
      } catch (e) {
      }

      // 同时下载视频和音频
      sendResourceToClient(resource.videoUrl, referer, videoFilename)
      setTimeout(() => {
        sendResourceToClient(resource.audioUrl, referer, audioFilename)
      }, 100)
      const dropdown = document.getElementById('linkcore-resource-dropdown')
      if (dropdown) dropdown.style.display = 'none'
    })

    return item
  }

  // 创建资源项
  const createResourceItem = (resource, referer, index) => {
    const item = document.createElement('div')
    const iStyle = item.style
    iStyle.padding = '8px 12px'
    iStyle.borderBottom = '1px solid #f0f0f0'
    iStyle.backgroundColor = '#ffffff'
    iStyle.cursor = 'pointer'
    iStyle.transition = 'background-color 0.2s ease'
    iStyle.fontSize = '12px'

    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = '#f5f5f5'
    })
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = '#ffffff'
    })

    const info = document.createElement('div')
    info.style.display = 'flex'
    info.style.justifyContent = 'space-between'
    info.style.alignItems = 'center'
    info.style.marginBottom = '4px'

    // 生成友好的文件名
    let displayName = ''
    try {
      // 尝试从页面标题获取
      const pageTitle = document.title || window.top.document.title || ''
      const ext = resource.ext ? resource.ext.toUpperCase() : 'VIDEO'

      if (pageTitle) {
        // 清理标题，移除常见后缀
        let cleanTitle = pageTitle
          .replace(/\s*[-_│|]\s*在线播放.*$/i, '')
          .replace(/\s*[-_│|]\s*在线观看.*$/i, '')
          .replace(/\s*[-_│|]\s*樱花动漫.*$/i, '')
          .replace(/\s*[-_│|]\s*\w+视频.*$/i, '')
          .trim()

        if (cleanTitle) {
          displayName = `${cleanTitle}, ${ext}文件`
          // 如果有质量信息，添加到文件名
          if (resource.quality && resource.quality !== ext) {
            displayName = `${cleanTitle}, ${resource.quality}, ${ext}文件`
          }
        } else {
          displayName = resource.name || `${ext} ${index + 1}`
        }
      } else {
        displayName = resource.name || `${ext} ${index + 1}`
      }
    } catch (e) {
      displayName = resource.name || `Resource ${index + 1}`
    }

    const name = document.createElement('div')
    name.textContent = displayName
    name.style.fontSize = '12px'
    name.style.fontWeight = '500'
    name.style.color = '#333'
    name.style.flex = '1'
    name.style.overflow = 'hidden'
    name.style.textOverflow = 'ellipsis'
    name.style.whiteSpace = 'nowrap'
    name.style.marginRight = '8px'

    const badges = document.createElement('div')
    badges.style.display = 'flex'
    badges.style.gap = '4px'
    badges.style.flexShrink = '0'

    // 质量徽章
    if (resource.quality) {
      const quality = document.createElement('span')
      quality.textContent = resource.quality
      quality.style.fontSize = '11px'
      quality.style.color = '#00a1d6'
      quality.style.fontWeight = 'bold'
      quality.style.padding = '2px 6px'
      quality.style.backgroundColor = '#e6f7ff'
      quality.style.borderRadius = '3px'
      badges.appendChild(quality)
    }

    // 文件大小
    if (resource.size && resource.size > 0) {
      const size = document.createElement('span')
      const sizeText = resource.size > 1024 * 1024
        ? `${(resource.size / 1024 / 1024).toFixed(2)}MB`
        : `${(resource.size / 1024).toFixed(2)}KB`
      size.textContent = sizeText
      size.style.fontSize = '11px'
      size.style.color = '#666'
      size.style.padding = '2px 6px'
      size.style.backgroundColor = '#f0f0f0'
      size.style.borderRadius = '3px'
      badges.appendChild(size)
    }

    info.appendChild(name)
    if (badges.children.length > 0) {
      info.appendChild(badges)
    }

    const url = document.createElement('div')
    url.textContent = resource.url
    url.style.fontSize = '10px'
    url.style.color = '#999'
    url.style.overflow = 'hidden'
    url.style.textOverflow = 'ellipsis'
    url.style.whiteSpace = 'nowrap'

    item.appendChild(info)
    item.appendChild(url)

    item.addEventListener('click', () => {
      // 生成建议的文件名
      let filename = ''
      try {
        const pageTitle = document.title || window.top.document.title || ''
        const ext = resource.ext || 'video'

        if (pageTitle) {
          let cleanTitle = pageTitle
            .replace(/\s*[-_│|]\s*在线播放.*$/i, '')
            .replace(/\s*[-_│|]\s*在线观看.*$/i, '')
            .replace(/\s*[-_│|]\s*樱花动漫.*$/i, '')
            .replace(/\s*[-_│|]\s*\w+视频.*$/i, '')
            .replace(/[<>:"/\\|?*]/g, '_')  // 替换非法文件名字符
            .trim()

          if (cleanTitle) {
            filename = `${cleanTitle}.${ext}`
          }
        }
      } catch (e) {
      }

      sendResourceToClient(resource.url, referer, filename)
      const dropdown = document.getElementById('linkcore-resource-dropdown')
      if (dropdown) dropdown.style.display = 'none'
    })

    return item
  }

  // 显示资源选择下拉框
  const showResourceDropdown = () => {
    const dropdown = document.getElementById('linkcore-resource-dropdown')
    if (dropdown) {
      if (dropdown.style.display === 'flex') {
        dropdown.style.display = 'none'
      } else {
        updateResourceList()
        dropdown.style.display = 'flex'
        adjustDropdownPosition(dropdown)
      }
    }
  }

  // 调整下拉框位置，确保在屏幕内
  const adjustDropdownPosition = (dropdown) => {
    const btn = document.getElementById('linkcore-bilibili-download-btn')
    if (!btn) return

    const btnRect = btn.getBoundingClientRect()
    const dropdownRect = dropdown.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let top = btnRect.bottom + 5
    let left = btnRect.left

    // 检查是否超出右边界
    if (left + dropdownRect.width > viewportWidth) {
      left = viewportWidth - dropdownRect.width - 10
    }

    // 检查是否超出左边界
    if (left < 10) {
      left = 10
    }

    // 检查是否超出下边界
    if (top + dropdownRect.height > viewportHeight) {
      // 如果下方空间不足，显示在按钮上方
      top = btnRect.top - dropdownRect.height - 5
    }

    // 检查是否超出上边界
    if (top < 10) {
      top = 10
    }

    dropdown.style.position = 'fixed'
    dropdown.style.top = top + 'px'
    dropdown.style.left = left + 'px'
    dropdown.style.right = 'auto'

    log('Dropdown position adjusted:', { top, left, viewportWidth, viewportHeight })
  }

  // 点击其他地方关闭下拉框
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('linkcore-resource-dropdown')
    const btn = document.getElementById('linkcore-bilibili-download-btn')
    if (dropdown && dropdown.style.display === 'flex') {
      const wrapper = document.getElementById('linkcore-bilibili-download-btn-wrapper')
      if (wrapper && !wrapper.contains(e.target)) {
        dropdown.style.display = 'none'
      }
    }
  }, true)

  // 上次更新资源列表的时间戳，用于节流
  let lastResourceListUpdate = 0
  const RESOURCE_LIST_UPDATE_INTERVAL = 500 // 最少500ms更新一次资源列表

  // 更新按钮显示状态
  const updateBilibiliButtonVisibility = () => {
    const btn = document.getElementById('linkcore-bilibili-download-btn')
    log('Update button visibility, btn:', !!btn, 'total:', sniffedResources.total)
    if (!btn) return

    const hasResources = sniffedResources.total > 0
    const wrapper = btn.parentElement

    log('Wrapper element:', wrapper)
    log('Wrapper current display:', wrapper ? wrapper.style.display : 'no wrapper')

    if (hasResources) {
      log('Showing button, updating resource list...')
      if (wrapper) {
        const wasHidden = wrapper.style.display === 'none'

        // 只有在按钮之前是隐藏的时候才需要特殊处理位置
        if (wasHidden) {
          // 先确保位置正确设置，再显示按钮
          const isNonPlayerContainer = ['#content', '#content-inner', '.content', '.article-container', 'article', 'main'].includes(currentContainerSelector)

          if (isNonPlayerContainer) {
            // 非播放器容器，按钮固定在右上角
            wrapper.style.position = 'fixed'
            wrapper.style.top = '20px'
            wrapper.style.right = '20px'
            log('Updated button position for non-player container before showing')
          } else if (!hasBeenDragged && currentContainer) {
            // 播放器容器且未被拖拽过，更新位置
            const container = currentContainer
            const rect = container.getBoundingClientRect()
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight
            const buttonWidth = 150
            const buttonHeight = 36

            const containerWidth = container.offsetWidth
            const containerHeight = container.offsetHeight

            // 对于小窗口（预览播放器），使用不同的偏移
            let newTop
            if (containerWidth < 400 || containerHeight < 200) {
              newTop = rect.top - 28
            } else {
              newTop = rect.top - 34
            }

            // 如果上方没有空间，则显示在容器内部
            if (newTop < 0) {
              newTop = rect.top + 8
            }

            let newRight = viewportWidth - rect.right

            // 确保按钮在视口内
            if (newTop < 0) newTop = 0
            if (newTop + buttonHeight > viewportHeight) newTop = viewportHeight - buttonHeight
            if (newRight < 0) newRight = 0
            if (newRight + buttonWidth > viewportWidth) newRight = viewportWidth - buttonWidth

            wrapper.style.position = 'fixed'
            wrapper.style.top = `${newTop}px`
            wrapper.style.right = `${newRight}px`
            log('Updated button position for player container before showing, top:', newTop, 'right:', newRight)
          }

          // 直接显示按钮，不使用 requestAnimationFrame 避免延迟
          wrapper.style.display = 'block'
          wrapper.style.visibility = 'visible'
        }
        // 如果按钮已经显示，不需要再更新 visibility，避免闪烁

        log('Wrapper display set to block, current display:', wrapper.style.display)
        log('Wrapper position:', wrapper.style.position)
        log('Wrapper top:', wrapper.style.top, 'right:', wrapper.style.right)
      }

      // 节流：只有距离上次更新超过指定时间才更新资源列表
      const now = Date.now()
      if (now - lastResourceListUpdate > RESOURCE_LIST_UPDATE_INTERVAL) {
        lastResourceListUpdate = now
        updateResourceList()
      }
    } else {
      log('Hiding button')
      if (wrapper) wrapper.style.display = 'none'
    }
  }

  let currentContainer = null
  let currentContainerSelector = ''
  let hasBeenDragged = false // 标记按钮是否被拖拽过
  let isButtonHovered = false // 标记按钮是否正在被悬停
  let positionLocked = false // 标记位置是否已锁定（只有悬停新视频才会解锁）
  let hideButtonTimeout = null // 按钮隐藏倒计时

  const clearHideTimeout = () => {
    if (hideButtonTimeout) {
      clearTimeout(hideButtonTimeout)
      hideButtonTimeout = null
    }
  }

  const startHideTimeout = () => {
    clearHideTimeout()
    hideButtonTimeout = setTimeout(() => {
      const wrapper = document.getElementById('linkcore-bilibili-download-btn-wrapper')
      if (wrapper && !isButtonHovered) {
        wrapper.style.display = 'none'
        positionLocked = false
        // hoveredVideoContainer = null // 保留 active container 以便下次悬停能正确定位? 不，还是重置吧
        hoveredVideoContainer = null
        log('Button hidden after 3s timeout')
      }
    }, 3000)
  }

  const ensureBilibiliButton = () => {
    if (!isTopWindow()) return
    if (!document) return

    log('Creating download button...')

    // 智能查找播放器容器（通用选择器）
    const selectors = [
      '.bpx-player-container',  // B站新版播放器
      '.bpx-player-video-area',
      '.bilibili-player-video-wrap',
      '#bilibili-player',
      '.xgplayer-container',  // xgplayer播放器（抖音等）
      '.xgplayer-video-container',
      '.xgplayer',
      '.video-js',           // video.js 播放器
      '.video-js-container',  // video.js 容器
      '.player-container',
      '.player-wrap',
      '.video-container',
      '.video-wrapper',
      '#player',
      '[class*="player"]',  // 任何包含 player 的 class
      '[id*="player"]',      // 任何包含 player 的 id
      '#content',             // 内容区域
      '#content-inner',       // 内容内部区域
      '.content',             // 通用内容区域
      '.article-container',   // 文章容器
      'article',              // 文章元素
      'main'                 // 主内容区域
    ]

    let container = null
    let containerSelector = ''
    for (const sel of selectors) {
      const el = document.querySelector(sel)
      if (el) {
        container = el
        containerSelector = sel
        break
      }
    }

    // 如果没找到容器，使用 body
    if (!container) {
      container = document.body
      containerSelector = 'body'
      log('No container found, using body')
    }

    log('Available containers:', selectors)
    log('Selected container:', containerSelector, container)

    // 检查容器是否变化
    const containerChanged = currentContainer !== container || currentContainerSelector !== containerSelector

    // 如果按钮已存在且（容器未变化 或 位置已锁定），不重新创建
    const existingBtn = document.getElementById('linkcore-bilibili-download-btn')
    if (existingBtn && (!containerChanged || positionLocked)) {
      log('Button already exists, skipping recreation. containerChanged:', containerChanged, 'positionLocked:', positionLocked)
      return
    }

    // 如果按钮已存在且容器变化，先删除它
    if (existingBtn) {
      const existingWrapper = existingBtn.parentElement
      if (existingWrapper && existingWrapper.id === 'linkcore-bilibili-download-btn-wrapper') {
        log('Removing existing button and dropdown to create new one, containerChanged:', containerChanged)
        // 不要在UI重置时清除资源，导致闪烁
        // window.dispatchEvent(new Event('linkcore-clear-resources'))
        // 直接删除整个wrapper（包括按钮和dropdown）
        existingWrapper.remove()
      }
    }

    // 更新当前容器记录
    currentContainer = container
    currentContainerSelector = containerSelector

    // 如果没找到专用播放器容器，查找 video 元素
    let videoElement = null
    if (!container) {
      videoElement = document.querySelector('video')
      if (videoElement) {
        // 为 video 创建一个包装容器
        let videoWrapper = videoElement.parentElement

        // 检查 video 是否已经在一个包装容器中
        if (videoWrapper && videoWrapper.tagName !== 'BODY') {
          // 检查这个容器是否只包含 video（或者主要是 video）
          const containerHeight = videoWrapper.offsetHeight
          const videoHeight = videoElement.offsetHeight

          // 如果容器高度远大于 video（说明容器里有很多其他内容），使用 video 自己的位置
          if (containerHeight > videoHeight * 1.5) {
            // 创建一个新的 wrapper 专门包装 video
            const newWrapper = document.createElement('div')
            newWrapper.style.position = 'relative'
            newWrapper.style.display = 'inline-block'
            newWrapper.style.width = '100%'

            videoWrapper.insertBefore(newWrapper, videoElement)
            newWrapper.appendChild(videoElement)

            container = newWrapper
            containerSelector = 'video-wrapper-created'
            log('Created wrapper for video')
          } else {
            // 容器大小合适，直接使用
            container = videoWrapper
            containerSelector = 'video-parent'
            log('Using video parent as container:', videoWrapper.tagName, videoWrapper.className || videoWrapper.id)
          }
        } else {
          // 父元素是 body，使用 fixed 定位
          container = document.body
          containerSelector = 'body'
        }
      } else {
        container = document.body
        containerSelector = 'body'
      }
    }

    if (!container) {
      log('No container found')
      return
    }

    log('Final container:', containerSelector, container)
    log('Container position:', window.getComputedStyle(container).position)
    log('Container dimensions:', container.offsetWidth, 'x', container.offsetHeight)

    // 为容器设置相对定位
    const computedPosition = window.getComputedStyle(container).position
    if (computedPosition === 'static') {
      container.style.position = 'relative'
      log('Set container position to relative')
    }

    const wrapper = document.createElement('div')
    wrapper.id = 'linkcore-bilibili-download-btn-wrapper'
    const wStyle = wrapper.style

    // 根据容器类型设置位置
    if (containerSelector === 'body' || containerSelector === '#content' ||
      containerSelector === '#content-inner' || containerSelector === '.content' ||
      containerSelector === '.article-container' || containerSelector === 'article' ||
      containerSelector === 'main') {
      // 非播放器容器（文章页面等），使用 fixed 定位在页面右上角
      wStyle.position = 'fixed'
      wStyle.top = '20px'
      wStyle.right = '20px'
      wStyle.zIndex = '999999'
      log('Non-player container, button at top-right corner')
    } else {
      // 播放器容器，按钮在容器外部上方，紧贴小窗口
      const containerWidth = container.offsetWidth
      const containerHeight = container.offsetHeight

      // 对于小窗口（预览播放器），使用fixed定位，紧贴小窗口上方
      if (containerWidth < 400 || containerHeight < 200) {
        const rect = container.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const buttonWidth = 150
        const buttonHeight = 36

        let newTop = rect.top - 28
        let newRight = viewportWidth - rect.right

        // 确保按钮在视口内
        if (newTop < 0) newTop = 0
        if (newTop + buttonHeight > viewportHeight) newTop = viewportHeight - buttonHeight
        if (newRight < 0) newRight = 0
        if (newRight + buttonWidth > viewportWidth) newRight = viewportWidth - buttonWidth

        wStyle.position = 'fixed'
        wStyle.top = `${newTop}px`
        wStyle.right = `${newRight}px`
        wStyle.zIndex = '999999'
        log('Small preview window, button above container, top:', newTop, 'right:', newRight)
      } else {
        // 正常播放器，按钮在容器外部上方，紧贴容器
        const rect = container.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const buttonWidth = 150
        const buttonHeight = 36

        let newTop = rect.top - 34
        let newRight = viewportWidth - rect.right

        // 确保按钮在视口内
        if (newTop < 0) newTop = 0
        if (newTop + buttonHeight > viewportHeight) newTop = viewportHeight - buttonHeight
        if (newRight < 0) newRight = 0
        if (newRight + buttonWidth > viewportWidth) newRight = viewportWidth - buttonWidth

        wStyle.position = 'fixed'
        wStyle.top = `${newTop}px`
        wStyle.right = `${newRight}px`
        wStyle.zIndex = '99999'
        log('Normal player, button above container, top:', newTop, 'right:', newRight)
      }
    }

    wStyle.pointerEvents = 'auto'
    wStyle.display = 'none' // 默认隐藏，检测到资源后显示

    const btn = document.createElement('button')
    btn.id = 'linkcore-bilibili-download-btn'
    let label = 'Download with LinkCore'
    try {
      if (chrome && chrome.i18n && chrome.i18n.getMessage) {
        const msg = chrome.i18n.getMessage('contextMenuDownload')
        if (msg) label = msg
      }
    } catch (e) {
    }
    btn.textContent = label
    btn.title = label
    applyClientLocaleToButton(btn)
    const style = btn.style
    style.position = 'relative'
    style.padding = '6px 12px'
    style.background = '#00a1d6'
    style.color = '#ffffff'
    style.border = 'none'
    style.borderRadius = '4px'
    style.cursor = 'pointer'
    style.fontSize = '12px'
    style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'
    style.opacity = '0.9'
    style.transition = 'opacity 0.2s ease'
    style.pointerEvents = 'auto'
    // 监听按钮悬停状态，防止悬停时位置被重置
    wrapper.addEventListener('mouseenter', () => {
      isButtonHovered = true
      clearHideTimeout() // 清除隐藏倒计时
      btn.style.opacity = '1'
      log('Button wrapper mouseenter, locked position')
    })
    wrapper.addEventListener('mouseleave', () => {
      isButtonHovered = false
      startHideTimeout() // 开始隐藏倒计时
      btn.style.opacity = '0.9'
      log('Button wrapper mouseleave, unlocked position')
    })
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      showResourceDropdown()
    })

    // 长按拖拽功能
    let longPressTimer = null
    let isDragging = false
    let dragOffsetX = 0
    let dragOffsetY = 0
    let animationFrameId = null
    let hasMoved = false // 标记是否真正发生了拖拽移动

    const startDrag = (e) => {
      isDragging = true
      hasMoved = false // 重置移动标志

      const rect = wrapper.getBoundingClientRect()
      dragOffsetX = e.clientX - rect.left
      dragOffsetY = e.clientY - rect.top
      wStyle.cursor = 'grabbing'
      btn.style.cursor = 'grabbing'
      wStyle.transition = 'none'  // 移除过渡动画，使拖拽更流畅
      log('Drag started')
    }

    const onDrag = (e) => {
      if (!isDragging) return

      // 使用 requestAnimationFrame 优化性能
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }

      animationFrameId = requestAnimationFrame(() => {
        const rect = wrapper.getBoundingClientRect()
        let newX = e.clientX - dragOffsetX
        let newY = e.clientY - dragOffsetY

        // 检测是否真正发生了移动
        if (Math.abs(newX - rect.left) > 1 || Math.abs(newY - rect.top) > 1) {
          hasMoved = true
        }

        // 限制在视口内（fixed定位不需要考虑滚动）
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        // 获取B站导航栏高度，防止拖拽到导航栏
        let navBarHeight = 0
        const navBar = document.querySelector('.bili-header') || document.querySelector('.fixed-header') || document.querySelector('#bili-header') || document.querySelector('.bili-nav-header')
        if (navBar) {
          navBarHeight = navBar.offsetHeight || navBar.getBoundingClientRect().height || 0
        }

        // 限制Y坐标不能小于导航栏高度，避免拖拽到导航栏
        const minY = navBarHeight

        // 限制在视口内（fixed定位，不需要考虑滚动）
        newX = Math.max(0, Math.min(newX, viewportWidth - wrapper.offsetWidth))
        newY = Math.max(minY, Math.min(newY, viewportHeight - wrapper.offsetHeight))

        wStyle.position = 'fixed'
        wStyle.left = newX + 'px'
        wStyle.top = newY + 'px'
        wStyle.right = 'auto'

        // 下拉框跟随按钮移动
        const dropdown = document.getElementById('linkcore-resource-dropdown')
        if (dropdown && dropdown.style.display === 'flex') {
          adjustDropdownPosition(dropdown)
        }
      })
    }

    const endDrag = () => {
      isDragging = false
      // 只有真正发生了移动才标记为已拖拽
      if (hasMoved) {
        hasBeenDragged = true
      }
      wStyle.cursor = 'auto'
      btn.style.cursor = 'pointer'
      wStyle.transition = 'opacity 0.2s ease'  // 恢复过渡动画
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
      log('Drag ended, hasMoved:', hasMoved, 'hasBeenDragged:', hasBeenDragged)
    }

    // 鼠标长按150ms开启拖拽
    btn.addEventListener('mousedown', (e) => {
      longPressTimer = setTimeout(() => {
        startDrag(e)
      }, 150)  // 150ms长按触发拖拽
    })

    btn.addEventListener('mouseup', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
      if (isDragging) {
        endDrag()
      }
    })

    btn.addEventListener('mouseleave', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
      // 不调用 endDrag()，避免快速移动时中断拖拽
      // 拖拽结束由 document 的 mouseup 事件处理
    })

    // 鼠标移动
    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', endDrag)

    wrapper.appendChild(btn)

    // 创建并添加下拉框
    const dropdown = createResourceDropdown()
    wrapper.appendChild(dropdown)

    // 将wrapper添加到document.body，确保fixed定位正常工作
    document.body.appendChild(wrapper)

    log('Button created successfully')
    log('Wrapper display:', wrapper.style.display)
    log('Wrapper position:', wrapper.style.position, 'top:', wrapper.style.top, 'right:', wrapper.style.right)
    log('Current sniffedResources:', sniffedResources)
    log('Button element:', btn)
    const btnInDom = document.getElementById('linkcore-bilibili-download-btn')
    log('Button in DOM:', btnInDom)
    if (btnInDom) {
      const rect = btnInDom.getBoundingClientRect()
      log('Button position:', rect)
      log('Button visible:', rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0)
    }

    // 初始化后立即检查是否有资源
    setTimeout(() => {
      log('Delayed check...')
      log('Current sniffedResources:', sniffedResources)

      // 如果已经有资源，就不要再请求了（避免覆盖 iframe 的资源）
      if (sniffedResources && sniffedResources.total > 0) {
        log('Already have resources from iframe:', sniffedResources.total)
        updateBilibiliButtonVisibility()
      } else {
        log('No resources yet, requesting...')
        window.dispatchEvent(new Event('linkcore-get-resources'))
      }
    }, 500)

    // 监听容器位置变化，仅针对播放器小窗口
    const isPlayerContainer = ['.bpx-player-container', '.bpx-player-video-area', '.bilibili-player-video-wrap',
      '#bilibili-player', '.xgplayer-container', '.xgplayer-video-container', '.xgplayer',
      '.video-js', '.video-js-container',
      '.player-container', '.player-wrap', '.video-container', '.video-wrapper', '#player',
      '[class*="player"]', '[id*="player"]'].includes(containerSelector)

    // 更新按钮位置，确保在视口内
    const updateButtonPosition = () => {
      // 如果按钮正在被悬停，不更新位置
      if (isButtonHovered) return

      const containerWidth = container.offsetWidth
      const containerHeight = container.offsetHeight

      const rect = container.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const buttonWidth = 150
      const buttonHeight = 36

      // 按钮在容器上方
      let newTop = rect.top - 34
      let newRight = viewportWidth - rect.right

      // 确保按钮在视口内
      if (newTop < 0) newTop = 0
      if (newTop + buttonHeight > viewportHeight) newTop = viewportHeight - buttonHeight
      if (newRight < 0) newRight = 0
      if (newRight + buttonWidth > viewportWidth) newRight = viewportWidth - buttonWidth

      wStyle.top = `${newTop}px`
      wStyle.right = `${newRight}px`
      log('Updated button position, top:', newTop, 'right:', newRight, 'viewport:', viewportWidth, 'x', viewportHeight)
    }

    // 监听窗口大小变化，确保按钮始终在视口内
    const handleResize = () => {
      // 如果位置已锁定或按钮正在被悬停，不更新位置
      if (positionLocked || isButtonHovered) {
        log('Position locked or button hovered, skipping resize update')
        return
      }

      const isNonPlayerContainer = ['#content', '#content-inner', '.content', '.article-container', 'article', 'main'].includes(containerSelector)

      if (isNonPlayerContainer) {
        // 非播放器容器，按钮固定在右上角
        wStyle.top = '20px'
        wStyle.right = '20px'
        log('Updated button position for non-player container on resize')
      } else if (!hasBeenDragged) {
        // 播放器容器且未被拖拽过，更新位置
        updateButtonPosition()
      }
    }

    if (isPlayerContainer && containerSelector !== 'body') {
      // 使用 MutationObserver 监听容器位置变化（仅当未被拖拽过时）
      const observer = new MutationObserver(() => {
        // 只有在位置未锁定且未被拖拽过时才更新
        if (!hasBeenDragged && !positionLocked && !isButtonHovered) {
          updateButtonPosition()
        }
      })

      observer.observe(container, {
        attributes: true,
        attributeFilter: ['style', 'class']
      })

      // 定期检查位置（仅在位置未锁定且未被拖拽过时）
      // 注意：为了避免按钮跳动，我们离用这个定期更新
      // setInterval(() => {
      //   if (!hasBeenDragged && !positionLocked && !isButtonHovered) {
      //     updateButtonPosition()
      //   }
      // }, 500)
    }

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize)
    // 初始调用一次
    handleResize()
  }

  const scheduleBilibiliButton = () => {
    log('scheduleBilibiliButton called, isTopWindow:', isTopWindow())
    if (!isTopWindow()) return
    const tryInit = () => {
      log('tryInit called')
      ensureBilibiliButton()
    }
    // 立即尝试创建按钮，不等待 DOMContentLoaded
    log('Document ready state:', document.readyState)
    setTimeout(tryInit, 100) // 延迟 100ms 确保 DOM 基本就绪

    // 同时也监听 DOMContentLoaded 以防万一
    if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
      log('Waiting for DOMContentLoaded')
      window.addEventListener('DOMContentLoaded', () => {
        log('DOMContentLoaded fired')
        tryInit()
      })
    }

    // 定期重试（防止失败）
    // setInterval(() => {
    //   tryInit()
    // }, 3000)
  }

  log('Script loaded, calling scheduleBilibiliButton')
  scheduleBilibiliButton()

  // 当前悬停的视频元素或容器
  let hoveredVideoContainer = null

  // 上次位置更新的参数，用于检测是否需要更新
  let lastPositionTop = null
  let lastPositionRight = null

  // 更新按钮位置到指定容器的右上角
  const updateButtonPositionToContainer = (container) => {
    if (!container) return

    const wrapper = document.getElementById('linkcore-bilibili-download-btn-wrapper')
    if (!wrapper) return

    // 如果按钮已被拖拽过，不自动更新位置
    if (hasBeenDragged) return

    // 如果按钮正在被悬停，不更新位置（让用户能点击按钮）
    if (isButtonHovered) {
      log('Button is hovered, skipping position update')
      return
    }

    const rect = container.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const buttonWidth = 150
    const buttonHeight = 36

    // 按钮定位在容器上方，紧贴容器顶部
    let newTop = rect.top - 34
    let newRight = viewportWidth - rect.right

    // 如果上方没有空间，则显示在容器内部
    if (newTop < 0) {
      newTop = rect.top + 8
    }

    // 确保按钮在视口内
    if (newTop < 0) newTop = 0
    if (newTop + buttonHeight > viewportHeight) newTop = viewportHeight - buttonHeight
    if (newRight < 0) newRight = 0
    if (newRight + buttonWidth > viewportWidth) newRight = viewportWidth - buttonWidth

    // 如果位置没有变化，不更新（避免不必要的重绘和闪烁）
    if (lastPositionTop === newTop && lastPositionRight === newRight) {
      return
    }

    lastPositionTop = newTop
    lastPositionRight = newRight

    // 直接更新位置，不使用 visibility 隐藏，避免闪烁
    wrapper.style.position = 'fixed'
    wrapper.style.top = `${newTop}px`
    wrapper.style.right = `${newRight}px`
    wrapper.style.left = 'auto'

    // 确保按钮可见
    wrapper.style.display = 'block'
    wrapper.style.visibility = 'visible'

    // 锁定位置，防止被其他逻辑重置
    positionLocked = true

    log('Updated button position to hovered container, top:', newTop, 'right:', newRight)
  }

  // 查找视频元素的容器（视频卡片）
  const findVideoContainer = (videoElement) => {
    if (!videoElement) return null

    // 尝试找到视频的直接容器
    let parent = videoElement.parentElement
    let depth = 0
    const maxDepth = 5  // 最多向上查找5层

    while (parent && depth < maxDepth) {
      // 检查是否是视频卡片
      if (parent.classList && parent.classList.length > 0) {
        const classList = Array.from(parent.classList)
        // 抖音及通用视频卡片类名
        if (classList.some(cls =>
          cls.includes('video-card') ||
          cls.includes('aweme-card') ||
          cls.includes('AwemeCard') ||
          cls.includes('player') ||
          cls.includes('video-container') ||
          cls.includes('xgplayer') ||
          cls.includes('video-item') ||
          cls.includes('feed-item') ||
          cls.includes('recommend-item') ||
          cls.includes('video-wrapper') ||
          cls.includes('poster') ||
          cls.includes('cover')
        )) {
          bestContainer = parent
          // 继续向上查找
        }
      }

      // 如果还没有找到基于类的容器，检查尺寸
      if (!bestContainer) {
        const style = window.getComputedStyle(parent)
        const width = parent.offsetWidth
        const height = parent.offsetHeight

        if (width >= 100 && height >= 60 &&
          (style.position === 'relative' || style.position === 'absolute')) {
          if (!bestContainer) bestContainer = parent
        }
      }

      parent = parent.parentElement
      depth++
    }

    // 如果找到了容器，返回它；否则返回视频元素自身
    return bestContainer || videoElement
  }



  // 为视频元素添加悬停监听
  const addVideoHoverListeners = () => {
    const videos = document.querySelectorAll('video')
    videos.forEach(video => {
      if (video._linkcoreHoverListenerAdded) return
      video._linkcoreHoverListenerAdded = true

      // 当视频开始播放时（通常是悬停触发的预览播放）
      video.addEventListener('play', () => {
        const container = findVideoContainer(video)
        if (container && container !== hoveredVideoContainer) {
          hoveredVideoContainer = container
          hoveredVideoElement = video
          // 更新当前容器记录，这样 updateBilibiliButtonVisibility 会使用新位置
          currentContainer = container
          currentContainerSelector = 'video-hover'
          log('Video play detected, container:', container)
          updateButtonPositionToContainer(container)
        }
      })

      // 监听视频元素的鼠标进入事件
      video.addEventListener('mouseenter', () => {
        clearHideTimeout() // 清除隐藏倒计时
        const container = findVideoContainer(video)
        if (container && container !== hoveredVideoContainer) {
          hoveredVideoContainer = container
          hoveredVideoElement = video
          currentContainer = container
          currentContainerSelector = 'video-hover'
          log('Video mouseenter, container:', container)
          updateButtonPositionToContainer(container)
        }
      })

      // 监听离开事件
      video.addEventListener('mouseleave', () => {
        // 只有当鼠标真的离开了容器才开始倒计时
        const container = findVideoContainer(video)
        if (container && container.matches && container.matches(':hover')) {
          log('Mouse left video but still in container, skipping timeout')
          return
        }
        // 用户要求不自动消失
        // startHideTimeout()
      })
    })

    // 也监听可能的视频容器
    const videoContainers = document.querySelectorAll('[class*="video-card"], [class*="player"], [class*="xgplayer"], [class*="video-item"], [class*="feed-item"]')
    videoContainers.forEach(container => {
      if (container._linkcoreHoverListenerAdded) return
      container._linkcoreHoverListenerAdded = true

      container.addEventListener('mouseenter', () => {
        // 检查容器内是否有视频元素
        const video = container.querySelector('video')
        if (video) {
          clearHideTimeout() // 清除隐藏倒计时
          if (container !== hoveredVideoContainer) {
            hoveredVideoContainer = container
            hoveredVideoElement = video
            currentContainer = container
            currentContainerSelector = 'video-hover'
            log('Video container mouseenter:', container)
            updateButtonPositionToContainer(container)
          }
        }
      })

      container.addEventListener('mouseleave', () => {
        // 用户要求不自动消失
        // startHideTimeout()
      })
    })
  }

  // 当前悬停的视频元素（用于在容器失效时找回）
  let hoveredVideoElement = null

  // 监听滚动事件，确保按钮随容器移动
  window.addEventListener('scroll', () => {
    if (positionLocked && hoveredVideoContainer && hoveredVideoContainer.isConnected) {
      updateButtonPositionToContainer(hoveredVideoContainer)
    } else if (positionLocked && hoveredVideoContainer && !hoveredVideoContainer.isConnected) {
      // 容器失效，尝试恢复
      if (hoveredVideoElement && hoveredVideoElement.isConnected) {
        log('Container disconnected but video exists, re-finding container')
        const newContainer = findVideoContainer(hoveredVideoElement)
        if (newContainer && newContainer.isConnected) {
          hoveredVideoContainer = newContainer
          updateButtonPositionToContainer(hoveredVideoContainer)
          return
        }
      }

      // 如果容器被移除（如虚拟列表滚动）且无法恢复，隐藏按钮并重置锁定
      // 除非按钮被拖拽过（用户想保留它）
      if (!hasBeenDragged) {
        const wrapper = document.getElementById('linkcore-bilibili-download-btn-wrapper')
        if (wrapper) wrapper.style.display = 'none'
        positionLocked = false
        hoveredVideoContainer = null
        log('Container removed from DOM and cannot recover, resetting position lock')
      }
    }
  }, true) // 使用 capture 捕获滚动事件

  // 也使用 requestAnimationFrame 持续跟踪位置（处理非滚动导致的布局变化）
  const trackPositionLoop = () => {
    if (positionLocked && hoveredVideoContainer) {
      if (hoveredVideoContainer.isConnected) {
        updateButtonPositionToContainer(hoveredVideoContainer)
      } else {
        // 容器失效，尝试恢复
        let recovered = false
        if (hoveredVideoElement && hoveredVideoElement.isConnected) {
          const newContainer = findVideoContainer(hoveredVideoElement)
          if (newContainer && newContainer.isConnected) {
            hoveredVideoContainer = newContainer
            updateButtonPositionToContainer(hoveredVideoContainer)
            recovered = true
          }
        }

        if (!recovered && !hasBeenDragged) {
          // 容器已失效且无法恢复，且未被拖拽
          positionLocked = false
          hoveredVideoContainer = null
          const wrapper = document.getElementById('linkcore-bilibili-download-btn-wrapper')
          if (wrapper) wrapper.style.display = 'none'
          log('Container disconnected in loop, hidden')
        }
      }
    }
    requestAnimationFrame(trackPositionLoop)
  }
  requestAnimationFrame(trackPositionLoop)

  // 定期扫描新的视频元素并添加监听
  // setInterval(addVideoHoverListeners, 1000)

  // 全局鼠标移动监听，用于捕获动态变化的元素或被遮挡的视频
  let lastMouseMoveTime = 0
  window.addEventListener('mousemove', (e) => {
    const now = Date.now()
    if (now - lastMouseMoveTime < 100) return // 节流 100ms
    lastMouseMoveTime = now

    const target = e.target
    if (!target) return

    // 检查是否悬停在视频上（或视频上方的遮罩层）
    let foundContainer = null

    // 1. 直接悬停在视频元素
    if (target.tagName === 'VIDEO') {
      foundContainer = findVideoContainer(target)
    } else {
      // 2. 悬停在视频容器或其子元素
      let el = target
      let depth = 0
      while (el && depth < 5) {
        if (el.tagName === 'VIDEO') {
          foundContainer = findVideoContainer(el)
          break
        }
        // 检查常用容器类名
        if (el.classList && Array.from(el.classList).some(cls =>
          cls.includes('video-card') || cls.includes('player') || cls.includes('video-item') || cls.includes('AwemeCard')
        )) {
          // 如果容器内有视频，则是目标
          const video = el.querySelector('video')
          if (video) {
            foundContainer = findVideoContainer(video) // 使用标准逻辑获取最佳容器
            break
          }
        }
        el = el.parentElement
        depth++
      }
    }

    if (foundContainer && foundContainer.isConnected) {
      // 如果找到了容器，手动触发悬停逻辑
      // 由于作用域限制，我们直接调用 core logic
      // 为了简单，我们只更新位置（如果是新容器）
      if (foundContainer !== hoveredVideoContainer) {
        // 这里我们需要访问 video 元素来设置 hoveredVideoElement
        // 如果 foundContainer 是通过 video 找到的，我们反查 video
        let video = foundContainer.querySelector('video')
        if (!video && foundContainer.tagName === 'VIDEO') video = foundContainer

        if (video) {
          hoveredVideoContainer = foundContainer
          hoveredVideoElement = video
          currentContainer = foundContainer
          currentContainerSelector = 'video-hover-global'
          // clearHideTimeout() // 全局如果有访问权最好调用
          if (typeof clearHideTimeout === 'function') clearHideTimeout()

          log('Global mousemove detected container:', foundContainer)
          updateButtonPositionToContainer(foundContainer)
        }
      } else {
        // 同一个容器，保持显示（清除隐藏倒计时）
        if (typeof clearHideTimeout === 'function') {
          clearHideTimeout()
        }
      }
    }
  }, true) // capture

  // 初始添加一次
  setTimeout(addVideoHoverListeners, 500)
}
