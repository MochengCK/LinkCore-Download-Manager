import { access, constants, existsSync } from 'node:fs'
import { resolve, basename, dirname } from 'node:path'
import { shell, nativeTheme } from '@electron/remote'
import { Message } from 'element-ui'

import {
  getFileNameFromFile,
  isMagnetTask
} from '@shared/utils'
import { buildCategorizedPath } from '@shared/utils/file-categorize'
import { APP_THEME, TASK_STATUS } from '@shared/constants'

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
  const { dir, files, bittorrent } = task
  let result = resolve(dir)

  // Magnet link task
  if (isMagnetTask(task)) {
    return result
  }

  if (bittorrent && bittorrent.info && bittorrent.info.name) {
    result = resolve(result, bittorrent.info.name)
    return result
  }

  const [file] = files
  const path = file.path ? resolve(file.path) : ''
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

export const getTaskActualPath = (task, preferenceConfig = {}) => {
  const path = getTaskFullPath(task)
  if (!path) {
    return path
  }

  if (existsSync(path)) {
    return path
  }

  const config = preferenceConfig || {}
  const autoCategorizeFiles = config.autoCategorizeFiles
  const categories = config.fileCategories

  if (autoCategorizeFiles && categories && Object.keys(categories).length > 0) {
    const filename = basename(path)
    const baseDir = dirname(path)
    const categorizedInfo = buildCategorizedPath(path, filename, categories, baseDir)
    const categorizedPath = categorizedInfo.categorizedPath

    if (existsSync(categorizedPath)) {
      return categorizedPath
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

  const { dir, status } = task
  const path = getTaskFullPath(task)
  if (!path || dir === path) {
    console.warn('[Motrix] Invalid file path for task, skip deleting files')
    return true
  }

  let deleted = false

  try {
    if (existsSync(path)) {
      const target = resolve(path)
      console.log(`[Motrix] ${target} exists, deleting...`)
      await shell.trashItem(target)
      deleted = true
    } else if (downloadingFileSuffix) {
      const suffixedPath = `${path}${downloadingFileSuffix}`
      if (existsSync(suffixedPath)) {
        const target = resolve(suffixedPath)
        console.log(`[Motrix] ${target} exists, deleting...`)
        await shell.trashItem(target)
        deleted = true
      }
    }

    if (!deleted) {
      const config = preferenceConfig || {}
      const autoCategorizeFiles = config.autoCategorizeFiles
      const categories = config.fileCategories

      if (autoCategorizeFiles && categories && Object.keys(categories).length > 0) {
        const filename = basename(path)
        const baseDir = dirname(path)
        const categorizedInfo = buildCategorizedPath(path, filename, categories, baseDir)
        const categorizedPath = resolve(categorizedInfo.categorizedPath)

        if (existsSync(categorizedPath)) {
          console.log(`[Motrix] ${categorizedPath} exists, deleting...`)
          await shell.trashItem(categorizedPath)
          deleted = true
        }
      }
    }
  } catch (error) {
    console.warn('[Motrix] moveTaskFilesToTrash trashItem error:', error && error.message ? error.message : error)
  }

  // There is no configuration file for the completed task.
  if (status === TASK_STATUS.COMPLETE) {
    return true
  }

  const extraFilePath = `${path}.aria2`
  // 等待一段时间，确保.aria2文件有足够的时间被创建
  // 这是解决任务刚开始时.aria2文件未创建的问题的关键
  await new Promise(resolve => setTimeout(resolve, 100))

  // 检查.aria2文件是否存在，如果存在则删除
  try {
    const extraResolved = resolve(extraFilePath)
    if (existsSync(extraResolved)) {
      console.log(`[Motrix] ${extraResolved} exists, deleting...`)
      await shell.trashItem(extraResolved)
    } else {
      // 如果.aria2文件不存在，尝试再次检查，因为可能存在延迟
      await new Promise(resolve => setTimeout(resolve, 100))
      if (existsSync(extraResolved)) {
        console.log(`[Motrix] ${extraResolved} exists after delay, deleting...`)
        await shell.trashItem(extraResolved)
      }
    }
  } catch (error) {
    console.warn('[Motrix] moveTaskFilesToTrash extra file trashItem error:', error && error.message ? error.message : error)
  }

  // 总是返回true，因为文件删除失败不应该影响任务删除流程
  // 即使文件删除失败，任务也应该被从列表中移除
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
