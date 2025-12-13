<template>
  <div v-if="false"></div>
</template>

<script>
  import is from 'electron-is'
  import { mapState } from 'vuex'
  import api from '@/api'
  import {
    getTaskFullPath,
    showItemInFolder
  } from '@/utils/native'
  import taskScheduler from '@/utils/TaskScheduler'
  import { checkTaskIsBT, getTaskName, isMagnetTask } from '@shared/utils'
  import { existsSync, renameSync, mkdirSync, utimesSync, statSync } from 'node:fs'
  import { dirname } from 'path'
  import { autoCategorizeDownloadedFile } from '@shared/utils/file-categorize'

  export default {
    name: 'mo-engine-client',
    data () {
      return {
        magnetZeroMap: {},
        magnetAlertedSet: new Set(),
        schedulerInitialized: false
      }
    },
    computed: {
      isRenderer: () => is.renderer(),
      ...mapState('app', {
        uploadSpeed: state => state.stat.uploadSpeed,
        downloadSpeed: state => state.stat.downloadSpeed,
        speed: state => state.stat.uploadSpeed + state.stat.downloadSpeed,
        interval: state => state.interval,
        downloading: state => state.stat.numActive > 0,
        progress: state => state.progress
      }),
      ...mapState('task', {
        messages: state => state.messages,
        seedingList: state => state.seedingList,
        taskDetailVisible: state => state.taskDetailVisible,
        enabledFetchPeers: state => state.enabledFetchPeers,
        currentTaskGid: state => state.currentTaskGid,
        currentTaskItem: state => state.currentTaskItem
      }),
      ...mapState('preference', {
        taskNotification: state => state.config.taskNotification
      }),
      currentTaskIsBT () {
        return checkTaskIsBT(this.currentTaskItem)
      }
    },
    watch: {
      speed (val) {
        const { uploadSpeed, downloadSpeed } = this
        this.$electron.ipcRenderer.send('event', 'speed-change', {
          uploadSpeed,
          downloadSpeed
        })
      },
      downloading (val, oldVal) {
        if (val !== oldVal && this.isRenderer) {
          this.$electron.ipcRenderer.send('event', 'download-status-change', val)
        }
      },
      progress (val) {
        this.$electron.ipcRenderer.send('event', 'progress-change', val)
      },
      // 监听调度器配置变化
      '$store.state.preference.config.scheduler': {
        handler (newConfig) {
          if (newConfig) {
            taskScheduler.updateUserConfig(newConfig)
          }
        },
        deep: true
      }
    },
    methods: {
      renamePreserveTimes (from, to) {
        try {
          const st = statSync(from)
          renameSync(from, to)
          try {
            utimesSync(to, st.atime, st.mtime)
          } catch (e) {}
          return true
        } catch (e) {
          try {
            renameSync(from, to)
            return true
          } catch (_) {
            return false
          }
        }
      },
      async fetchTaskItem ({ gid }) {
        return api.fetchTaskItem({ gid })
          .catch((e) => {
            console.warn(`fetchTaskItem fail: ${e.message}`)
          })
      },
      onDownloadStart (event) {
        this.$store.dispatch('task/fetchList')
        this.$store.dispatch('app/resetInterval')
        this.$store.dispatch('task/saveSession')
        const [{ gid }] = event
        const { seedingList } = this
        if (seedingList.includes(gid)) {
          return
        }

        this.fetchTaskItem({ gid })
          .then(async (task) => {
            const { dir } = task
            this.$store.dispatch('preference/recordHistoryDirectory', dir)
            const taskName = getTaskName(task)
            try {
              const opt = await api.getOption({ gid })
              const hs = opt && opt.header ? opt.header : []
              const headers = Array.isArray(hs) ? hs : (typeof hs === 'string' ? [hs] : [])
              const fromHeader = headers.some(h => /X-LinkCore-Source\s*:\s*BrowserExtension/i.test(`${h}`))
              const fromReferer = !!(opt && opt.referer && /^https?:/i.test(`${opt.referer}`))
              if (fromHeader || fromReferer) {
                const message = this.$t('task.download-start-browser-message')
                this.$msg.info(message)
                if (is.windows()) {
                  /* eslint-disable no-new */
                  new Notification(message, { body: taskName })
                }
              }
            } catch (_) {}

            // 自动创建目标文件夹
            this.ensureTargetDirectoryExists(task)

            // 添加下载中文件后缀
            this.addDownloadingSuffix(task)
          })
      },
      onDownloadPause (event) {
        const [{ gid }] = event
        const { seedingList } = this
        if (seedingList.includes(gid)) {
          return
        }

        this.fetchTaskItem({ gid })
          .then((task) => {
            const taskName = getTaskName(task)
            const message = this.$t('task.download-pause-message', { taskName })
            this.$msg.info(message)
          })
      },
      onDownloadStop (event) {
        const [{ gid }] = event
        this.fetchTaskItem({ gid })
          .then((task) => {
            const taskName = getTaskName(task)
            const message = this.$t('task.download-stop-message', { taskName })
            this.$msg.info(message)
          })
      },
      onDownloadError (event) {
        const [{ gid }] = event
        this.fetchTaskItem({ gid })
          .then((task) => {
            const taskName = getTaskName(task)
            const { errorCode, errorMessage } = task
            console.error(`[Motrix] download error gid: ${gid}, #${errorCode}, ${errorMessage}`)
            const message = this.$t('task.download-error-message', { taskName })
            const link = `<a target="_blank" href="https://github.com/agalwood/Motrix/wiki/Error#${errorCode}" rel="noopener noreferrer">${errorCode}</a>`
            this.$msg({
              type: 'error',
              showClose: true,
              duration: 5000,
              dangerouslyUseHTMLString: true,
              message: `${message} ${link}`
            })
          })
      },
      onDownloadComplete (event) {
        this.$store.dispatch('task/fetchList')
        const [{ gid }] = event
        this.$store.dispatch('task/removeFromSeedingList', gid)

        // 清理调度器中的任务监控数据
        this.cleanupSchedulerTask(gid)

        this.fetchTaskItem({ gid })
          .then((task) => {
            this.handleDownloadComplete(task, false)
          })
      },
      onBtDownloadComplete (event) {
        this.$store.dispatch('task/fetchList')
        const [{ gid }] = event
        const { seedingList } = this
        if (seedingList.includes(gid)) {
          return
        }

        this.$store.dispatch('task/addToSeedingList', gid)

        this.fetchTaskItem({ gid })
          .then((task) => {
            this.handleDownloadComplete(task, true)
          })
      },
      handleDownloadComplete (task, isBT) {
        this.$store.dispatch('task/saveSession')

        const path = getTaskFullPath(task)
        this.showTaskCompleteNotify(task, isBT, path)
        this.$electron.ipcRenderer.send('event', 'task-download-complete', task, path)

        this.autoCategorizeDownloadedFile(task)

        this.setFileMtimeOnComplete(task)
      },
      ensureTargetDirectoryExists (task) {
        // 获取任务完整路径
        const fullPath = getTaskFullPath(task)

        // 获取目标文件夹路径
        const targetDir = dirname(fullPath)

        // 检查文件夹是否存在，如果不存在则创建
        if (!existsSync(targetDir)) {
          try {
            mkdirSync(targetDir, { recursive: true })
            console.log(`[Motrix] Created target directory: ${targetDir}`)
          } catch (error) {
            console.warn(`[Motrix] Failed to create target directory: ${error.message}`)
          }
        }
      },

      addDownloadingSuffix (task) {
        // 获取下载中文件后缀配置
        const downloadingFileSuffix = this.$store.state.preference.config.downloadingFileSuffix

        // 获取任务完整路径
        const originalPath = getTaskFullPath(task)
        if (checkTaskIsBT(task)) {
          return
        }

        // 使用轮询方式检查文件是否存在，然后添加后缀
        this.pollForFileAndAddSuffix(originalPath, downloadingFileSuffix, 0)
      },

      pollForFileAndAddSuffix (originalPath, suffix, attempt) {
        const maxAttempts = 30 // 最多尝试30次（约30秒）

        if (attempt >= maxAttempts) {
          console.warn(`[Motrix] Failed to add downloading suffix after ${maxAttempts} attempts: ${originalPath}`)
          return
        }

        // 检查文件是否存在
        if (existsSync(originalPath) && !originalPath.endsWith(suffix)) {
          const newPath = originalPath + suffix
          const ok = this.renamePreserveTimes(originalPath, newPath)
          if (ok) {
            console.log(`[Motrix] Added downloading suffix: ${originalPath} -> ${newPath}`)
          } else {
            console.warn(`[Motrix] Failed to add downloading suffix: ${originalPath} -> ${newPath}`)
          }
        } else if (!originalPath.endsWith(suffix)) {
          // 文件还不存在，继续轮询
          setTimeout(() => {
            this.pollForFileAndAddSuffix(originalPath, suffix, attempt + 1)
          }, 1000) // 每秒检查一次
        }
      },

      removeDownloadingSuffix (task) {
        // 获取下载中文件后缀配置
        const downloadingFileSuffix = this.$store.state.preference.config.downloadingFileSuffix

        // 获取任务完整路径
        const currentPath = getTaskFullPath(task)

        // 如果文件有下载中后缀，则移除后缀
        if (currentPath.endsWith(downloadingFileSuffix)) {
          const originalPath = currentPath.slice(0, -downloadingFileSuffix.length)
          const ok = this.renamePreserveTimes(currentPath, originalPath)
          if (ok) {
            console.log(`[Motrix] Removed downloading suffix: ${currentPath} -> ${originalPath}`)
          } else {
            console.warn(`[Motrix] Failed to remove downloading suffix: ${currentPath} -> ${originalPath}`)
          }
        } else {
          // 检查是否有带后缀的文件存在（可能文件已经被重命名）
          const suffixedPath = currentPath + downloadingFileSuffix
          if (existsSync(suffixedPath)) {
            const ok = this.renamePreserveTimes(suffixedPath, currentPath)
            if (ok) {
              console.log(`[Motrix] Removed downloading suffix: ${suffixedPath} -> ${currentPath}`)
            } else {
              console.warn(`[Motrix] Failed to remove downloading suffix: ${suffixedPath} -> ${currentPath}`)
            }
          }
        }
      },
      autoCategorizeDownloadedFile (task) {
        // 检查是否启用了自动分类功能
        const autoCategorizeEnabled = this.$store.state.preference.config.autoCategorizeFiles

        if (!autoCategorizeEnabled) {
          console.log('[Motrix] Auto categorize files is disabled')
          return
        }

        // 获取任务完整路径
        const filePath = getTaskFullPath(task)

        if (!existsSync(filePath)) {
          console.warn(`[Motrix] File not found for categorization: ${filePath}`)
          return
        }

        try {
          // 获取下载目录作为基础目录
          const baseDir = dirname(filePath)
          // 获取分类配置
          const categories = this.$store.state.preference.config.fileCategories

          // 调用自动分类功能
          const result = autoCategorizeDownloadedFile(filePath, baseDir, categories)
          if (result) {
            console.log(`[Motrix] File categorized successfully: ${filePath}`)
          } else {
            console.warn('[Motrix] File categorization failed or file already in category')
          }
        } catch (error) {
          console.error(`[Motrix] Error during auto categorization: ${error.message}`)
        }
      },
      setFileMtimeOnComplete (task) {
        const enabled = this.$store.state.preference.config.setFileMtimeOnComplete
        if (!enabled) {
          return
        }

        try {
          const filePath = getTaskFullPath(task)
          if (!existsSync(filePath)) {
            return
          }
          const now = new Date()
          utimesSync(filePath, now, now)
        } catch (error) {
          console.warn(`[Motrix] Failed to set file mtime on complete: ${error.message}`)
        }
      },
      showTaskCompleteNotify (task, isBT, path) {
        const taskName = getTaskName(task)
        const message = isBT
          ? this.$t('task.bt-download-complete-message', { taskName })
          : this.$t('task.download-complete-message', { taskName })
        const tips = isBT
          ? '\n' + this.$t('task.bt-download-complete-tips')
          : ''

        this.$msg.success(`${message}${tips}`)

        if (!this.taskNotification) {
          return
        }

        const notifyMessage = isBT
          ? this.$t('task.bt-download-complete-notify')
          : this.$t('task.download-complete-notify')

        /* eslint-disable no-new */
        const notify = new Notification(notifyMessage, {
          body: `${taskName}${tips}`
        })
        notify.onclick = () => {
          showItemInFolder(path, {
            errorMsg: this.$t('task.file-not-exist')
          })
        }
      },
      showTaskErrorNotify (task) {
        const taskName = getTaskName(task)

        const message = this.$t('task.download-fail-message', { taskName })
        this.$msg.success(message)

        if (!this.taskNotification) {
          return
        }

        /* eslint-disable no-new */
        new Notification(this.$t('task.download-fail-notify'), {
          body: taskName
        })
      },
      bindEngineEvents () {
        api.client.on('onDownloadStart', this.onDownloadStart)
        // api.client.on('onDownloadPause', this.onDownloadPause)
        api.client.on('onDownloadStop', this.onDownloadStop)
        api.client.on('onDownloadComplete', this.onDownloadComplete)
        api.client.on('onDownloadError', this.onDownloadError)
        api.client.on('onBtDownloadComplete', this.onBtDownloadComplete)
      },
      unbindEngineEvents () {
        api.client.removeListener('onDownloadStart', this.onDownloadStart)
        // api.client.removeListener('onDownloadPause', this.onDownloadPause)
        api.client.removeListener('onDownloadStop', this.onDownloadStop)
        api.client.removeListener('onDownloadComplete', this.onDownloadComplete)
        api.client.removeListener('onDownloadError', this.onDownloadError)
        api.client.removeListener('onBtDownloadComplete', this.onBtDownloadComplete)
      },
      startPolling () {
        this.timer = setTimeout(() => {
          this.polling()
          this.startPolling()
        }, this.interval)
      },
      polling () {
        this.$store.dispatch('app/fetchGlobalStat')
        this.$store.dispatch('app/fetchProgress')
        this.$store.dispatch('task/fetchList').then(() => {
          this.checkMagnetAlerts()
          const list = this.$store.state.task.taskList || []
          list.forEach(task => this.maybeRestoreSuffixNearCompletion(task))
          // 执行动态负载均衡检测
          this.checkAndExecuteLoadBalancing(list)
        })

        if (this.taskDetailVisible && this.currentTaskGid) {
          // 只对活跃任务调用 fetchItemWithPeers 或 fetchItem，避免对历史记录任务调用 aria2 API
          // 通过检查任务状态来判断是否为活跃任务
          const task = this.$store.state.task.currentTaskItem
          if (task) {
            // 检查任务状态，如果是已完成、已失败或已移除状态，不调用 API
            const activeStatuses = ['active', 'waiting', 'paused']
            if (activeStatuses.includes(task.status)) {
              if (this.currentTaskIsBT && this.enabledFetchPeers) {
                this.$store.dispatch('task/fetchItemWithPeers', this.currentTaskGid)
              } else {
                this.$store.dispatch('task/fetchItem', this.currentTaskGid)
              }
            }
          }
        }
      },
      maybeRestoreSuffixNearCompletion (task) {
        try {
          const suffix = this.$store.state.preference.config.downloadingFileSuffix
          if (!suffix) return
          const isBT = checkTaskIsBT(task)
          if (isBT) return
          const total = Number(task.totalLength || 0)
          const done = Number(task.completedLength || 0)
          if (total <= 0) return
          const ratio = done / total
          if (ratio < 0.99) return
          const finalPath = getTaskFullPath(task)
          const suffixedPath = finalPath + suffix
          if (existsSync(suffixedPath) && !existsSync(finalPath)) {
            const ok = this.renamePreserveTimes(suffixedPath, finalPath)
            if (ok) {
              console.log(`[Motrix] Restored suffix near completion: ${suffixedPath} -> ${finalPath}`)
            }
          }
        } catch (_) {}
      },
      async alertMagnetStatus (task) {
        try {
          const gid = task.gid
          const detailed = await api.fetchTaskItemWithPeers({ gid })
          const peers = Array.isArray(detailed.peers) ? detailed.peers : []
          const bt = detailed.bittorrent || {}
          const announceList = bt.announceList || []
          const trackerCount = Array.isArray(announceList) ? announceList.length : 0
          const peerCount = peers.length

          let phase = 'contacting_trackers'
          if (trackerCount === 0) {
            phase = 'no_trackers'
          } else if (peerCount > 0) {
            phase = 'peers_connected'
          }
          const cfg = this.$store.state.preference?.config || {}
          const dhtListenPort = Number(cfg['dht-listen-port'] || 0)
          const dhtEnabled = dhtListenPort > 0
          this.$store.dispatch('task/updateMagnetStatus', {
            gid,
            peerCount,
            trackerCount,
            fetching: true,
            phase,
            dhtEnabled,
            updatedAt: Date.now()
          })
          this.magnetAlertedSet.add(gid)
        } catch (e) {
          console.warn('alertMagnetStatus fail:', e.message)
        }
      },
      checkMagnetAlerts () {
        const list = this.$store.state.task.taskList || []
        list.forEach(task => {
          const gid = task.gid
          const zero = Number(task.downloadSpeed) === 0
          const magnetPending = isMagnetTask(task)

          if (magnetPending && zero) {
            const count = (this.magnetZeroMap[gid] || 0) + 1
            this.magnetZeroMap[gid] = count
            const elapsedSec = Math.round(count * (this.interval / 1000))
            // 读取上一状态用于趋势判断
            const prev = (this.$store.state.task.magnetStatuses || {})[gid] || {}
            const prevPeers = Number(prev.peerCount || 0)
            const peerCount = Number((task.peers || []).length || prevPeers)
            let peerTrend = 'flat'
            if (peerCount > prevPeers) peerTrend = 'up'
            else if (peerCount < prevPeers) peerTrend = 'down'

            const cfg = this.$store.state.preference?.config || {}
            const limitStr = `${cfg['max-overall-download-limit'] || cfg.maxOverallDownloadLimit || 0}`
            const globalLimitLow = !(limitStr === '0' || Number(limitStr) >= 102400)
            const pauseMetadata = !!(cfg['pause-metadata'] || cfg.pauseMetadata)

            this.$store.dispatch('task/updateMagnetStatus', {
              gid,
              fetching: true,
              elapsedSec,
              updatedAt: Date.now(),
              peerCount,
              peerTrend,
              globalLimitLow,
              pauseMetadata
            })
            if (count >= 3 && !this.magnetAlertedSet.has(gid)) {
              this.alertMagnetStatus(task)
            }
          } else {
            this.magnetZeroMap[gid] = 0
            if (!magnetPending) {
              this.$store.dispatch('task/clearMagnetStatus', gid)
              if (this.magnetAlertedSet.has(gid)) {
                this.magnetAlertedSet.delete(gid)
              }
            }
          }
        })
      },
      stopPolling () {
        clearTimeout(this.timer)
        this.timer = null
      },
      /**
       * 初始化调度器回调（静默模式，用户无感知）
       */
      initScheduler () {
        if (this.schedulerInitialized) return

        // 从 store 中读取调度器配置并更新
        const schedulerConfig = this.$store.state.preference.config.scheduler
        if (schedulerConfig) {
          taskScheduler.updateUserConfig(schedulerConfig)
        }

        taskScheduler.setCallbacks({
          onRebalanceStart: (gid, options = {}) => {
            // 静默模式：不显示任何 UI 通知
          },
          onRebalanceComplete: (gid, success, error, options = {}) => {
            // 静默模式：不显示任何 UI 通知
          }
        })

        this.schedulerInitialized = true
      },
      /**
       * 检查并执行负载均衡（静默执行）
       */
      async checkAndExecuteLoadBalancing (taskList) {
        if (!taskList || taskList.length === 0) return

        for (const task of taskList) {
          // 跳过 BT 任务，BT 任务有自己的片段分配机制
          if (checkTaskIsBT(task)) {
            continue
          }

          // 检测任务是否需要负载均衡
          const result = taskScheduler.updateTaskMonitor(task)

          if (result.needsRebalance) {
            // 静默执行负载均衡
            await taskScheduler.executeRebalance(task.gid, {
              pauseTask: (params) => api.forcePauseTask(params),
              resumeTask: (params) => api.resumeTask(params),
              changeOption: (params) => api.changeOption(params)
            })

            // 每次只处理一个任务，避免并发问题
            break
          }
        }
      },
      /**
       * 清理已完成任务的调度器数据
       */
      cleanupSchedulerTask (gid) {
        taskScheduler.cleanupCompletedTask(gid)
      }
    },
    created () {
      this.bindEngineEvents()
    },
    mounted () {
      setTimeout(() => {
        this.$store.dispatch('app/fetchEngineInfo')
        this.$store.dispatch('app/fetchEngineOptions')

        // 初始化负载均衡调度器
        this.initScheduler()

        this.startPolling()
      }, 100)
    },
    destroyed () {
      this.$store.dispatch('task/saveSession')

      this.unbindEngineEvents()

      this.stopPolling()

      // 清理调度器
      taskScheduler.cleanup()
    }
  }
</script>

<style>
 </style>
