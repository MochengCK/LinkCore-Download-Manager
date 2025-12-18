import { access, constants, existsSync } from 'node:fs'
import { resolve, basename, dirname, isAbsolute } from 'node:path'
import { shell, nativeTheme } from '@electron/remote'
import { Message } from 'element-ui'

import {
  getFileNameFromFile,
  isMagnetTask
} from '@shared/utils'
import { buildCategorizedPath } from '@shared/utils/file-categorize'
import { APP_THEME } from '@shared/constants'

export const showItemInFolder = (fullPath, { errorMsg }) => {
  if (!fullPath) {
    return
  }

  fullPath = resolve(fullPath)
  access(fullPath, constants.F_OK, (err) => {
    console.warn(`[Motrix] ${fullPath} ${err ? 'does not exist' : 'exists'}`)
    if (err && errorMsg) {
      Message.error(errorMsg)
      return
    }

    shell.showItemInFolder(fullPath)
  })
}

export const openItem = async (fullPath) => {
  if (!fullPath) {
    return
  }

  const result = await shell.openPath(fullPath)
  return result
}

export const getTaskFullPath = (task) => {
  const { dir, files, bittorrent } = task || {}
  let result = resolve(dir || '')

  // Magnet link task
  if (isMagnetTask(task)) {
    return result
  }

  if (bittorrent && bittorrent.info && bittorrent.info.name) {
    result = resolve(result, bittorrent.info.name)
    return result
  }

  const [file] = Array.isArray(files) ? files : []
  const rawPath = file && file.path ? `${file.path}` : ''
  const path = rawPath
    ? (isAbsolute(rawPath) ? resolve(rawPath) : resolve(result, rawPath))
    : ''
  let fileName = ''

  if (path) {
    result = path
  } else {
    if (files && files.length === 1) {
      fileName = getFileNameFromFile(file)
      if (fileName) {
        result = resolve(result, fileName)
      }
    }
  }

  return result
}

export const getPathCandidates = (originPath, suffix, config) => {
  const candidates = new Set()
  if (!originPath) return []

  // 1. Determine Logical Paths (Original and Suffix-removed)
  const logicalPaths = new Set()
  logicalPaths.add(originPath)

  if (suffix && originPath.endsWith(suffix)) {
    logicalPaths.add(originPath.slice(0, -suffix.length))
  }

  // 2. Determine Base Paths (Logical + Categorized)
  const basePaths = new Set(logicalPaths)

  const autoCategorizeFiles = config && config.autoCategorizeFiles
  const categories = config && config.fileCategories

  if (autoCategorizeFiles && categories && Object.keys(categories).length > 0) {
    for (const p of logicalPaths) {
      try {
        const filename = basename(p)
        const baseDir = dirname(p)
        const categorizedInfo = buildCategorizedPath(p, filename, categories, baseDir)
        if (categorizedInfo && categorizedInfo.categorizedPath) {
          basePaths.add(categorizedInfo.categorizedPath)
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // 3. Generate Physical Paths (Base + Suffix variants)
  for (const p of basePaths) {
    candidates.add(p)
    if (suffix) {
      candidates.add(`${p}${suffix}`)
      if (p.endsWith(suffix)) {
        candidates.add(p.slice(0, -suffix.length))
      }
    }
  }

  return Array.from(candidates)
}

export const getTaskActualPath = (task, preferenceConfig = {}) => {
  const path = getTaskFullPath(task)
  if (!path) {
    return path
  }

  const config = preferenceConfig || {}
  const suffix = config.downloadingFileSuffix

  const candidates = getPathCandidates(path, suffix, config)

  for (const p of candidates) {
    if (existsSync(p)) {
      return p
    }
  }

  return path
}

export const moveTaskFilesToTrash = async (task, downloadingFileSuffix = '', preferenceConfig = {}) => {
  /**
   * For magnet link tasks, there is bittorrent, but there is no bittorrent.info.
   * The path is not a complete path before it becomes a BT task.
   * In order to avoid accidentally deleting the directory
   * where the task is located, it directly returns true when deleting.
   */
  if (isMagnetTask(task)) {
    return true
  }

  const { dir } = task
  const path = getTaskFullPath(task)
  if (!path || dir === path) {
    console.warn('[Motrix] Invalid file path for task, skip deleting files')
    return true
  }

  const config = preferenceConfig || {}
  const suffix = downloadingFileSuffix || config.downloadingFileSuffix || ''
  const candidates = getPathCandidates(path, suffix, config)

  for (const p of candidates) {
    // Delete main file
    try {
      if (existsSync(p)) {
        const target = resolve(p)
        console.log(`[Motrix] ${target} exists, deleting...`)
        await shell.trashItem(target)
      }
    } catch (e) {
      console.warn(`[Motrix] Failed to trash ${p}:`, e)
    }

    // Delete .aria2 file
    // Check for .aria2 file corresponding to this candidate
    const aria2Path = `${p}.aria2`
    try {
      if (existsSync(aria2Path)) {
        console.log(`[Motrix] ${aria2Path} exists, deleting...`)
        await shell.trashItem(aria2Path)
      }
    } catch (e) {
      console.warn(`[Motrix] Failed to trash ${aria2Path}:`, e)
    }
  }

  return true
}

export const getSystemTheme = () => {
  return nativeTheme.shouldUseDarkColors ? APP_THEME.DARK : APP_THEME.LIGHT
}

export const delayDeleteTaskFiles = (task, delay, downloadingFileSuffix = '', preferenceConfig = {}) => {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const result = await moveTaskFilesToTrash(task, downloadingFileSuffix, preferenceConfig)
        resolve(result)
      } catch (err) {
        reject(err.message)
      }
    }, delay)
  })
}
