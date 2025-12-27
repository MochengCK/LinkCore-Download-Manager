<template>
  <el-drawer
    custom-class="panel task-detail-drawer"
    size="61.8%"
    v-if="gid"
    :with-header="true"
    :show-close="false"
    :destroy-on-close="true"
    :visible="visible"
    :before-close="handleClose"
    @closed="handleClosed"
  >
    <div slot="title" class="task-detail-drawer-title">
      <span>{{ $t('task.task-detail-title') }}</span>
      <ul class="task-detail-drawer-actions">
        <li @click.stop="handleMinimize">
          <i class="el-icon-minus"></i>
        </li>
        <li @click.stop="handleHeaderClose">
          <i class="el-icon-close"></i>
        </li>
      </ul>
    </div>
    <div v-if="statusHintText" class="task-detail-hint">
      <el-tooltip
        effect="dark"
        :content="statusHintText"
        placement="bottom"
        :disabled="!statusHintTruncated"
      >
        <span
          ref="detailStatusText"
          class="task-detail-hint__text"
        >
          {{ statusHintText }}
        </span>
      </el-tooltip>
    </div>
    <div v-if="isCompleted" class="task-detail-completion-time">
      <span class="task-detail-completion-time__text">{{ $t('task.completed-at') }} {{ completionTime }}</span>
    </div>
    <el-tabs
      tab-position="top"
      class="task-detail-tab"
      value="general"
      :before-leave="handleTabBeforeLeave"
      @tab-click="handleTabClick"
    >
      <el-tab-pane name="general">
        <span class="task-detail-tab-label" slot="label">
          <el-tooltip
            effect="dark"
            :content="$t('task.task-detail-general')"
            placement="bottom"
            :open-delay="500"
          >
            <i class="el-icon-info"></i>
          </el-tooltip>
        </span>
        <mo-task-general :task="task" />
      </el-tab-pane>
      <el-tab-pane name="activity" lazy>
        <span class="task-detail-tab-label" slot="label">
          <el-tooltip
            effect="dark"
            :content="$t('task.task-detail-activity')"
            placement="bottom"
            :open-delay="500"
          >
            <i class="el-icon-s-grid"></i>
          </el-tooltip>
        </span>
        <mo-task-activity ref="taskGraphic" :task="task" />
      </el-tab-pane>
      <el-tab-pane name="trackers" lazy v-if="isBT">
        <span class="task-detail-tab-label" slot="label">
          <el-tooltip
            effect="dark"
            :content="$t('task.task-detail-trackers')"
            placement="bottom"
            :open-delay="500"
          >
            <i class="el-icon-discover"></i>
          </el-tooltip>
        </span>
        <mo-task-trackers :task="task" />
      </el-tab-pane>
      <el-tab-pane name="peers" lazy v-if="isBT">
        <span class="task-detail-tab-label" slot="label">
          <el-tooltip
            effect="dark"
            :content="$t('task.task-detail-peers')"
            placement="bottom"
            :open-delay="500"
          >
            <i class="el-icon-s-custom"></i>
          </el-tooltip>
        </span>
        <mo-task-peers :peers="peers" />
      </el-tab-pane>
      <el-tab-pane name="files" lazy>
        <span class="task-detail-tab-label" slot="label">
          <el-tooltip
            effect="dark"
            :content="$t('task.task-detail-files')"
            placement="bottom"
            :open-delay="500"
          >
            <i class="el-icon-files"></i>
          </el-tooltip>
        </span>
        <mo-task-files
          ref="detailFileList"
          mode="DETAIL"
          :files="fileList"
          @selection-change="handleSelectionChange"
        />
      </el-tab-pane>
      <el-tab-pane name="connections" lazy>
        <span class="task-detail-tab-label" slot="label">
          <el-tooltip
            effect="dark"
            :content="$t('task.task-detail-connections')"
            placement="bottom"
            :open-delay="500"
          >
            <i class="el-icon-connection"></i>
          </el-tooltip>
        </span>
        <mo-task-connections :task="task" />
      </el-tab-pane>
    </el-tabs>
    <div class="task-detail-actions">
      <div class="action-wrapper action-wrapper-left" v-if="optionsChanged">
        <el-button @click="resetChanged">
          {{$t('app.reset')}}
        </el-button>
      </div>
      <div class="action-wrapper action-wrapper-center">
        <mo-task-item-actions mode="DETAIL" :task="task" />
      </div>
      <div class="action-wrapper action-wrapper-right" v-if="optionsChanged">
        <el-button type="primary" @click="saveChanged">
          {{$t('app.save')}}
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script>
  import is from 'electron-is'
  import { debounce, merge } from 'lodash'
  import {
    calcFormLabelWidth,
    checkTaskIsBT,
    checkTaskIsSeeder,
    isMagnetTask,
    getFileName,
    getFileExtension
  } from '@shared/utils'
  import {
    EMPTY_STRING,
    NONE_SELECTED_FILES,
    SELECTED_ALL_FILES,
    TASK_STATUS
  } from '@shared/constants'
  import TaskItemActions from '@/components/Task/TaskItemActions'
  import TaskGeneral from './TaskGeneral'
  import TaskActivity from './TaskActivity'
  import TaskTrackers from './TaskTrackers'
  import TaskPeers from './TaskPeers'
  import TaskFiles from './TaskFiles'
  import TaskConnections from './TaskConnections'
  import { mapState } from 'vuex'

  const cached = {
    files: []
  }

  export default {
    name: 'mo-task-detail',
    components: {
      [TaskItemActions.name]: TaskItemActions,
      [TaskGeneral.name]: TaskGeneral,
      [TaskActivity.name]: TaskActivity,
      [TaskTrackers.name]: TaskTrackers,
      [TaskPeers.name]: TaskPeers,
      [TaskFiles.name]: TaskFiles,
      [TaskConnections.name]: TaskConnections
    },
    props: {
      gid: {
        type: String
      },
      task: {
        type: Object
      },
      files: {
        type: Array,
        default: function () {
          return []
        }
      },
      peers: {
        type: Array,
        default: function () {
          return []
        }
      },
      visible: {
        type: Boolean,
        default: false
      }
    },
    data () {
      const { locale } = this.$store.state.preference.config
      return {
        form: {},
        formLabelWidth: calcFormLabelWidth(locale),
        locale,
        activeTab: 'general',
        graphicWidth: 0,
        optionsChanged: false,
        filesSelection: EMPTY_STRING,
        selectionChangedCount: 0,
        statusHintTruncated: false
      }
    },
    computed: {
      ...mapState('task', {
        magnetStatuses: state => state.magnetStatuses,
        dataAccessStatuses: state => state.dataAccessStatuses
      }),
      ...mapState('preference', {
        preferenceConfig: state => state.config
      }),
      isRenderer: () => is.renderer(),
      isBT () {
        return checkTaskIsBT(this.task)
      },
      isSeeder () {
        return checkTaskIsSeeder(this.task)
      },
      magnetHintText () {
        const task = this.task || {}
        const zero = Number(task.downloadSpeed) === 0
        const isMagnet = isMagnetTask(task)

        // 检查任务是否已经完成解析（元数据已准备好）
        const metadataReady = task.totalLength > 0 && task.files && task.files.length > 0

        // 如果不是磁力链接、下载速度不为零、或者元数据已准备好，都不显示提示
        if (!(isMagnet && zero && !metadataReady)) return ''

        const s = this.magnetStatuses[task.gid]
        if (!s) return this.$t('task.magnet-fetching-metadata')
        const { peerCount = 0, trackerCount = 0, elapsedSec = 0, phase = '', peerTrend = 'flat', globalLimitLow = false, pauseMetadata = false } = s
        const cfg = this.preferenceConfig || {}
        const dhtEnabled = Number(cfg['dht-listen-port'] || cfg.dhtListenPort || 0) > 0
        const trackersConfigured = `${cfg['bt-tracker'] || cfg.btTracker || ''}`.trim().length > 0
        const elapsedMin = Math.floor(elapsedSec / 60)
        if (phase === 'no_trackers' || (peerCount === 0 && trackerCount === 0)) {
          const base = trackersConfigured ? this.$t('task.magnet-status-contacting-trackers', { trackerCount }) : this.$t('task.magnet-status-no-trackers')
          const suggest = this.$t('task.magnet-suggest-add-trackers')
          return `${base}，${suggest}`
        }
        if (phase === 'contacting_trackers' || (peerCount === 0 && trackerCount > 0)) {
          const base = this.$t('task.magnet-status-contacting-trackers', { trackerCount })
          if (elapsedMin >= 2) {
            const wait = this.$t('task.magnet-status-long-wait') + ' ' + this.$t('task.magnet-status-elapsed-minutes', { minutes: elapsedMin })
            const extra = dhtEnabled ? '' : (' ' + this.$t('task.magnet-suggest-open-port'))
            const limit = globalLimitLow ? (' ' + this.$t('task.magnet-suggest-limit')) : ''
            const paused = pauseMetadata ? (' ' + this.$t('task.magnet-suggest-unpause-metadata')) : ''
            return `${base}，${wait}${extra}${limit}${paused}`
          }
          return base
        }
        const peersText = this.$t('task.magnet-status-peers', { peerCount })
        const trackersText = this.$t('task.magnet-status-trackers', { trackerCount })
        if (elapsedMin >= 2) {
          const wait = this.$t('task.magnet-status-long-wait') + ' ' + this.$t('task.magnet-status-elapsed-minutes', { minutes: elapsedMin })
          const trendText = peerTrend === 'up' ? this.$t('task.magnet-trend-up') : (peerTrend === 'down' ? this.$t('task.magnet-trend-down') : this.$t('task.magnet-trend-flat'))
          const limit = globalLimitLow ? (' ' + this.$t('task.magnet-suggest-limit')) : ''
          const paused = pauseMetadata ? (' ' + this.$t('task.magnet-suggest-unpause-metadata')) : ''
          return `${peersText}，${trackersText}，${wait}，${trendText}${limit}${paused}`
        }
        const trendText = peerTrend === 'up' ? this.$t('task.magnet-trend-up') : (peerTrend === 'down' ? this.$t('task.magnet-trend-down') : '')
        return `${peersText}，${trackersText}${trendText ? '，' + trendText : ''}`
      },
      statusHintText () {
        const task = this.task || {}
        if (!task || !task.gid) {
          return ''
        }
        if (this.isBT && this.isSeeder) {
          return this.$t('task.bt-seeding-continue')
        }
        const magnetText = this.magnetHintText
        if (magnetText) {
          return magnetText
        }
        const status = task.status
        const isMagnet = isMagnetTask(task)
        if (isMagnet) {
          return ''
        }
        if (status === TASK_STATUS.ERROR) {
          const reason = this.resolveErrorReason(task.errorCode, task.errorMessage)
          if (reason) {
            return this.$t('task.download-fail-with-reason', { reason })
          }
          return this.$t('task.download-fail-notify')
        }
        const waitingStatuses = [TASK_STATUS.ACTIVE, TASK_STATUS.WAITING]
        if (!waitingStatuses.includes(status)) {
          return ''
        }
        const downloadSpeed = Number(task.downloadSpeed || 0)
        if (downloadSpeed > 0) {
          return ''
        }
        const gid = task.gid
        const statusInfo = (this.dataAccessStatuses && gid && this.dataAccessStatuses[gid]) || {}
        const elapsedSec = Number(statusInfo.elapsedSec || 0)
        if (elapsedSec < 10) {
          return ''
        }
        return this.$t('task.waiting-download-data')
      },
      resolveErrorReason () {
        return (errorCode, errorMessage = '') => {
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
        }
      },
      taskStatus () {
        const { task, isSeeder } = this
        if (isSeeder) {
          return TASK_STATUS.SEEDING
        } else {
          return task.status
        }
      },
      fileList () {
        const { files } = this
        const result = files.map((item) => {
          const name = getFileName(item.path)
          const extension = getFileExtension(name)
          return {
            idx: Number(item.index),
            selected: item.selected === 'true',
            path: item.path,
            name,
            extension: `.${extension}`,
            length: parseInt(item.length, 10),
            completedLength: item.completedLength
          }
        })
        merge(cached.files, result)
        return cached.files
      },
      selectedFileList () {
        const { fileList } = this
        const result = fileList.filter((item) => item.selected)

        return result
      },
      isCompleted () {
        if (!this.task) return false
        const completedStatuses = ['complete', 'error', 'removed']
        return completedStatuses.includes(this.task.status)
      },
      completionTime () {
        // 使用任务保存时间作为完成时间，如果没有保存时间则使用当前时间
        if (!this.task) return ''
        const timestamp = this.task.savedAt || Date.now()
        return new Date(timestamp).toLocaleString()
      }
    },
    mounted () {
      window.addEventListener('resize', this.handleAppResize)
    },
    destroyed () {
      window.removeEventListener('resize', this.handleAppResize)
      cached.files = []
    },
    watch: {
      gid () {
        cached.files = []
      },
      statusHintText () {
        this.updateStatusTruncation()
      }
    },
    methods: {
      handleMinimize () {
        this.handleClose()
      },
      handleHeaderClose () {
        this.handleClose()
      },
      handleClose (done) {
        window.removeEventListener('resize', this.handleAppResize)
        this.$store.dispatch('task/hideTaskDetail')
      },
      handleClosed (done) {
        this.$store.dispatch('task/updateCurrentTaskGid', EMPTY_STRING)
        this.$store.dispatch('task/updateCurrentTaskItem', null)
        this.optionsChanged = false
        this.resetFaskFilesSelection()
      },
      updateStatusTruncation () {
        this.$nextTick(() => {
          const el = this.$refs.detailStatusText
          if (!el || !el.scrollWidth || !el.clientWidth) {
            this.statusHintTruncated = false
            return
          }
          this.statusHintTruncated = el.scrollWidth > el.clientWidth
        })
      },
      handleTabBeforeLeave (activeName, oldActiveName) {
        this.activeTab = activeName
        this.optionsChanged = false
        switch (oldActiveName) {
        case 'peers':
          this.$store.dispatch('task/toggleEnabledFetchPeers', false)
          break
        case 'files':
          this.resetFaskFilesSelection()
          break
        }
      },
      handleTabClick (tab) {
        const { name } = tab
        switch (name) {
        case 'peers':
          this.$store.dispatch('task/toggleEnabledFetchPeers', true)
          break
        case 'files':
          setImmediate(() => {
            this.updateFilesListSelection()
          })
          break
        }
      },
      resetChanged () {
        const { activeTab } = this
        switch (activeTab) {
        case 'files':
          this.resetFaskFilesSelection()
          this.updateFilesListSelection()
          break
        }
        this.optionsChanged = false
      },
      saveChanged () {
        const { activeTab } = this
        switch (activeTab) {
        case 'files':
          this.saveFaskFilesSelection()
          break
        }
        this.optionsChanged = false
      },
      handleAppResize () {
        debounce(() => {
          console.log('resize===>', this.activeTab, this.$refs.taskGraphic)
          if (this.activeTab === 'activity' && this.$refs.taskGraphic) {
            this.$refs.taskGraphic.updateGraphicWidth()
          }
        }, 250)
      },
      updateFilesListSelection () {
        if (!this.$refs.detailFileList) {
          return
        }

        const { selectedFileList } = this
        this.$refs.detailFileList.toggleSelection(selectedFileList)
      },
      handleSelectionChange (val) {
        this.filesSelection = val
        this.selectionChangedCount += 1
        if (this.selectionChangedCount > 1) {
          this.optionsChanged = true
        }
      },
      resetFaskFilesSelection () {
        this.filesSelection = EMPTY_STRING
        this.selectionChangedCount = 0
      },
      saveFaskFilesSelection () {
        const { gid, filesSelection } = this
        if (filesSelection === NONE_SELECTED_FILES) {
          this.$msg.warning(this.$t('task.select-at-least-one'))
          return
        }

        const options = {
          selectFile: filesSelection !== SELECTED_ALL_FILES ? filesSelection : EMPTY_STRING
        }
        this.$store.dispatch('task/changeTaskOption', { gid, options })
      }
    }
  }
</script>

<style lang="scss">
.task-detail-drawer {
  min-width: 478px;
  .el-drawer__header {
    padding-top: 2rem;
    margin-bottom: 0;
  }
  .el-drawer__body {
    position: relative;
    overflow: hidden;
  }
  .task-detail-hint {
    padding: 0.25rem 1.25rem 0.5rem;
    color: #9B9B9B;
    .task-detail-hint__text {
      display: inline-block;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  .task-detail-completion-time {
    padding: 0.25rem 1.25rem 0.5rem;
    color: #9B9B9B;
    font-size: 0.875rem;
    .task-detail-completion-time__text {
      display: inline-block;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  .task-detail-actions {
    position: sticky;
    left: 0;
    bottom: 1rem;
    z-index: inherit;
    width: 100%;
    text-align: center;
    font-size: 0;
    padding: 0 1.25rem;
    display: flex;
    align-content: space-between;
    justify-content: space-between;
    .task-item-actions {
      display: inline-block;
      &> .task-item-action {
        margin: 0 0.5rem;
      }
    }
  }
  .task-detail-drawer-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    &> span, &> ul {
      vertical-align: middle;
    }
  }
  .task-detail-drawer-actions {
    display: inline-flex;
    list-style: none;
    margin: 0;
    padding: 0;
    li {
      cursor: pointer;
      padding: 0 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
  }
  .action-wrapper {
    flex: 1;
  }
  .action-wrapper-left {
    text-align: left;
  }
  .action-wrapper-center {
    padding: 1px 0;
    &> .task-item-actions {
      margin: 0 auto;
    }
  }
  .action-wrapper-right {
    text-align: right;
  }
}

.task-detail-tab {
  height: 100%;
  padding: 0.5rem 1.25rem 3.125rem;
  display: flex;
  flex-direction: column;
  .task-detail-tab-label {
    padding: 0 0.75rem;
  }
  .el-tabs__content {
    position: relative;
    height: 100%;
  }
  .el-tab-pane {
    overflow-x: hidden;
    overflow-y: auto;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
}

.tab-panel-actions {
  display: flex;
  justify-content: space-between;
  position: absolute;
  bottom: -28px;
  left: 0;
  width: 100%;
}
</style>
