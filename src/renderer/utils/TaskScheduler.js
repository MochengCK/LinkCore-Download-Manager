/**
 * TaskScheduler - 动态负载均衡调度器
 *
 * 解决问题：
 * 1. 当下载任务接近完成时，部分连接已完成其分配的片段而闲置，导致整体下载速度下降
 * 2. 任务长时间处于低速状态，需要重新分配连接以提高速度
 *
 * 解决方案：
 * 1. 监控任务进度和速度变化
 * 2. 当检测到任务完成度高且速度明显下降，或长时间低速时
 * 3. 通过暂停/恢复任务触发 aria2 重新分配连接
 * 4. 整个过程静默执行，用户无感知
 */

import { TASK_STATUS } from '@shared/constants'

// 调度器默认配置
const DEFAULT_CONFIG = {
  // 触发负载均衡的进度阈值（90%）- 高进度模式
  PROGRESS_THRESHOLD: 0.90,

  // 速度下降阈值（当前速度低于峰值速度的30%时触发）
  SPEED_DROP_THRESHOLD: 0.30,

  // 低速触发阈值（当速度低于峰值的20%时，不论进度都可触发）
  LOW_SPEED_THRESHOLD: 0.20,

  // 最小触发间隔（毫秒），避免频繁重分配
  MIN_REBALANCE_INTERVAL: 15000,

  // 任务监控历史记录数量
  SPEED_HISTORY_SIZE: 15,

  // 最小文件大小（字节），小于此大小的任务不进行负载均衡
  MIN_FILE_SIZE: 10 * 1024 * 1024, // 10MB

  // 连续低速次数阈值（高进度模式）
  LOW_SPEED_COUNT_THRESHOLD: 3,

  // 连续低速次数阈值（普通模式，需要更多次检测）
  SUSTAINED_LOW_SPEED_COUNT: 8,

  // 最小峰值速度阈值（只有峰值超过此值才考虑低速触发）
  MIN_PEAK_SPEED: 100 * 1024, // 100KB/s

  // 单个任务最大重分配次数
  MAX_REBALANCE_PER_TASK: 5
}

class TaskScheduler {
  constructor () {
    // 任务监控数据
    // { gid: { speedHistory: [], peakSpeed: 0, lastRebalanceTime: 0, lowSpeedCount: 0 } }
    this.taskMonitors = new Map()

    // 调度器是否启用（默认不启用，等待配置加载）
    this.enabled = false

    // 动态配置（可由用户设置更新）
    this.config = { ...DEFAULT_CONFIG }

    // 负载均衡执行中的任务
    this.rebalancingTasks = new Set()

    // 回调函数
    this.callbacks = {
      onRebalanceStart: null,
      onRebalanceComplete: null,
      onSpeedRecovered: null
    }
  }

  /**
   * 更新用户配置
   * @param {Object} userConfig - 用户配置对象
   */
  updateUserConfig (userConfig) {
    if (!userConfig) return

    const {
      enabled,
      lowSpeedThreshold,
      minPeakSpeed,
      minPeakSpeedUnit,
      minFileSize,
      minFileSizeUnit,
      maxRebalanceCount
    } = userConfig

    // 更新启用状态
    if (typeof enabled === 'boolean') {
      this.setEnabled(enabled)
    }

    // 更新低速阈值（百分比转小数）
    if (typeof lowSpeedThreshold === 'number' && lowSpeedThreshold > 0) {
      this.config.LOW_SPEED_THRESHOLD = lowSpeedThreshold / 100
    }

    // 更新最小峰值速度（根据单位转换为字节/秒）
    if (typeof minPeakSpeed === 'number' && minPeakSpeed > 0) {
      const speedMultiplier = minPeakSpeedUnit === 'M' ? 1024 * 1024 : 1024
      this.config.MIN_PEAK_SPEED = minPeakSpeed * speedMultiplier
    }

    // 更新最小文件大小（根据单位转换为字节）
    if (typeof minFileSize === 'number' && minFileSize > 0) {
      const sizeMultiplier = minFileSizeUnit === 'G' ? 1024 * 1024 * 1024 : 1024 * 1024
      this.config.MIN_FILE_SIZE = minFileSize * sizeMultiplier
    }

    // 更新最大重分配次数
    if (typeof maxRebalanceCount === 'number' && maxRebalanceCount > 0) {
      this.config.MAX_REBALANCE_PER_TASK = maxRebalanceCount
    }
  }

  /**
   * 启用/禁用调度器
   */
  setEnabled (enabled) {
    this.enabled = enabled
    if (!enabled) {
      this.taskMonitors.clear()
      this.rebalancingTasks.clear()
    }
  }

  /**
   * 设置回调函数
   */
  setCallbacks (callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  /**
   * 更新任务监控数据
   * @param {Object} task - 任务对象
   * @returns {Object} - 监控状态
   */
  updateTaskMonitor (task) {
    if (!this.enabled || !task) {
      return { needsRebalance: false }
    }

    const { gid, status, totalLength, completedLength, downloadSpeed } = task
    const total = Number(totalLength || 0)
    const completed = Number(completedLength || 0)
    const speed = Number(downloadSpeed || 0)

    // 只监控活动任务
    if (status !== TASK_STATUS.ACTIVE) {
      this.taskMonitors.delete(gid)
      return { needsRebalance: false }
    }

    // 文件太小不进行负载均衡
    if (total < this.config.MIN_FILE_SIZE) {
      return { needsRebalance: false }
    }

    // 获取或创建监控数据
    let monitor = this.taskMonitors.get(gid)
    if (!monitor) {
      monitor = {
        speedHistory: [],
        peakSpeed: 0,
        lastRebalanceTime: 0,
        lowSpeedCount: 0,
        rebalanceCount: 0
      }
      this.taskMonitors.set(gid, monitor)
    }

    // 更新速度历史
    monitor.speedHistory.push(speed)
    if (monitor.speedHistory.length > this.config.SPEED_HISTORY_SIZE) {
      monitor.speedHistory.shift()
    }

    // 更新峰值速度
    if (speed > monitor.peakSpeed) {
      monitor.peakSpeed = speed
    }

    // 计算进度
    const progress = total > 0 ? completed / total : 0

    // 判断是否需要负载均衡
    const result = this.checkNeedsRebalance(gid, monitor, progress, speed)

    return result
  }

  /**
   * 检查是否需要执行负载均衡
   */
  checkNeedsRebalance (gid, monitor, progress, currentSpeed) {
    const now = Date.now()

    // 如果正在重分配中，跳过
    if (this.rebalancingTasks.has(gid)) {
      return { needsRebalance: false, reason: 'rebalancing' }
    }

    // 检查最小间隔
    if (now - monitor.lastRebalanceTime < this.config.MIN_REBALANCE_INTERVAL) {
      return { needsRebalance: false, reason: 'interval' }
    }

    // 检查重分配次数限制
    if (monitor.rebalanceCount >= this.config.MAX_REBALANCE_PER_TASK) {
      return { needsRebalance: false, reason: 'max_rebalance' }
    }

    // 计算平均速度
    const avgSpeed = this.calculateAverageSpeed(monitor.speedHistory)

    // 检查速度是否明显下降
    const speedRatio = monitor.peakSpeed > 0 ? avgSpeed / monitor.peakSpeed : 1

    // 模式1：高进度 + 速度下降（原有逻辑）
    if (progress >= this.config.PROGRESS_THRESHOLD) {
      const isSpeedLow = speedRatio < this.config.SPEED_DROP_THRESHOLD

      if (isSpeedLow) {
        monitor.lowSpeedCount++
      } else {
        monitor.lowSpeedCount = Math.max(0, monitor.lowSpeedCount - 1)
      }

      if (monitor.lowSpeedCount >= this.config.LOW_SPEED_COUNT_THRESHOLD) {
        return {
          needsRebalance: true,
          reason: 'high_progress_speed_drop',
          progress,
          currentSpeed,
          peakSpeed: monitor.peakSpeed,
          avgSpeed,
          speedRatio
        }
      }
    }

    // 模式2：持续低速（不论进度，只要速度长时间过低就触发）
    // 只有当峰值速度超过阈值时才考虑（避免对本身就慢的任务进行无效重分配）
    if (monitor.peakSpeed >= this.config.MIN_PEAK_SPEED) {
      const isSustainedLowSpeed = speedRatio < this.config.LOW_SPEED_THRESHOLD

      if (isSustainedLowSpeed) {
        monitor.sustainedLowSpeedCount = (monitor.sustainedLowSpeedCount || 0) + 1
      } else {
        monitor.sustainedLowSpeedCount = 0
      }

      if (monitor.sustainedLowSpeedCount >= this.config.SUSTAINED_LOW_SPEED_COUNT) {
        return {
          needsRebalance: true,
          reason: 'sustained_low_speed',
          progress,
          currentSpeed,
          peakSpeed: monitor.peakSpeed,
          avgSpeed,
          speedRatio
        }
      }
    }

    return { needsRebalance: false, reason: 'speed_ok' }
  }

  /**
   * 计算平均速度
   */
  calculateAverageSpeed (history) {
    if (!history || history.length === 0) return 0
    const sum = history.reduce((acc, val) => acc + val, 0)
    return sum / history.length
  }

  /**
   * 执行负载均衡（静默执行，用户无感知）
   * @param {string} gid - 任务 GID
   * @param {Function} pauseTask - 暂停任务函数
   * @param {Function} resumeTask - 恢复任务函数
   * @param {Function} changeOption - 修改任务选项函数
   */
  async executeRebalance (gid, { pauseTask, resumeTask, changeOption }) {
    if (this.rebalancingTasks.has(gid)) {
      return false
    }

    const monitor = this.taskMonitors.get(gid)
    if (!monitor) {
      return false
    }

    this.rebalancingTasks.add(gid)

    try {
      // 触发回调（静默模式，不显示 UI 通知）
      if (this.callbacks.onRebalanceStart) {
        this.callbacks.onRebalanceStart(gid, { silent: true })
      }

      // 步骤1：暂停任务
      await pauseTask({ gid })

      // 步骤2：短暂等待确保暂停生效
      await this.delay(300)

      // 步骤3：尝试调整任务选项以优化分片
      try {
        await changeOption({
          gid,
          options: {
            'min-split-size': '512K'
          }
        })
      } catch (e) {
        // 某些选项在任务运行后不能修改，忽略错误
      }

      // 步骤4：恢复任务 - 这会触发 aria2 重新分配连接
      await resumeTask({ gid })

      // 更新监控数据
      monitor.lastRebalanceTime = Date.now()
      monitor.lowSpeedCount = 0
      monitor.sustainedLowSpeedCount = 0
      monitor.rebalanceCount++
      // 重置峰值速度，让系统重新学习
      monitor.peakSpeed = monitor.peakSpeed * 0.7

      // 触发回调
      if (this.callbacks.onRebalanceComplete) {
        this.callbacks.onRebalanceComplete(gid, true, null, { silent: true })
      }

      return true
    } catch (error) {
      if (this.callbacks.onRebalanceComplete) {
        this.callbacks.onRebalanceComplete(gid, false, error, { silent: true })
      }

      return false
    } finally {
      this.rebalancingTasks.delete(gid)
    }
  }

  /**
   * 获取任务监控信息
   */
  getTaskMonitorInfo (gid) {
    return this.taskMonitors.get(gid) || null
  }

  /**
   * 获取所有监控信息
   */
  getAllMonitorInfo () {
    const result = {}
    this.taskMonitors.forEach((monitor, gid) => {
      result[gid] = {
        ...monitor,
        avgSpeed: this.calculateAverageSpeed(monitor.speedHistory),
        isRebalancing: this.rebalancingTasks.has(gid)
      }
    })
    return result
  }

  /**
   * 清理已完成任务的监控数据
   */
  cleanupCompletedTask (gid) {
    this.taskMonitors.delete(gid)
    this.rebalancingTasks.delete(gid)
  }

  /**
   * 清理所有监控数据
   */
  cleanup () {
    this.taskMonitors.clear()
    this.rebalancingTasks.clear()
  }

  /**
   * 延迟函数
   */
  delay (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取调度器统计信息
   */
  getStats () {
    let totalRebalances = 0
    this.taskMonitors.forEach(monitor => {
      totalRebalances += monitor.rebalanceCount
    })

    return {
      enabled: this.enabled,
      monitoredTasks: this.taskMonitors.size,
      rebalancingTasks: this.rebalancingTasks.size,
      totalRebalances: totalRebalances
    }
  }
}

// 创建单例实例
const taskScheduler = new TaskScheduler()

export default taskScheduler
export { TaskScheduler, DEFAULT_CONFIG }
