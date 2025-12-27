import { EventEmitter } from 'node:events'
import logger from './Logger'

/**
 * PriorityManager - 任务优先级管理器
 *
 * 功能：
 * - 根据用户在新建任务时设置的优先级自动工作
 * - 高优先级任务（priority > 0）优先获得更多连接数和带宽
 * - 普通任务（priority = 0）平分剩余资源，保证不会饿死
 */
class PriorityManager extends EventEmitter {
  constructor (options = {}) {
    super()
    this.configManager = options.configManager
    this.engine = null

    // 资源分配配置
    this.maxConcurrentDownloads = 5
    this.maxConnectionsPerTask = 16
    this.minConnectionsPerTask = 4

    // 调度定时器
    this.scheduleInterval = null
    this.initialized = false
  }

  init (options = {}) {
    if (this.initialized) return

    this.engine = options.engine
    this.loadConfig()
    this.startScheduler()
    this.initialized = true
    logger.info('[PriorityManager] Initialized')
  }

  loadConfig () {
    if (!this.configManager) return

    try {
      this.maxConcurrentDownloads = this.configManager.getSystemConfig('max-concurrent-downloads') || 5
      this.maxConnectionsPerTask = this.configManager.getSystemConfig('max-connection-per-server') || 16
      // 最小连接数自动根据每个服务器最大连接数计算，取其 1/4，最小为 1，最大为 4
      const autoMin = Math.max(1, Math.min(4, Math.floor(this.maxConnectionsPerTask / 4)))
      this.minConnectionsPerTask = autoMin
    } catch (err) {
      logger.warn('[PriorityManager] loadConfig error:', err.message)
    }
  }

  startScheduler () {
    if (this.scheduleInterval) return

    // 每 2 秒检查一次资源分配
    this.scheduleInterval = setInterval(() => {
      if (this.engine) {
        this.rebalanceResources()
      }
    }, 2000)
  }

  /**
   * 从配置中获取任务优先级
   */
  getTaskPriorityFromConfig (task) {
    if (!task || !this.configManager) return 0

    try {
      const taskPriorities = this.configManager.getUserConfig('taskPriorities') || {}
      const downloadingSuffix = this.configManager.getUserConfig('downloadingFileSuffix') || ''

      const dir = task.dir || ''
      let filename = ''

      if (task.files && task.files[0] && task.files[0].path) {
        const filePath = task.files[0].path
        filename = filePath.split(/[\\/]/).pop() || ''
      }

      if (!filename && task.bittorrent && task.bittorrent.info && task.bittorrent.info.name) {
        filename = task.bittorrent.info.name
      }

      if (!filename && task.files && task.files[0] && task.files[0].uris && task.files[0].uris[0]) {
        const uri = task.files[0].uris[0].uri || ''
        try {
          const url = new URL(uri)
          filename = url.pathname.split('/').pop() || ''
        } catch (e) {
          filename = uri.split('/').pop() || ''
        }
      }

      if (dir && filename) {
        const keysToTry = [`${dir}|${filename}`]

        if (downloadingSuffix && filename.endsWith(downloadingSuffix)) {
          const filenameWithoutSuffix = filename.slice(0, -downloadingSuffix.length)
          keysToTry.push(`${dir}|${filenameWithoutSuffix}`)
        }

        if (downloadingSuffix && !filename.endsWith(downloadingSuffix)) {
          keysToTry.push(`${dir}|${filename}${downloadingSuffix}`)
        }

        for (const key of keysToTry) {
          const priority = Number(taskPriorities[key]) || 0
          if (priority > 0) {
            logger.debug(`[PriorityManager] Task ${task.gid} priority: ${priority} (matched key: ${key})`)
            return priority
          }
        }
      }
    } catch (err) {
      logger.debug('[PriorityManager] getTaskPriorityFromConfig error:', err.message)
    }

    return 0
  }

  /**
   * 重新平衡资源分配
   */
  async rebalanceResources () {
    if (!this.engine) return

    try {
      this.loadConfig()

      const activeTasks = await this.engine.call('tellActive')

      const allActive = (activeTasks || []).map(task => ({
        ...task,
        _priority: this.getTaskPriorityFromConfig(task)
      }))

      await this.reallocateConnections(allActive)
    } catch (err) {
      logger.error('[PriorityManager] rebalanceResources error:', err.message)
    }
  }

  /**
   * 重新分配连接数
   */
  async reallocateConnections (activeTasks) {
    if (!activeTasks || activeTasks.length === 0) return

    const highPriorityTasks = activeTasks.filter(t => t._priority > 0)
    const normalTasks = activeTasks.filter(t => t._priority === 0)

    const totalConnections = this.maxConcurrentDownloads * this.maxConnectionsPerTask

    if (highPriorityTasks.length === 0) {
      const perTask = Math.min(
        Math.floor(totalConnections / normalTasks.length),
        this.maxConnectionsPerTask
      )
      await this.applyAllocation(normalTasks, Math.max(perTask, this.minConnectionsPerTask))
      return
    }

    if (normalTasks.length === 0) {
      await this.applyGradedAllocation(highPriorityTasks, totalConnections)
      return
    }

    // 高优先级任务获得 70% 资源
    const highShare = Math.floor(totalConnections * 0.7)
    const normalShare = totalConnections - highShare

    await this.applyGradedAllocation(highPriorityTasks, highShare)

    const normalPerTask = Math.min(
      Math.floor(normalShare / normalTasks.length),
      this.maxConnectionsPerTask
    )
    await this.applyAllocation(normalTasks, Math.max(normalPerTask, this.minConnectionsPerTask))
  }

  async applyGradedAllocation (tasks, totalConnections) {
    if (!tasks || tasks.length === 0) return

    const sorted = [...tasks].sort((a, b) => b._priority - a._priority)
    const totalWeight = sorted.reduce((sum, t) => sum + (t._priority || 1), 0)

    for (const task of sorted) {
      const weight = task._priority || 1
      let connections = Math.floor((weight / totalWeight) * totalConnections)
      connections = Math.max(connections, this.minConnectionsPerTask)
      connections = Math.min(connections, this.maxConnectionsPerTask)
      await this.applyTaskAllocation(task, connections)
    }
  }

  async applyAllocation (tasks, connectionsPerTask) {
    if (!tasks || tasks.length === 0 || connectionsPerTask <= 0) return
    for (const task of tasks) {
      await this.applyTaskAllocation(task, connectionsPerTask)
    }
  }

  async applyTaskAllocation (task, connections) {
    const options = {
      'max-connection-per-server': String(connections),
      split: String(connections)
    }
    try {
      await this.engine.call('changeOption', task.gid, options)
    } catch (err) {
      logger.debug(`[PriorityManager] Failed to apply allocation to ${task.gid}:`, err.message)
    }
  }

  onTaskComplete () {
    this.rebalanceResources()
  }

  getStatus () {
    return {
      maxConcurrentDownloads: this.maxConcurrentDownloads,
      maxConnectionsPerTask: this.maxConnectionsPerTask,
      minConnectionsPerTask: this.minConnectionsPerTask
    }
  }

  updateConfig () {
    this.loadConfig()
    logger.info('[PriorityManager] Config updated')
    this.rebalanceResources()
  }

  stop () {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval)
      this.scheduleInterval = null
    }
    logger.info('[PriorityManager] Stopped')
  }
}

export default PriorityManager
