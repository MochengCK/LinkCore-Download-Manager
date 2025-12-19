<template>
  <div v-if="false"></div>
</template>

<script>
  import is from 'electron-is'
  import { mapState } from 'vuex'
  import api from '@/api'
  import taskHistory from '@/api/TaskHistory'
  import {
    getTaskFullPath,
    getTaskActualPath,
    showItemInFolder
  } from '@/utils/native'

  import { checkTaskIsBT, getTaskName, isMagnetTask } from '@shared/utils'
  import { TASK_STATUS } from '@shared/constants'
  import { existsSync, renameSync, mkdirSync, utimesSync, statSync } from 'node:fs'
  import { dirname, basename, resolve, isAbsolute } from 'node:path'
  import {
    autoCategorizeDownloadedFile,
    buildCategorizedPath,
    createCategoryDirectory
  } from '@shared/utils/file-categorize'

  export default {
    name: 'mo-engine-client',
    data () {
      return {
        magnetZeroMap: {},
        magnetAlertedSet: new Set(),
        dataAccessZeroMap: {},
        dataAccessLastCompletedMap: {},
        pollingCount: 0,
        taskSpeedSampleBaseMap: {}
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
        // Throttle speed updates to avoid excessive IPC calls
        // Only update if it's been more than 800ms since last update
        const now = Date.now()
        if (this.lastSpeedUpdate && now - this.lastSpeedUpdate < 800) {
          return
        }
        this.lastSpeedUpdate = now

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
              } else {
                const message = this.$t('task.download-start-message', { taskName })
                this.$msg.info(message)
              }
            } catch (_) {}

            this.ensureTargetDirectoryExists(task)
            this.ensureCategoryDirectoryForTask(task)
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
            const reason = this.resolveErrorReason(errorCode, errorMessage)
            const message = reason
              ? this.$t('task.download-error-with-reason', { taskName, reason })
              : this.$t('task.download-error-message', { taskName })
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
        const cfg = this.$store.state.preference.config || {}
        const path = getTaskActualPath(task, cfg)
        const finalPath = isBT ? path : this.removeDownloadingSuffix(task, path, cfg)

        this.$store.dispatch('task/saveSession')
        this.persistAverageSpeedToHistory(task)
        try {
          const gid = task && task.gid ? `${task.gid}` : ''
          if (gid) {
            let name = ''
            if (isBT) {
              name = getTaskName(task, { maxLen: -1 })
            } else {
              const base = basename(finalPath || path || '')
              const suffix = cfg.downloadingFileSuffix || ''
              if (suffix && base.endsWith(suffix)) {
                name = base.slice(0, -suffix.length)
              } else {
                name = base
              }
            }
            if (name) {
              this.$store.dispatch('task/setTaskDisplayName', { gid, name })
            }
          }
        } catch (_) {}
        const notifyPath = finalPath || path
        this.showTaskCompleteNotify(task, isBT, notifyPath)
        this.$electron.ipcRenderer.send('event', 'task-download-complete', task, notifyPath)

        this.setFileMtimeOnComplete(task, finalPath)

        this.autoCategorizeDownloadedFile(task, finalPath)
      },
      persistAverageSpeedToHistory (task) {
        try {
          const gid = task && task.gid ? `${task.gid}` : ''
          if (!gid) {
            return
          }

          const map = this.$store.state.task.taskSpeedSamples || {}
          const samples = Array.isArray(map[gid]) ? map[gid] : []
          if (samples.length === 0) {
            return
          }

          const normalized = samples
            .map(s => {
              if (typeof s === 'number') {
                const speed = Number(s)
                if (!Number.isFinite(speed) || speed < 0) return null
                return { bytes: speed, durationMs: 1000 }
              }
              if (!s || typeof s !== 'object') return null
              const bytes = Number(s.bytes)
              const durationMs = Number(s.durationMs)
              if (!Number.isFinite(bytes) || bytes < 0) return null
              if (!Number.isFinite(durationMs) || durationMs <= 0) return null
              return { bytes, durationMs }
            })
            .filter(Boolean)

          const totalBytes = normalized.reduce((sum, it) => sum + it.bytes, 0)
          const totalDurationMs = normalized.reduce((sum, it) => sum + it.durationMs, 0)
          const avg = totalDurationMs > 0 ? Math.round((totalBytes * 1000) / totalDurationMs) : 0
          const count = normalized
            .map(it => (it.durationMs > 0 ? (it.bytes * 1000) / it.durationMs : 0))
            .filter(v => Number.isFinite(v) && v > 0).length

          taskHistory.updateTask(gid, { averageDownloadSpeed: avg, averageSpeedSampleCount: count }, task)
        } catch (_) {
        }
      },
      ensureTargetDirectoryExists (task) {
        const fullPath = getTaskFullPath(task)
        const targetDir = dirname(fullPath)
        if (!existsSync(targetDir)) {
          try {
            mkdirSync(targetDir, { recursive: true })
            console.log(`[Motrix] Created target directory: ${targetDir}`)
          } catch (error) {
            console.warn(`[Motrix] Failed to create target directory: ${error.message}`)
          }
        }
      },

      ensureCategoryDirectoryForTask (task) {
        const cfg = this.$store.state.preference.config || {}
        const autoCategorizeEnabled = cfg.autoCategorizeFiles
        const categories = cfg.fileCategories

        if (!autoCategorizeEnabled || !categories || Object.keys(categories).length === 0) {
          return
        }

        const categoryNames = Object.keys(categories).map(key => {
          const categoryConfig = categories[key] || {}
          return categoryConfig.name || key
        })

        const isBTTask = checkTaskIsBT(task)

        if (isBTTask) {
          const files = Array.isArray(task.files) ? task.files : []

          files.forEach(file => {
            const filePath = file.path || ''
            if (!filePath) {
              return
            }

            const baseDir = dirname(filePath)
            const dirName = basename(baseDir)

            if (categoryNames.includes(dirName)) {
              return
            }

            const filename = basename(filePath)
            const categorizedInfo = buildCategorizedPath(filePath, filename, categories, baseDir)
            createCategoryDirectory(categorizedInfo.categorizedDir)
          })

          return
        }

        const filePath = getTaskFullPath(task)
        if (!filePath) {
          return
        }

        const baseDir = dirname(filePath)
        const dirName = basename(baseDir)

        if (categoryNames.includes(dirName)) {
          return
        }

        const filename = basename(filePath)
        const categorizedInfo = buildCategorizedPath(filePath, filename, categories, baseDir)
        createCategoryDirectory(categorizedInfo.categorizedDir)
      },

      removeDownloadingSuffix (task, manualPath = '', preferenceConfig = null) {
        const cfg = preferenceConfig || this.$store.state.preference.config || {}
        const downloadingFileSuffix = cfg.downloadingFileSuffix || ''

        const currentPath = manualPath || getTaskActualPath(task, cfg) || getTaskFullPath(task)
        if (!currentPath || !downloadingFileSuffix) {
          return currentPath
        }

        if (currentPath.endsWith(downloadingFileSuffix)) {
          const originalPath = currentPath.slice(0, -downloadingFileSuffix.length)
          // 尝试重命名
          if (existsSync(currentPath)) {
            const ok = this.renamePreserveTimes(currentPath, originalPath)
            if (ok) {
              console.log(`[Motrix] Removed downloading suffix: ${currentPath} -> ${originalPath}`)
              return originalPath
            } else {
              console.warn(`[Motrix] Failed to remove downloading suffix: ${currentPath} -> ${originalPath}`)
            }
          } else if (existsSync(originalPath)) {
            // 如果原文件已存在（可能已经被重命名），直接返回原路径
            return originalPath
          }
          // 如果都不存在，假设原路径是目标路径
          return originalPath
        } else {
          const suffixedPath = currentPath + downloadingFileSuffix
          if (existsSync(suffixedPath)) {
            const ok = this.renamePreserveTimes(suffixedPath, currentPath)
            if (ok) {
              console.log(`[Motrix] Removed downloading suffix: ${suffixedPath} -> ${currentPath}`)
              return currentPath
            } else {
              console.warn(`[Motrix] Failed to remove downloading suffix: ${suffixedPath} -> ${currentPath}`)
            }
          }
          return currentPath
        }
      },
      autoCategorizeDownloadedFile (task, manualPath = null) {
        const cfg = this.$store.state.preference.config || {}
        const autoCategorizeEnabled = cfg.autoCategorizeFiles

        if (!autoCategorizeEnabled) {
          console.log('[Motrix] Auto categorize files is disabled')
          return
        }

        const categories = cfg.fileCategories
        if (!categories || Object.keys(categories).length === 0) {
          console.log('[Motrix] No file categories configured, skip auto categorize')
          return
        }

        const downloadingFileSuffix = cfg.downloadingFileSuffix || ''
        const categoryNames = Object.keys(categories).map(key => {
          const categoryConfig = categories[key] || {}
          return categoryConfig.name || key
        })

        const isBTTask = checkTaskIsBT(task)

        if (isBTTask) {
          // ... BT task logic ...
          const files = Array.isArray(task.files) ? task.files : []
          const taskDir = task && task.dir ? resolve(task.dir) : ''
          const btName = task && task.bittorrent && task.bittorrent.info && task.bittorrent.info.name
            ? `${task.bittorrent.info.name}`
            : ''

          files.forEach(file => {
            // ... logic unchanged for BT tasks as they usually don't use simple suffix ...
            const total = Number(file.length || 0)
            const done = Number(file.completedLength || 0)
            if (!total || done < total) {
              return
            }

            const rawFilePath = file && file.path ? `${file.path}` : ''
            if (!rawFilePath) {
              return
            }

            const candidates = []
            if (isAbsolute(rawFilePath)) {
              candidates.push(resolve(rawFilePath))
            } else if (taskDir) {
              candidates.push(resolve(taskDir, rawFilePath))
              if (btName) {
                candidates.push(resolve(taskDir, btName, rawFilePath))
              }
            }

            // 对于 BT 任务，我们也尝试处理后缀
            let filePath = candidates.find(p => existsSync(p)) || ''
            if (!filePath && downloadingFileSuffix) {
              filePath = candidates
                .map(p => `${p}${downloadingFileSuffix}`)
                .find(p => existsSync(p)) || ''
            }
            if (!filePath) {
              filePath = candidates[0] || ''
            }

            // ... rename logic for BT ...
            try {
              if (downloadingFileSuffix) {
                if (filePath.endsWith(downloadingFileSuffix) && existsSync(filePath)) {
                  const originalPath = filePath.slice(0, -downloadingFileSuffix.length)
                  const ok = this.renamePreserveTimes(filePath, originalPath)
                  if (ok) {
                    console.log(`[Motrix] Removed downloading suffix before categorize: ${filePath} -> ${originalPath}`)
                    filePath = originalPath
                  }
                }
              }
            } catch (error) {
              console.warn(`[Motrix] Failed to normalize downloading suffix before categorize: ${error.message}`)
            }

            if (!existsSync(filePath)) {
              return
            }

            try {
              const baseDir = dirname(filePath)
              const dirName = basename(baseDir)

              if (categoryNames.includes(dirName)) {
                return
              }

              const result = autoCategorizeDownloadedFile(filePath, baseDir, categories)
              if (result) {
                console.log(`[Motrix] File categorized successfully: ${filePath}`)
              }
            } catch (error) {
              console.error(`[Motrix] Error during auto categorization: ${error.message}`)
            }
          })

          return
        }

        let filePath = manualPath || getTaskFullPath(task)

        // 如果手动传入了路径，我们假设它已经是处理过后缀的正确路径
        // 如果没有传入，我们需要像以前一样尝试查找和处理后缀
        if (!manualPath) {
          try {
            if (downloadingFileSuffix) {
              if (filePath.endsWith(downloadingFileSuffix) && existsSync(filePath)) {
                const originalPath = filePath.slice(0, -downloadingFileSuffix.length)
                const ok = this.renamePreserveTimes(filePath, originalPath)
                if (ok) {
                  console.log(`[Motrix] Removed downloading suffix before categorize: ${filePath} -> ${originalPath}`)
                  filePath = originalPath
                }
              } else {
                const suffixedPath = filePath + downloadingFileSuffix
                if (!existsSync(filePath) && existsSync(suffixedPath)) {
                  const ok = this.renamePreserveTimes(suffixedPath, filePath)
                  if (ok) {
                    console.log(`[Motrix] Restored downloading suffix before categorize: ${suffixedPath} -> ${filePath}`)
                  }
                }
              }
            }
          } catch (error) {
            console.warn(`[Motrix] Failed to normalize downloading suffix before categorize: ${error.message}`)
          }
        }

        if (!existsSync(filePath)) {
          console.warn(`[Motrix] File not found for categorization: ${filePath}`)
          return
        }

        try {
          const baseDir = dirname(filePath)
          const dirName = basename(baseDir)

          if (categoryNames.includes(dirName)) {
            console.log(`[Motrix] File already in category directory: ${filePath}`)
            return
          }

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
      setFileMtimeOnComplete (task, manualPath = null) {
        const enabled = this.$store.state.preference.config.setFileMtimeOnComplete
        if (!enabled) {
          return
        }

        try {
          const filePath = manualPath || getTaskFullPath(task)
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
        this.pollingCount = (this.pollingCount || 0) + 1
        // 每30次polling（约30秒）保存一次平均速度
        if (this.pollingCount % 30 === 0) {
          this.persistAllActiveTasksAverageSpeed()
        }

        this.$store.dispatch('app/fetchGlobalStat')
        this.$store.dispatch('app/fetchProgress')
        this.$store.dispatch('task/fetchList').then(() => {
          this.sampleAverageSpeedForActiveTasks()
          this.checkMagnetAlerts()
          this.checkDataAccessStatus()
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
      restoreSuffixFilesForActiveTasks () {
        const suffix = this.$store.state.preference.config.downloadingFileSuffix
        if (!suffix) {
          return
        }

        api.fetchTaskList({ type: 'all' }).then((tasks) => {
          tasks.forEach(task => {
            if ([TASK_STATUS.COMPLETE, TASK_STATUS.ERROR, TASK_STATUS.REMOVED].includes(task.status)) {
              return
            }

            if (checkTaskIsBT(task)) {
              return
            }

            try {
              const finalPath = getTaskFullPath(task)
              const suffixedPath = finalPath + suffix

              // 如果存在后缀文件，且原文件不存在或大小为0
              if (existsSync(suffixedPath)) {
                let shouldRestore = false
                if (!existsSync(finalPath)) {
                  shouldRestore = true
                } else {
                  try {
                    const st = statSync(finalPath)
                    if (st.size === 0) {
                      shouldRestore = true
                    }
                  } catch (e) {
                    shouldRestore = true
                  }
                }

                if (shouldRestore) {
                  // 如果原文件存在但大小为0，先删除
                  if (existsSync(finalPath)) {
                    try {
                      require('fs').unlinkSync(finalPath)
                    } catch (e) {
                      console.warn(`[Motrix] Failed to remove empty file: ${finalPath}`, e)
                    }
                  }

                  const ok = this.renamePreserveTimes(suffixedPath, finalPath)
                  if (ok) {
                    console.log(`[Motrix] Restored suffix on startup: ${suffixedPath} -> ${finalPath}`)
                  } else {
                    console.warn(`[Motrix] Failed to restore suffix on startup: ${suffixedPath} -> ${finalPath}`)
                  }
                }
              }
            } catch (err) {
              console.warn(`[Motrix] restoreSuffixFilesForActiveTasks error for task ${task.gid}:`, err)
            }
          })
        })
      },
      persistAllActiveTasksAverageSpeed () {
        const list = this.$store.state.task.taskList || []
        list.forEach(task => {
          if (task.status === TASK_STATUS.ACTIVE) {
            this.persistAverageSpeedToHistory(task)
          }
        })
      },
      sampleAverageSpeedForActiveTasks () {
        const list = this.$store.state.task.taskList || []
        const activeGids = new Set()
        const now = Date.now()
        list.forEach(task => {
          if (!task) {
            return
          }
          if (task.status !== TASK_STATUS.ACTIVE) {
            return
          }
          const gid = task.gid ? `${task.gid}` : ''
          if (!gid) {
            return
          }
          activeGids.add(gid)

          const completed = Number(task.completedLength || 0)
          if (!Number.isFinite(completed) || completed < 0) {
            this.taskSpeedSampleBaseMap[gid] = { ts: now, completed: 0 }
            return
          }

          const prev = this.taskSpeedSampleBaseMap[gid]
          if (!prev || !Number.isFinite(prev.ts) || !Number.isFinite(prev.completed)) {
            this.taskSpeedSampleBaseMap[gid] = { ts: now, completed }
            return
          }

          const durationMs = now - prev.ts
          const bytes = completed - prev.completed
          if (!(durationMs > 0) || durationMs > 15000 || durationMs < 200 || bytes < 0) {
            this.taskSpeedSampleBaseMap[gid] = { ts: now, completed }
            return
          }

          this.taskSpeedSampleBaseMap[gid] = { ts: now, completed }
          this.$store.dispatch('task/addTaskSpeedSample', {
            gid,
            sample: { bytes, durationMs },
            maxSamples: 60
          })
        })

        Object.keys(this.taskSpeedSampleBaseMap || {}).forEach(gid => {
          if (!activeGids.has(gid)) {
            delete this.taskSpeedSampleBaseMap[gid]
          }
        })
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
      checkDataAccessStatus () {
        const list = this.$store.state.task.taskList || []
        const activeStatuses = ['active', 'waiting']
        list.forEach(task => {
          const gid = task.gid
          const status = task.status
          const isMagnet = isMagnetTask(task)
          if (!activeStatuses.includes(status) || isMagnet) {
            this.dataAccessZeroMap[gid] = 0
            this.dataAccessLastCompletedMap[gid] = undefined
            this.$store.dispatch('task/clearDataAccessStatus', gid)
            return
          }
          const completed = Number(task.completedLength || 0)
          const speedZero = Number(task.downloadSpeed) === 0
          const lastCompleted = Number(this.dataAccessLastCompletedMap[gid] || 0)
          if (!speedZero || completed > lastCompleted) {
            this.dataAccessLastCompletedMap[gid] = completed
            this.dataAccessZeroMap[gid] = 0
            this.$store.dispatch('task/clearDataAccessStatus', gid)
            return
          }
          const count = (this.dataAccessZeroMap[gid] || 0) + 1
          this.dataAccessZeroMap[gid] = count
          const elapsedSec = Math.round(count * (this.interval / 1000))
          this.$store.dispatch('task/updateDataAccessStatus', {
            gid,
            elapsedSec,
            updatedAt: Date.now()
          })
        })
      },
      resolveErrorReason (errorCode, errorMessage = '') {
        const code = Number(errorCode)
        if (!code) {
          return ''
        }
        const msg = `${errorMessage || ''}`
        if (code === 3) {
          return this.$t('task.error-reason-not-found')
        }
        if (code === 1) {
          if (/SSL|TLS|certificate/i.test(msg)) {
            return this.$t('task.error-reason-ssl')
          }
          return this.$t('task.error-reason-network')
        }
        if (code === 16) {
          if (/Permission denied|permission/i.test(msg)) {
            return this.$t('task.error-reason-permission')
          }
          if (/No space left|disk full/i.test(msg)) {
            return this.$t('task.error-reason-disk-full')
          }
          return this.$t('task.error-reason-disk')
        }
        return this.$t('task.error-reason-generic')
      },
      stopPolling () {
        clearTimeout(this.timer)
        this.timer = null
      }
    },
    created () {
      this.bindEngineEvents()
    },
    mounted () {
      setTimeout(() => {
        this.$store.dispatch('app/fetchEngineInfo')
        this.$store.dispatch('app/fetchEngineOptions')

        this.startPolling()
      }, 100)
    },
    destroyed () {
      this.$store.dispatch('task/saveSession')

      this.unbindEngineEvents()

      this.stopPolling()
    }
  }
</script>

<style>
 </style>
