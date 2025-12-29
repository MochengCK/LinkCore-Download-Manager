<template>
  <el-form
    class="mo-task-general"
    ref="form"
    :model="form"
    :label-width="formLabelWidth"
    v-if="task"
  >
    <el-form-item :label="`${$t('task.task-gid')}: `">
      <div class="form-static-value">
        {{ task.gid }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-name')}: `">
      <div class="form-static-value">
        {{ taskFullName }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-dir')}: `">
      <el-input placeholder="" readonly v-model="path">
        <mo-show-in-folder
          slot="append"
          v-if="isRenderer"
          :path="path"
        />
      </el-input>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-status')}: `">
      <div class="form-static-value">
        <mo-task-status :theme="currentTheme" :status="taskStatus" />
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.completed-at')}: `" v-if="isCompleted">
      <div class="form-static-value">
        {{ completionTime }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-priority')}: `">
      <div class="form-static-value">
        {{ taskPriority }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.security-scan-status')}: `" v-if="isCompleted">
      <div class="form-static-value">
        <span :class="securityScanStatusClass">
          {{ securityScanStatusText }}
        </span>
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-error-info')}: `" v-if="task.errorCode && task.errorCode !== '0'">
      <div class="form-static-value">
        {{ task.errorCode }} {{ task.errorMessage }}
      </div>
    </el-form-item>

    <el-divider v-if="isBT">
      <i class="el-icon-attract"></i>
      {{ $t('task.task-bittorrent-info') }}
    </el-divider>

    <el-form-item :label="`${$t('task.task-info-hash')}: `" v-if="isBT">
      <div class="form-static-value">
        {{ task.infoHash }}
        <el-tooltip
          effect="dark"
          :content="$t('task.copy-link')"
          placement="top"
          :open-delay="500"
        >
          <i class="copy-link" @click="handleCopyClick">
            <mo-icon
              name="link"
              width="12"
              height="12"
            />
          </i>
        </el-tooltip>
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-piece-length')}: `" v-if="isBT">
      <div class="form-static-value">
        {{ task.pieceLength | bytesToSize }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-num-pieces')}: `" v-if="isBT">
      <div class="form-static-value">
        {{ task.numPieces }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-bittorrent-creation-date')}: `" v-if="isBT">
      <div class="form-static-value">
        {{ task.bittorrent.creationDate | localeDateTimeFormat(locale) }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-bittorrent-comment')}: `" v-if="isBT">
      <div class="form-static-value">
        {{ task.bittorrent.comment }}
      </div>
    </el-form-item>
  </el-form>
</template>

<script>
  import is from 'electron-is'
  import { mapState } from 'vuex'
  import {
    bytesToSize,
    calcFormLabelWidth,
    checkTaskIsBT,
    checkTaskIsSeeder,
    getTaskName,
    getTaskUri,
    localeDateTimeFormat
  } from '@shared/utils'
  import { APP_THEME, TASK_STATUS } from '@shared/constants'
  import { getTaskActualPath } from '@/utils/native'
  import ShowInFolder from '@/components/Native/ShowInFolder'
  import TaskStatus from '@/components/Task/TaskStatus'
  import '@/components/Icons/folder'
  import '@/components/Icons/link'

  export default {
    name: 'mo-task-general',
    components: {
      [ShowInFolder.name]: ShowInFolder,
      [TaskStatus.name]: TaskStatus
    },
    props: {
      task: {
        type: Object
      }
    },
    data () {
      const { locale } = this.$store.state.preference.config
      return {
        form: {},
        formLabelWidth: calcFormLabelWidth(locale),
        locale
      }
    },
    computed: {
      isRenderer: () => is.renderer(),
      ...mapState('app', {
        systemTheme: state => state.systemTheme
      }),
      ...mapState('preference', {
        theme: state => state.config.theme,
        preferenceConfig: state => state.config
      }),
      ...mapState('task', {
        securityScanStatuses: state => state.taskSecurityScanStatuses || {}
      }),
      currentTheme () {
        if (this.theme === APP_THEME.AUTO) {
          return this.systemTheme
        } else {
          return this.theme
        }
      },
      taskFullName () {
        return getTaskName(this.task, {
          defaultName: this.$t('task.get-task-name'),
          maxLen: -1
        })
      },
      taskName () {
        return getTaskName(this.task, {
          defaultName: this.$t('task.get-task-name'),
          maxLen: 32
        })
      },
      isSeeder () {
        return checkTaskIsSeeder(this.task)
      },
      taskStatus () {
        const { task, isSeeder } = this
        if (isSeeder) {
          return TASK_STATUS.SEEDING
        } else {
          return task.status
        }
      },
      path () {
        return getTaskActualPath(this.task, this.preferenceConfig)
      },
      isBT () {
        return checkTaskIsBT(this.task)
      },
      taskPriority () {
        const gid = this.task && this.task.gid
        const map = this.$store.state.task.taskPriorities || {}
        return (gid && map[gid]) ? Number(map[gid]) : 0
      },
      isCompleted () {
        const completedStatuses = ['complete', 'error', 'removed']
        return completedStatuses.includes(this.task.status)
      },
      completionTime () {
        // 使用任务保存时间作为完成时间，如果没有保存时间则使用当前时间
        const timestamp = this.task.savedAt || Date.now()
        return new Date(timestamp).toLocaleString()
      },
      securityScanStatus () {
        const { securityScanStatuses, task } = this
        if (!securityScanStatuses || !task || !task.gid) {
          return null
        }
        return securityScanStatuses[task.gid] || null
      },
      securityScanStatusText () {
        const status = this.securityScanStatus && this.securityScanStatus.status
        switch (status) {
        case 'running':
          return this.$t('task.security-scan-running')
        case 'success':
          return this.$t('task.security-scan-success')
        case 'failed':
          return this.$t('task.security-scan-failed')
        case 'skipped':
          return this.$t('task.security-scan-skipped')
        default:
          return this.$t('task.security-scan-not-scanned')
        }
      },
      securityScanStatusClass () {
        const status = this.securityScanStatus && this.securityScanStatus.status
        return {
          'security-scan-status': true,
          'security-scan-status--running': status === 'running',
          'security-scan-status--success': status === 'success',
          'security-scan-status--failed': status === 'failed',
          'security-scan-status--skipped': status === 'skipped'
        }
      }
    },
    filters: {
      bytesToSize,
      localeDateTimeFormat
    },
    methods: {
      handleCopyClick () {
        const { task } = this
        const uri = getTaskUri(task)
        try {
          const { clipboard } = require('electron')
          clipboard.writeText(uri)
          this.$msg.success(this.$t('task.copy-link-success'))
        } catch (e) {
          this.$msg.error(this.$t('preferences.save-fail-message'))
        }
      }
    }
  }
</script>

<style lang="scss">
.copy-link {
  cursor: pointer;
}
</style>
