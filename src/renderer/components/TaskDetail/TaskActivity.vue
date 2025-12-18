<template>
  <el-form
    class="mo-task-activity"
    ref="form"
    :model="form"
    :label-width="formLabelWidth"
    v-if="task"
  >
    <div class="graphic-box" ref="graphicBox">
      <mo-task-graphic
        :outerWidth="graphicWidth"
        :bitfield="task.bitfield"
        :downloadSpeed="task.downloadSpeed"
        :pieceLength="task.pieceLength"
        v-if="graphicWidth > 0"
      />
    </div>
    <el-form-item :label="`${$t('task.task-progress-info')}: `">
      <div class="form-static-value" style="overflow: hidden">
        <el-row :gutter="12">
          <el-col :span="18">
            <div class="progress-wrapper">
              <mo-task-progress
                :completed="Number(task.completedLength)"
                :total="Number(task.totalLength)"
                :status="taskStatus"
                :speed="Number(task.downloadSpeed)"
              />
            </div>
          </el-col>
          <el-col :span="5">
            {{ percent }}
          </el-col>
        </el-row>
      </div>
    </el-form-item>
    <el-form-item>
      <div class="form-static-value">
        <span>{{ task.completedLength | bytesToSize(2) }}</span>
        <span v-if="task.totalLength > 0"> / {{ task.totalLength | bytesToSize(2) }}</span>
        <span class="task-time-remaining" v-if="isActive && remaining > 0">
          {{
            remaining | timeFormat({
              prefix: $t('task.remaining-prefix'),
              i18n: {
                'gt1d': $t('app.gt1d'),
                'hour': $t('app.hour'),
                'minute': $t('app.minute'),
                'second': $t('app.second')
              }
            })
          }}
        </span>
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-num-seeders')}: `" v-if="isBT">
      <div class="form-static-value">
        {{ task.numSeeders }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-connections')}: `">
      <div class="form-static-value">
        {{ task.connections }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-download-speed')}: `">
      <div class="form-static-value">
        <span>{{ task.downloadSpeed | bytesToSize }}/s</span>
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-average-speed')}: `">
      <div class="form-static-value">
        <span>{{ averageDownloadSpeed | bytesToSize }}/s</span>
        <span class="average-speed-samples" v-if="speedSampleCount > 0">
          ({{ $t('task.task-average-speed-samples', { count: speedSampleCount }) }})
        </span>
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-upload-speed')}: `" v-if="isBT">
      <div class="form-static-value">
        <span>{{ task.uploadSpeed | bytesToSize }}/s</span>
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-upload-length')}: `" v-if="isBT">
      <div class="form-static-value">
        <span>{{ task.uploadLength | bytesToSize }}</span>
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-ratio')}: `" v-if="isBT">
      <div class="form-static-value">
        {{ ratio }}
      </div>
    </el-form-item>
  </el-form>
</template>

<script>
  import is from 'electron-is'
  import {
    bytesToSize,
    calcFormLabelWidth,
    calcProgress,
    calcRatio,
    checkTaskIsBT,
    checkTaskIsSeeder,
    timeFormat,
    timeRemaining
  } from '@shared/utils'
  import { TASK_STATUS } from '@shared/constants'
  import TaskGraphic from '@/components/TaskGraphic/Index'
  import TaskProgress from '@/components/Task/TaskProgress'

  export default {
    name: 'mo-task-activity',
    components: {
      [TaskGraphic.name]: TaskGraphic,
      [TaskProgress.name]: TaskProgress
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
        graphicWidth: 0,
        // 记录开始采样时的已下载量，用于计算增量
        initialCompletedLength: 0,
        downloadStartTime: null,
        downloadEndTime: null
      }
    },
    computed: {
      isRenderer: () => is.renderer(),
      speedSamples () {
        const gid = this.task && this.task.gid ? `${this.task.gid}` : ''
        const map = this.$store.state.task.taskSpeedSamples || {}
        const samples = gid && Array.isArray(map[gid]) ? map[gid] : []
        return samples
      },
      isBT () {
        return checkTaskIsBT(this.task)
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
      isActive () {
        return this.taskStatus === TASK_STATUS.ACTIVE
      },
      percent () {
        const { totalLength, completedLength } = this.task
        const percent = calcProgress(totalLength, completedLength)
        return `${percent}%`
      },
      remaining () {
        const { totalLength, completedLength, downloadSpeed } = this.task
        return timeRemaining(totalLength, completedLength, downloadSpeed)
      },
      ratio () {
        if (!this.isBT) {
          return 0
        }

        const { totalLength, uploadLength } = this.task
        const ratio = calcRatio(totalLength, uploadLength)
        return ratio
      },
      averageDownloadSpeed () {
        if (!this.isActive && this.task && this.task.averageDownloadSpeed != null) {
          const v = Number(this.task.averageDownloadSpeed)
          return Number.isFinite(v) && v >= 0 ? v : 0
        }
        if (this.speedSamples.length === 0) {
          return 0
        }
        const validSamples = this.speedSamples
          .map(s => Number(s))
          .filter(s => Number.isFinite(s) && s >= 0)
        if (validSamples.length === 0) {
          return 0
        }
        const sum = validSamples.reduce((a, b) => a + b, 0)
        return Math.round(sum / validSamples.length)
      },
      speedSampleCount () {
        if (!this.isActive && this.task && this.task.averageSpeedSampleCount != null) {
          const v = Number(this.task.averageSpeedSampleCount)
          return Number.isFinite(v) && v >= 0 ? v : 0
        }
        return this.speedSamples
          .map(s => Number(s))
          .filter(s => Number.isFinite(s) && s > 0).length
      }
    },
    filters: {
      bytesToSize,
      timeFormat
    },
    watch: {
      'task.downloadSpeed': {
        handler (newSpeed) {
          // 采样当前下载速度
          if (!this.isActive) {
            return
          }
          const speed = Number(newSpeed)
          if (Number.isFinite(speed) && speed >= 0) {
            this.addSpeedSample(speed)
          }
        },
        immediate: true
      },
      'task.completedLength': {
        handler (newLength, oldLength) {
          // 检测下载开始（仅在未记录起始时间时）
          const length = Number(newLength)
          if (Number.isFinite(length) && length > 0 && !this.downloadStartTime) {
            this.downloadStartTime = Date.now()
            this.initialCompletedLength = length
          }
        },
        immediate: true
      },
      'task.status': {
        handler (newStatus, oldStatus) {
          const currentLength = Number(this.task && this.task.completedLength ? this.task.completedLength : 0)
          if (
            oldStatus === TASK_STATUS.ACTIVE &&
            newStatus !== TASK_STATUS.ACTIVE &&
            this.downloadStartTime &&
            Number.isFinite(currentLength) &&
            currentLength > this.initialCompletedLength
          ) {
            this.downloadEndTime = Date.now()
          }
          if (newStatus === TASK_STATUS.ACTIVE && oldStatus !== TASK_STATUS.ACTIVE) {
            this.resetSpeedSamples()
            this.downloadStartTime = Date.now()
            this.initialCompletedLength = Number(this.task ? this.task.completedLength : 0) || 0
            this.downloadEndTime = null
          }
        }
      },
      'task.gid': {
        handler (newGid, oldGid) {
          if (newGid !== oldGid) {
            this.downloadStartTime = null
            this.initialCompletedLength = 0
            this.downloadEndTime = null
          }
        }
      }
    },
    mounted () {
      setImmediate(() => {
        this.updateGraphicWidth()
      })
      // 初始化记录当前已下载量（作为基准线）
      const initLength = Number(this.task && this.task.completedLength ? this.task.completedLength : 0)
      if (Number.isFinite(initLength) && initLength > 0) {
        this.downloadStartTime = Date.now()
        this.initialCompletedLength = initLength
      }
    },
    methods: {
      updateGraphicWidth () {
        if (!this.$refs.graphicBox) {
          return
        }
        this.graphicWidth = this.calcInnerWidth(this.$refs.graphicBox)
      },
      calcInnerWidth (ele) {
        if (!ele) {
          return 0
        }

        const style = getComputedStyle(ele, null)
        const width = parseInt(style.width, 10)
        const paddingLeft = parseInt(style.paddingLeft, 10)
        const paddingRight = parseInt(style.paddingRight, 10)
        return width - paddingLeft - paddingRight
      },
      addSpeedSample (speed) {
        const gid = this.task && this.task.gid ? `${this.task.gid}` : ''
        if (!gid) {
          return
        }
        this.$store.dispatch('task/addTaskSpeedSample', { gid, sample: speed, maxSamples: 60 })
      },
      resetSpeedSamples () {
        const gid = this.task && this.task.gid ? `${this.task.gid}` : ''
        if (gid) {
          this.$store.dispatch('task/resetTaskSpeedSamples', gid)
        }
        this.downloadStartTime = null
        this.initialCompletedLength = 0
      }
    }
  }
</script>

<style lang="scss">
.progress-wrapper {
  padding: 0.6875rem 0 0 0;
}

.task-time-remaining {
  margin-left: 1rem;
}

.average-speed-samples {
  margin-left: 0.5rem;
  color: #909399;
  font-size: 0.85em;
}
</style>
