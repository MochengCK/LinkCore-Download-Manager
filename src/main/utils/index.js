import { resolve } from 'node:path'
import { access, constants, existsSync, lstatSync, readdirSync } from 'node:fs'
import { app, nativeTheme, shell, session } from 'electron'
import is from 'electron-is'

import {
  APP_THEME,
  ENGINE_MAX_CONNECTION_PER_SERVER,
  IP_VERSION,
  IS_PORTABLE,
  PORTABLE_EXECUTABLE_DIR
} from '@shared/constants'
import { engineBinMap, engineArchMap } from '../configs/engine'
import logger from '../core/Logger'

export const getUserDataPath = () => {
  return IS_PORTABLE ? PORTABLE_EXECUTABLE_DIR : app.getPath('userData')
}

export const getSystemLogPath = () => {
  return app.getPath('logs')
}

export const getUserDownloadsPath = () => {
  return app.getPath('downloads')
}

export const getConfigBasePath = () => {
  const path = getUserDataPath()
  return path
}

export const getSessionPath = () => {
  return resolve(getUserDataPath(), './download.session')
}

export const getEnginePidPath = () => {
  return resolve(getUserDataPath(), './engine.pid')
}

export const getDhtPath = (protocol) => {
  const name = protocol === IP_VERSION.V6 ? 'dht6.dat' : 'dht.dat'
  return resolve(getUserDataPath(), `./${name}`)
}

export const getEngineBin = (platform) => {
  const result = engineBinMap[platform] || ''
  return result
}

export const getEngineArch = (platform, arch) => {
  if (!['darwin', 'win32', 'linux'].includes(platform)) {
    return ''
  }

  const result = engineArchMap[platform][arch]
  return result
}

export const getDevEnginePath = (platform, arch) => {
  const ah = getEngineArch(platform, arch)
  const base = `../../../extra/${platform}/${ah}/engine`
  const result = resolve(__dirname, base)
  return result
}

export const getProdEnginePath = () => {
  const base = process.resourcesPath || app.getAppPath()
  const primary = resolve(base, './engine')
  const secondary = resolve(base, '../engine')

  if (existsSync(primary)) {
    return primary
  }

  if (existsSync(secondary)) {
    return secondary
  }

  return primary
}

export const getEnginePath = (platform, arch) => {
  return is.dev() ? getDevEnginePath(platform, arch) : getProdEnginePath()
}

export const getAria2BinPath = (platform, arch) => {
  const base = getEnginePath(platform, arch)
  const binName = getEngineBin(platform)
  const result = resolve(base, `./${binName}`)
  return result
}

export const getAria2ConfPath = (platform, arch) => {
  const base = getEnginePath(platform, arch)
  return resolve(base, './aria2.conf')
}

export const transformConfig = (config) => {
  const result = []
  for (const [k, v] of Object.entries(config)) {
    if (v !== '') {
      result.push(`--${k}=${v}`)
    }
  }
  return result
}

export const isRunningInDmg = () => {
  if (!is.macOS() || is.dev()) {
    return false
  }
  const appPath = app.getAppPath()
  const result = appPath.startsWith('/Volumes/')
  return result
}

export const moveAppToApplicationsFolder = (errorMsg = '') => {
  return new Promise((resolve, reject) => {
    try {
      const result = app.moveToApplicationsFolder()
      if (result) {
        resolve(result)
      } else {
        reject(new Error(errorMsg))
      }
    } catch (err) {
      reject(err)
    }
  })
}

export const splitArgv = (argv) => {
  const args = []
  const extra = {}
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const kv = arg.split('=')
      const key = kv[0]
      const value = kv[1] || '1'
      extra[key] = value
      continue
    }
    args.push(arg)
  }
  return { args, extra }
}

export const parseArgvAsUrl = (argv) => {
  const arg = argv[1]
  if (!arg) {
    return
  }

  if (checkIsSupportedSchema(arg)) {
    return arg
  }
}

export const checkIsSupportedSchema = (url = '') => {
  const str = url.toLowerCase()
  if (
    str.startsWith('ftp:') ||
    str.startsWith('http:') ||
    str.startsWith('https:') ||
    str.startsWith('magnet:') ||
    str.startsWith('thunder:') ||
    str.startsWith('mo:') ||
    str.startsWith('motrix:')
  ) {
    return true
  } else {
    return false
  }
}

export const isDirectory = (path) => {
  return existsSync(path) && lstatSync(path).isDirectory()
}

export const parseArgvAsFile = (argv) => {
  let arg = argv[1]
  if (!arg || isDirectory(arg)) {
    return
  }

  if (is.linux()) {
    arg = arg.replace('file://', '')
  }
  return arg
}

export const getMaxConnectionPerServer = () => {
  return ENGINE_MAX_CONNECTION_PER_SERVER
}

export const getSystemHttpProxy = async () => {
  try {
    if (!session || !session.defaultSession) {
      return ''
    }
    const result = await session.defaultSession.resolveProxy('http://www.google.com')
    if (!result) {
      return ''
    }
    const parts = result.split(';').map(p => p.trim()).filter(Boolean)
    const proxyPart = parts.find(p => /^PROXY\s+/i.test(p))
    if (!proxyPart) {
      return ''
    }
    const tokens = proxyPart.split(/\s+/)
    const hostPort = tokens[1]
    if (!hostPort) {
      return ''
    }
    const url = `http://${hostPort}`
    logger.info('[Motrix] detected system http proxy:', url, 'raw:', result)
    return url
  } catch (e) {
    logger.warn('[Motrix] getSystemHttpProxy failed:', e.message)
    return ''
  }
}

export const getSystemTheme = () => {
  let result = APP_THEME.LIGHT
  result = nativeTheme.shouldUseDarkColors ? APP_THEME.DARK : APP_THEME.LIGHT
  return result
}

export const convertArrayBufferToBuffer = (arrayBuffer) => {
  const buffer = Buffer.alloc(arrayBuffer.byteLength)
  const view = new Uint8Array(arrayBuffer)
  for (let i = 0; i < buffer.length; ++i) {
    buffer[i] = view[i]
  }
  return buffer
}

export const showItemInFolder = (fullPath) => {
  if (!fullPath) {
    return
  }

  fullPath = resolve(fullPath)
  access(fullPath, constants.F_OK, (err) => {
    if (err) {
      logger.warn(`[Motrix] ${fullPath} ${err ? 'does not exist' : 'exists'}`)
      return
    }

    shell.showItemInFolder(fullPath)
  })
}

/**
 * 获取引擎目录下的所有引擎
 * @param {string} platform - 平台
 * @param {string} arch - 架构
 * @returns {Array} 引擎列表
 */
export const getEngineList = (platform, arch) => {
  const enginePath = getEnginePath(platform, arch)
  const engines = []

  try {
    if (existsSync(enginePath)) {
      const files = readdirSync(enginePath)
      const binName = getEngineBin(platform)

      // 查找所有可执行文件，特别是与aria2c相关的文件，过滤掉临时文件和备份文件
      files.forEach(file => {
        const filePath = resolve(enginePath, file)
        const stats = lstatSync(filePath)

        // 过滤条件：
        // 1. 必须是文件
        // 2. 包含aria2c 或者是 LinkCore
        // 3. 不是备份文件（不以.backup结尾）
        // 4. 不是临时文件（不以.tmp结尾）
        const lowerFile = file.toLowerCase()
        if (stats.isFile() &&
            (file.includes('aria2c') || lowerFile === 'linkcore.exe' || lowerFile === 'linkcore') &&
            !file.endsWith('.backup') &&
            !file.endsWith('.tmp')) {
          engines.push(file)
        }
      })

      // 仅当默认引擎实际存在于引擎目录时，确保它位于列表首位
      const defaultBinPath = resolve(enginePath, binName)
      if (existsSync(defaultBinPath)) {
        if (engines.includes(binName)) {
          // 去重并置顶
          const filtered = engines.filter(e => e !== binName)
          engines.splice(0, engines.length, binName, ...filtered)
        } else {
          engines.unshift(binName)
        }
      }
    }
  } catch (error) {
    logger.error(`[Motrix] Get engine list failed: ${error}`)
  }

  return engines
}
