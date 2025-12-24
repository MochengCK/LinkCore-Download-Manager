import { isEmpty } from 'lodash'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getGlobal } from '@electron/remote'
import store from '@/store'

import {
  ADD_TASK_TYPE,
  NONE_SELECTED_FILES,
  SELECTED_ALL_FILES
} from '@shared/constants'
import { splitTaskLinks, normalizeCookie } from '@shared/utils'
import { buildOuts } from '@shared/utils/rename'
import {
  buildCategorizedPaths,
  shouldCategorizeFiles
} from '@shared/utils/file-categorize'
import { inferRefererFromUrl } from '@shared/utils/referer-rules'
import { CHROME_UA } from '@shared/ua'

import {
  buildUrisFromCurl,
  buildHeadersFromCurl,
  buildDefaultOptionsFromCurl
} from '@shared/utils/curl'

const getStaticBasePath = () => {
  try {
    if (typeof __static !== 'undefined' && __static) {
      return __static
    }
  } catch (_) {}
  try {
    return getGlobal('__static')
  } catch (_) {
    return ''
  }
}

const getBilibiliParserPath = () => {
  const base = getStaticBasePath()
  const resourcesPath = process && process.resourcesPath ? `${process.resourcesPath}` : ''
  const packedCandidate1 = resourcesPath ? join(resourcesPath, 'parsers', 'bilibili_parser.exe') : ''
  if (packedCandidate1 && existsSync(packedCandidate1)) return packedCandidate1

  const packedCandidate1b = resourcesPath ? join(resourcesPath, 'parsers', 'bilibili_parser') : ''
  if (packedCandidate1b && existsSync(packedCandidate1b)) return packedCandidate1b

  const packedCandidate2 = resourcesPath ? join(resourcesPath, 'parsers', 'bilibili_parser.py') : ''
  if (packedCandidate2 && existsSync(packedCandidate2)) return packedCandidate2

  const devCandidate0 = base ? join(base, '..', '..', '..', 'MediaParser', 'parsers', 'bilibili_parser.py') : ''
  if (devCandidate0 && existsSync(devCandidate0)) return devCandidate0

  const devCandidate0b = base ? join(base, '..', '..', '..', 'static', 'parsers', 'bilibili_parser.exe') : ''
  if (devCandidate0b && existsSync(devCandidate0b)) return devCandidate0b

  const devCandidate0c = base ? join(base, '..', '..', '..', 'static', 'parsers', 'bilibili_parser') : ''
  if (devCandidate0c && existsSync(devCandidate0c)) return devCandidate0c

  const devCandidate1 = base ? join(base, '..', 'MediaParser', 'parsers', 'bilibili_parser.py') : ''
  if (devCandidate1 && existsSync(devCandidate1)) return devCandidate1

  const devCandidate2 = base ? join(base, 'parsers', 'bilibili_parser.exe') : ''
  if (devCandidate2 && existsSync(devCandidate2)) return devCandidate2

  const devCandidate2b = base ? join(base, 'parsers', 'bilibili_parser') : ''
  if (devCandidate2b && existsSync(devCandidate2b)) return devCandidate2b

  return packedCandidate1 || packedCandidate1b || packedCandidate2 || devCandidate0 || devCandidate0b || devCandidate0c || devCandidate1 || devCandidate2 || devCandidate2b || ''
}

const isBilibiliCandidateUrl = (url) => {
  const s = `${url || ''}`.trim()
  if (!s) return false
  if (/^https?:\/\/(www\.)?bilibili\.com\/video\//i.test(s)) return true
  if (/^https?:\/\/b23\.tv\//i.test(s)) return true
  if (/^https?:\/\/(m\.)?bilibili\.com\/video\//i.test(s)) return true
  return false
}

export const isBilibiliUrl = (url) => {
  return isBilibiliCandidateUrl(url)
}

const getEmbeddedPythonCandidates = () => {
  const resourcesPath = process && process.resourcesPath ? `${process.resourcesPath}` : ''
  const base = getStaticBasePath()
  const devRoot = base ? join(base, '..') : ''

  const candidates = []
  if (process.platform === 'win32') {
    if (resourcesPath) {
      candidates.push(
        join(resourcesPath, 'python', 'python.exe'),
        join(resourcesPath, 'python', 'python3.exe'),
        join(resourcesPath, 'python', 'bin', 'python.exe'),
        join(resourcesPath, 'python', 'bin', 'python3.exe')
      )
    }
    if (devRoot) {
      candidates.push(
        join(devRoot, 'MediaParser', 'python.exe'),
        join(devRoot, 'MediaParser', 'python3.exe'),
        join(devRoot, 'MediaParser', 'bin', 'python.exe'),
        join(devRoot, 'MediaParser', 'bin', 'python3.exe')
      )
    }
  } else {
    if (resourcesPath) {
      candidates.push(
        join(resourcesPath, 'python', 'bin', 'python3'),
        join(resourcesPath, 'python', 'bin', 'python')
      )
    }
    if (devRoot) {
      candidates.push(
        join(devRoot, 'MediaParser', 'bin', 'python3'),
        join(devRoot, 'MediaParser', 'bin', 'python')
      )
    }
  }

  return candidates.filter(p => p && existsSync(p))
}

const runBilibiliParser = async (url, options = {}) => {
  const script = getBilibiliParserPath()
  if (!script) {
    throw new Error('未找到内置解析脚本')
  }

  const qn = options && options.qn !== undefined && options.qn !== null ? `${options.qn}` : ''
  const argsExtra = []
  if (qn && qn.trim()) {
    argsExtra.push('--qn', qn.trim())
  }

  const exeCandidates = []
  const resourcesPath = process && process.resourcesPath ? `${process.resourcesPath}` : ''
  if (resourcesPath) {
    const exePacked = join(resourcesPath, 'parsers', 'bilibili_parser.exe')
    if (existsSync(exePacked)) {
      exeCandidates.push(exePacked)
    }
    const binPacked = join(resourcesPath, 'parsers', 'bilibili_parser')
    if (existsSync(binPacked)) {
      exeCandidates.push(binPacked)
    }
  }

  const base = getStaticBasePath()
  if (base) {
    const exeDev1 = join(base, '..', '..', '..', 'static', 'parsers', 'bilibili_parser.exe')
    if (existsSync(exeDev1)) {
      exeCandidates.push(exeDev1)
    }
    const binDev1 = join(base, '..', '..', '..', 'static', 'parsers', 'bilibili_parser')
    if (existsSync(binDev1)) {
      exeCandidates.push(binDev1)
    }
    const exeDev2 = join(base, 'parsers', 'bilibili_parser.exe')
    if (existsSync(exeDev2)) {
      exeCandidates.push(exeDev2)
    }
    const binDev2 = join(base, 'parsers', 'bilibili_parser')
    if (existsSync(binDev2)) {
      exeCandidates.push(binDev2)
    }
  }

  const exeItems = exeCandidates.map(cmd => ({ cmd, args: [url, ...argsExtra] }))
  const embedded = getEmbeddedPythonCandidates().map(cmd => ({ cmd, args: [script, url, ...argsExtra] }))
  const systemFallback = process.platform === 'win32'
    ? [
      { cmd: 'py', args: ['-3', script, url, ...argsExtra] },
      { cmd: 'python', args: [script, url, ...argsExtra] },
      { cmd: 'python3', args: [script, url, ...argsExtra] }
    ]
    : [
      { cmd: 'python3', args: [script, url, ...argsExtra] },
      { cmd: 'python', args: [script, url, ...argsExtra] }
    ]
  const candidates = [...exeItems, ...embedded, ...systemFallback]

  const attempt = (index) => new Promise((resolve, reject) => {
    const item = candidates[index]
    if (!item) {
      reject(new Error('未找到可用的 Python 环境'))
      return
    }

    const env = { ...process.env }
    const cookie = options && options.cookie ? `${options.cookie}` : ''
    if (cookie && cookie.trim()) {
      env.BILI_COOKIE = cookie
    }
    const child = spawn(item.cmd, item.args, { windowsHide: true, env })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (d) => { stdout += d.toString('utf8') })
    child.stderr.on('data', (d) => { stderr += d.toString('utf8') })
    child.on('error', (err) => {
      if (err && err.code === 'ENOENT') {
        resolve(attempt(index + 1))
        return
      }
      reject(err)
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      const msg = (stderr || stdout || '').trim() || `python exit ${code}`
      reject(new Error(msg))
    })
  })

  return attempt(0)
}

export const resolveBilibiliResources = async (url, options = {}) => {
  const { stdout } = await runBilibiliParser(url, options)
  let parsed = null
  try {
    parsed = JSON.parse(stdout)
  } catch (_) {
    throw new Error('bilibili parse output invalid')
  }
  if (!parsed || parsed.ok !== true || !Array.isArray(parsed.resources) || parsed.resources.length === 0) {
    const msg = parsed && parsed.error ? `${parsed.error}` : 'bilibili parse failed'
    throw new Error(msg)
  }
  return parsed
}

const buildHeaderForUri = (form, uri, explicit = {}) => {
  const { userAgent, referer, cookie, authorization, fromBrowserExtension } = form || {}
  const result = []

  const ua = !isEmpty(userAgent) ? userAgent : (explicit.userAgent || '')
  if (!isEmpty(ua)) {
    result.push(`User-Agent: ${ua}`)
  }

  const ref = !isEmpty(referer)
    ? referer
    : (explicit.referer || inferRefererFromUrl(uri) || '')
  if (!isEmpty(ref)) {
    result.push(`Referer: ${ref}`)
  }

  if (!isEmpty(cookie)) {
    result.push(`Cookie: ${cookie}`)
  }
  if (!isEmpty(authorization)) {
    result.push(`Authorization: ${authorization}`)
  }
  if (fromBrowserExtension) {
    result.push('X-LinkCore-Source: BrowserExtension')
  }

  return result
}

export const initTaskForm = state => {
  const { addTaskUrl, addTaskOptions } = state.app
  const {
    allProxy,
    dir,
    engineMaxConnectionPerServer,
    followMetalink,
    followTorrent,
    maxConnectionPerServer,
    newTaskShowDownloading,
    newTaskJumpTarget,
    split
  } = state.preference.config

  let initialSplit = maxConnectionPerServer
  if (typeof initialSplit !== 'number' || !Number.isFinite(initialSplit) || initialSplit <= 0) {
    initialSplit = split
  }
  if (typeof initialSplit !== 'number' || !Number.isFinite(initialSplit) || initialSplit <= 0) {
    initialSplit = engineMaxConnectionPerServer
  }

  const result = {
    allProxy,
    cookie: '',
    dir,
    engineMaxConnectionPerServer,
    followMetalink,
    followTorrent,
    maxConnectionPerServer,
    newTaskShowDownloading,
    newTaskJumpTarget: newTaskJumpTarget || 'downloading',
    out: '',
    customOuts: [],
    referer: '',
    selectFile: NONE_SELECTED_FILES,
    split: initialSplit,
    torrent: '',
    uris: addTaskUrl,
    userAgent: '',
    authorization: '',
    ...addTaskOptions
  }
  return result
}

export const buildHeader = (form, uris = []) => {
  const { userAgent, referer, cookie, authorization, fromBrowserExtension } = form
  const result = []

  // 用户设置的请求头始终优先，自动推断的请求头不会覆盖用户设置
  if (!isEmpty(userAgent)) {
    result.push(`User-Agent: ${userAgent}`)
  }

  // Referer 处理：用户设置优先，仅在用户未设置时才自动推断
  if (!isEmpty(referer)) {
    // 用户手动设置的 Referer，优先级最高
    result.push(`Referer: ${referer}`)
  } else if (uris.length > 0) {
    // 自动推断 Referer（仅在用户未设置时）
    const inferredReferer = inferRefererFromUrl(uris[0])
    if (inferredReferer) {
      result.push(`Referer: ${inferredReferer}`)
    }
  }

  if (!isEmpty(cookie)) {
    result.push(`Cookie: ${cookie}`)
  }
  if (!isEmpty(authorization)) {
    result.push(`Authorization: ${authorization}`)
  }

  if (fromBrowserExtension) {
    result.push('X-LinkCore-Source: BrowserExtension')
  }

  return result
}

export const buildOption = (type, form, uris = [], includeHeader = true) => {
  const {
    allProxy,
    dir,
    out,
    selectFile,
    split
  } = form
  const result = {}

  if (!isEmpty(allProxy)) {
    result.allProxy = allProxy
  }

  if (!isEmpty(dir)) {
    result.dir = dir
  }

  if (!isEmpty(out)) {
    result.out = out
  }

  if (split > 0) {
    result.split = split
  }

  if (type === ADD_TASK_TYPE.TORRENT) {
    if (
      selectFile !== SELECTED_ALL_FILES &&
      selectFile !== NONE_SELECTED_FILES
    ) {
      result.selectFile = selectFile
    }
  }

  if (includeHeader) {
    const header = buildHeader(form, uris)
    if (!isEmpty(header)) {
      result.header = header
    }
  }

  return result
}

export const buildUriPayload = async (form, autoCategorize = false, categories = null) => {
  let { uris, out, dir } = form
  if (isEmpty(uris)) {
    throw new Error('task.new-task-uris-required')
  }

  uris = splitTaskLinks(uris)
  const curlHeaders = buildHeadersFromCurl(uris)
  uris = buildUrisFromCurl(uris)
  form = buildDefaultOptionsFromCurl(form, curlHeaders)

  try {
    const pref = store && store.state && store.state.preference && store.state.preference.config
    const videoCookie = pref && pref.videoCookie
    const videoPreferredQn = pref && pref.videoPreferredQn
    const videoPreferredFormat = pref && pref.videoPreferredFormat
    const hasBilibili = uris.some(u => isBilibiliCandidateUrl(u))
    if (hasBilibili && pref) {
      const hasFormCookie = form && form.cookie && `${form.cookie}`.trim()
      if (!hasFormCookie && videoCookie) {
        form.cookie = `${videoCookie}`
      }
      const hasFormVideoQn = form && form.videoQn !== undefined && form.videoQn !== null && `${form.videoQn}`.trim()
      const hasConfigVideoQn = videoPreferredQn !== undefined && videoPreferredQn !== null && `${videoPreferredQn}`.trim()
      if (!hasFormVideoQn && hasConfigVideoQn) {
        form.videoQn = videoPreferredQn
      }
      const hasFormVideoFormat = form && form.videoFormat && `${form.videoFormat}`.trim()
      const hasConfigVideoFormat = videoPreferredFormat && `${videoPreferredFormat}`.trim()
      if (!hasFormVideoFormat && hasConfigVideoFormat) {
        form.videoFormat = `${videoPreferredFormat}`.trim().toLowerCase()
      }
    }
  } catch (_) {}

  const normalizedCookie = form && form.cookie ? normalizeCookie(form.cookie) : ''
  if (normalizedCookie) {
    form.cookie = normalizedCookie
  }

  const desiredOuts = []
  const nextUris = []
  const optionsList = []
  const bilibiliTitles = []
  const bilibiliFormats = []

  for (const u of uris) {
    if (isBilibiliCandidateUrl(u)) {
      const parsed = await resolveBilibiliResources(u, {
        qn: form && (form.videoQn !== undefined ? form.videoQn : form.qn),
        cookie: form && form.cookie ? `${form.cookie}` : ''
      })
      const resources = parsed.resources || []
      for (const r of resources) {
        const resourceUrl = r && r.url ? `${r.url}` : ''
        if (!resourceUrl) continue
        nextUris.push(resourceUrl)
        desiredOuts.push(r && r.name ? `${r.name}` : null)
        bilibiliTitles.push(parsed && parsed.title ? `${parsed.title}` : null)
        bilibiliFormats.push(form && form.videoFormat ? `${form.videoFormat}` : 'mp4')
        const parsedReferer = r && r.referer ? `${r.referer}` : ''
        const inferredReferer = inferRefererFromUrl(resourceUrl)
        const effectiveReferer = !isEmpty(form.referer)
          ? `${form.referer}`
          : (parsedReferer || inferredReferer || 'https://www.bilibili.com/')
        const effectiveUserAgent = !isEmpty(form.userAgent)
          ? `${form.userAgent}`
          : (r && r.user_agent ? `${r.user_agent}` : CHROME_UA)

        const header = buildHeaderForUri(form, resourceUrl, {
          referer: effectiveReferer,
          userAgent: effectiveUserAgent
        })
        if (Array.isArray(header) && !header.some(h => /^Origin:/i.test(`${h}`))) {
          header.push('Origin: https://www.bilibili.com')
        }

        // 确保Cookie正确传递到下载阶段
        if (form && form.cookie) {
          const cookieHeader = header.find(h => /^Cookie:/i.test(`${h}`))
          if (!cookieHeader) {
            const cookie = normalizeCookie(form.cookie)
            if (cookie) {
              header.push(`Cookie: ${cookie}`)
            }
          }
        }

        const perOptions = {
          userAgent: effectiveUserAgent,
          referer: effectiveReferer
        }
        if (!isEmpty(header)) {
          perOptions.header = header
        }
        optionsList.push(perOptions)
      }
      continue
    }

    nextUris.push(u)
    desiredOuts.push(null)
    bilibiliTitles.push(null)
    bilibiliFormats.push(null)
    const header = buildHeaderForUri(form, u)
    optionsList.push(!isEmpty(header) ? { header } : null)
  }

  uris = nextUris
  let outs = buildOuts(uris, out)
  if (Array.isArray(form.customOuts) && form.customOuts.length === uris.length) {
    outs = [...form.customOuts]
  }
  outs = outs.map((o, i) => (desiredOuts[i] ? desiredOuts[i] : o))

  let categorizedPaths = []
  if (shouldCategorizeFiles(autoCategorize, categories) && dir) {
    categorizedPaths = buildCategorizedPaths(uris, outs, categories, dir)
    const uniqueDirs = Array.from(new Set(
      categorizedPaths.map(item => item.categorizedDir).filter(Boolean)
    ))
    uniqueDirs.forEach(d => {
      if (!existsSync(d)) {
        try {
          mkdirSync(d, { recursive: true })
        } catch (error) {}
      }
    })
  }

  const options = buildOption(ADD_TASK_TYPE.URI, form, uris, false)
  const result = {
    uris,
    outs,
    options,
    optionsList,
    dirs: categorizedPaths.length > 0 ? categorizedPaths.map(item => item.categorizedDir) : null,
    priorities: Array.isArray(form.priorities) ? [...form.priorities] : null,
    bilibiliTitles,
    bilibiliFormats
  }
  return result
}

export const buildTorrentPayload = (form) => {
  const { torrent } = form
  if (isEmpty(torrent)) {
    throw new Error('task.new-task-torrent-required')
  }

  const options = buildOption(ADD_TASK_TYPE.TORRENT, form)
  const result = {
    torrent,
    options
  }
  return result
}
