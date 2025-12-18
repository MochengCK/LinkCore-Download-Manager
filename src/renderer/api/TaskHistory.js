import Store from 'electron-store'
import { TASK_STATUS } from '@shared/constants'

// 定义任务历史记录存储
const taskHistoryStore = new Store({
  name: 'taskHistory',
  cwd: process.env.NODE_ENV === 'development' ? './dev-config' : undefined,
  defaults: {
    tasks: []
  }
})

class TaskHistory {
  /**
   * 保存已停止的任务到历史记录
   * @param {Array} tasks - 已停止的任务列表
   */
  saveStoppedTasks (tasks = []) {
    if (!Array.isArray(tasks)) {
      return
    }

    // 过滤出已完成、已失败和已移除的任务，以及种子解析任务和磁力链接任务
    const stoppedTasks = tasks.filter(task => {
      const { status } = task
      // 检查是否为种子解析任务（名称以[METADATA]开头）
      const isMetadataTask = task.name && task.name.startsWith('[METADATA]')
      // 检查是否为磁力链接任务
      const isMagnetTask = task.bittorrent && !task.bittorrent.info
      return isMetadataTask || isMagnetTask || [TASK_STATUS.COMPLETE, TASK_STATUS.ERROR, TASK_STATUS.REMOVED].includes(status)
    })

    if (stoppedTasks.length === 0) {
      return
    }

    // 获取当前历史记录
    const currentHistory = this.getHistory()
    const currentGids = new Set(currentHistory.map(task => task.gid))

    // 添加新的任务到历史记录
    const updatedHistory = [...currentHistory]
    stoppedTasks.forEach(task => {
      if (!currentGids.has(task.gid)) {
        updatedHistory.push({
          ...task,
          savedAt: Date.now()
        })
      }
    })

    // 保存更新后的历史记录
    taskHistoryStore.set('tasks', updatedHistory)
  }

  /**
   * 获取任务历史记录
   * @returns {Array} 任务历史记录列表
   */
  getHistory () {
    return taskHistoryStore.get('tasks', [])
  }

  updateTask (gid, patch = {}, fallbackTask = null) {
    if (!gid) {
      return
    }

    const currentHistory = this.getHistory()
    const idx = currentHistory.findIndex(task => task.gid === gid)
    const now = Date.now()

    if (idx === -1) {
      const base = fallbackTask && typeof fallbackTask === 'object' ? fallbackTask : { gid }
      taskHistoryStore.set('tasks', [
        ...currentHistory,
        {
          ...base,
          ...patch,
          savedAt: base.savedAt || now
        }
      ])
      return
    }

    const prev = currentHistory[idx] || {}
    const next = [...currentHistory]
    next[idx] = { ...prev, ...patch, savedAt: prev.savedAt || now }
    taskHistoryStore.set('tasks', next)
  }

  /**
   * 从历史记录中移除任务
   * @param {string} gid - 任务的GID
   */
  removeTask (gid) {
    const currentHistory = this.getHistory()
    const updatedHistory = currentHistory.filter(task => task.gid !== gid)
    taskHistoryStore.set('tasks', updatedHistory)
  }

  /**
   * 清空任务历史记录
   */
  clearHistory () {
    taskHistoryStore.set('tasks', [])
  }
}

export default new TaskHistory()
