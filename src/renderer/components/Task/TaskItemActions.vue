<template>
  <div class="task-item-actions-wrapper" v-on:dblclick.stop="() => null">
    <transition name="verify-slide">
      <ul
        v-if="showVerifyBar"
        :key="`${task.gid}-verify`"
        class="task-item-actions task-item-actions--verify"
      >
        <li class="task-item-action is-verify">
          <el-tooltip
            effect="dark"
            :content="getActionLabel('VERIFY')"
            placement="top"
            :open-delay="500"
          >
            <i @click.stop="onVerifyClick">
              <mo-icon name="verify-file" width="14" height="14" />
            </i>
          </el-tooltip>
        </li>
      </ul>
    </transition>
    <ul :key="task.gid" class="task-item-actions">
      <li v-for="action in primaryActions" :key="action" class="task-item-action">
        <el-tooltip
          effect="dark"
          :content="getActionLabel(action)"
          placement="top"
          :open-delay="500"
        >
          <i v-if="action ==='PAUSE'" @click.stop="onPauseClick">
            <mo-icon name="task-pause-line" width="14" height="14" />
          </i>
          <i v-if="action ==='STOP'" @click.stop="onStopClick">
            <mo-icon name="task-stop-line" width="14" height="14" />
          </i>
          <i v-if="action === 'RESUME'" @click.stop="onResumeClick">
            <mo-icon name="task-start-line" width="14" height="14" />
          </i>
          <i v-if="action === 'RESTART'" @click.stop="onRestartClick">
            <mo-icon name="task-restart" width="14" height="14" />
          </i>
          <i v-if="action === 'DELETE'" @click.stop="onDeleteClick">
            <mo-icon name="delete" width="14" height="14" />
          </i>
          <i v-if="action === 'TRASH'" @click.stop="onTrashClick">
            <mo-icon name="trash" width="14" height="14" />
          </i>
          <i v-if="action ==='FOLDER'" @click.stop="onFolderClick">
            <mo-icon name="folder" width="14" height="14" />
          </i>
          <i v-if="action ==='LINK'" @click.stop="onLinkClick">
            <mo-icon name="link" width="14" height="14" />
          </i>
          <i v-if="action ==='INFO'" @click.stop="onInfoClick">
            <mo-icon name="info-circle" width="14" height="14" />
          </i>
          <i v-if="action ==='VERIFY'" @click.stop="onVerifyClick">
            <mo-icon name="verify-file" width="14" height="14" />
          </i>
        </el-tooltip>
      </li>
    </ul>
  </div>
</template>

<script>
  import { mapState } from 'vuex'
  import is from 'electron-is'
  import { createReadStream, existsSync } from 'node:fs'
  import { createHash } from 'node:crypto'
  import { basename, dirname, isAbsolute, resolve } from 'node:path'

  import { commands } from '@/components/CommandManager/instance'
  import { TASK_STATUS } from '@shared/constants'
  import {
    checkTaskIsSeeder,
    getTaskName
  } from '@shared/utils'
  import { getTaskActualPath } from '@/utils/native'
  import { buildCategorizedPath } from '@shared/utils/file-categorize'
  import '@/components/Icons/task-start-line'
  import '@/components/Icons/task-pause-line'
  import '@/components/Icons/task-stop-line'
  import '@/components/Icons/task-restart'
  import '@/components/Icons/delete'
  import '@/components/Icons/folder'
  import '@/components/Icons/link'
  import '@/components/Icons/info-circle'
  import '@/components/Icons/verify-file'
  import '@/components/Icons/trash'

  const taskActionsMap = {
    [TASK_STATUS.ACTIVE]: ['PAUSE', 'DELETE'],
    [TASK_STATUS.PAUSED]: ['RESUME', 'DELETE'],
    [TASK_STATUS.WAITING]: ['RESUME', 'DELETE'],
    [TASK_STATUS.ERROR]: ['RESTART', 'TRASH'],
    [TASK_STATUS.COMPLETE]: ['VERIFY', 'RESTART', 'TRASH'],
    [TASK_STATUS.REMOVED]: ['RESTART', 'TRASH'],
    [TASK_STATUS.SEEDING]: ['VERIFY', 'STOP', 'DELETE']
  }

  export default {
    name: 'mo-task-item-actions',
    props: {
      mode: {
        type: String,
        default: 'LIST',
        validator: function (value) {
          return ['LIST', 'DETAIL'].indexOf(value) !== -1
        }
      },
      task: {
        type: Object,
        required: true
      }
    },
    computed: {
      ...mapState('preference', {
        noConfirmBeforeDelete: state => state.config.noConfirmBeforeDeleteTask,
        preferenceConfig: state => state.config
      }),
      taskName () {
        return getTaskName(this.task)
      },
      path () {
        return getTaskActualPath(this.task, this.preferenceConfig)
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
      taskCommonActions () {
        const { mode } = this
        const result = is.renderer() ? ['FOLDER'] : []

        switch (mode) {
        case 'LIST':
          result.push('LINK', 'INFO')
          break
        case 'DETAIL':
          result.push('LINK')
          break
        }

        return result
      },
      taskActions () {
        const { taskStatus, taskCommonActions, hasExistingTaskFile } = this
        const actions = taskActionsMap[taskStatus] || []
        const result = [...actions, ...taskCommonActions]
          .filter(action => (is.renderer() ? true : action !== 'VERIFY'))
          .filter(action => (action === 'VERIFY' ? hasExistingTaskFile : true))
          .reverse()
        return result
      },
      showVerifyBar () {
        const { taskActions, verifyCanSlideOut } = this
        return verifyCanSlideOut && taskActions.indexOf('VERIFY') !== -1
      },
      verifyCanSlideOut () {
        const { path } = this
        return !!(path && existsSync(path))
      },
      hasExistingTaskFile () {
        const { task } = this
        const files = Array.isArray(task && task.files) ? task.files : []
        if (!files.length) return false
        return files.some(file => {
          const filePath = this.getActualFilePath(file && file.path ? file.path : '')
          return !!(filePath && existsSync(filePath))
        })
      },
      primaryActions () {
        const { taskActions, showVerifyBar } = this
        return taskActions.filter(action => action !== 'VERIFY' || !showVerifyBar)
      }
    },
    methods: {
      getActionLabel (action) {
        const labelMap = {
          VERIFY: this.$t('task.verify-file'),
          PAUSE: this.$t('task.pause'),
          STOP: this.$t('task.stop'),
          RESUME: this.$t('task.resume'),
          RESTART: this.$t('task.restart'),
          DELETE: this.$t('task.delete'),
          TRASH: this.$t('task.trash'),
          FOLDER: this.$t('task.reveal-in-folder'),
          LINK: this.$t('task.copy-link'),
          INFO: this.$t('task.info')
        }
        return labelMap[action] || action
      },
      resolveTaskFilePath (filePath) {
        const { task } = this
        const dir = task && task.dir ? `${task.dir}` : ''
        const raw = filePath ? `${filePath}` : ''
        if (!raw) return ''
        if (isAbsolute(raw)) return resolve(raw)
        if (!dir) return resolve(raw)
        return resolve(dir, raw)
      },
      getActualFilePath (filePath) {
        const target = this.resolveTaskFilePath(filePath)
        if (!target) return target

        if (existsSync(target)) {
          return target
        }

        const config = this.preferenceConfig || {}
        const autoCategorizeFiles = config.autoCategorizeFiles
        const categories = config.fileCategories
        if (autoCategorizeFiles && categories && Object.keys(categories).length > 0) {
          const filename = basename(target)
          const baseDir = dirname(target)
          const categorizedInfo = buildCategorizedPath(target, filename, categories, baseDir)
          const categorizedPath = categorizedInfo.categorizedPath
          if (categorizedPath && existsSync(categorizedPath)) {
            return categorizedPath
          }
        }

        return target
      },
      calculateSha256 (filePath) {
        return new Promise((resolve, reject) => {
          const hash = createHash('sha256')
          const stream = createReadStream(filePath)
          stream.on('error', reject)
          stream.on('data', (chunk) => {
            hash.update(chunk)
          })
          stream.on('end', () => {
            resolve(hash.digest('hex'))
          })
        })
      },
      async onVerifyClick () {
        const { task, taskStatus } = this
        if (![TASK_STATUS.COMPLETE, TASK_STATUS.SEEDING].includes(taskStatus)) {
          return
        }

        const files = Array.isArray(task.files) ? task.files : []
        if (!files.length) {
          this.$msg.error(this.$t('task.verify-no-files'))
          return
        }

        this.$msg.info(this.$t('task.verify-start'))

        const missing = []
        const mismatched = []

        for (const file of files) {
          const filePath = this.getActualFilePath(file && file.path ? file.path : '')
          if (!filePath || !existsSync(filePath)) {
            missing.push(filePath || '')
            continue
          }

          const expected = Number(file && file.length ? file.length : 0)
          if (expected > 0) {
            try {
              const { statSync } = require('node:fs')
              const st = statSync(filePath)
              if (st && st.isFile && st.isFile() && Number.isFinite(st.size) && st.size !== expected) {
                mismatched.push(filePath)
              }
            } catch (_) {
              mismatched.push(filePath)
            }
          }
        }

        if (missing.length) {
          this.$msg.error(this.$t('task.verify-missing-files', { count: missing.length }))
          return
        }

        if (mismatched.length) {
          this.$msg.error(this.$t('task.verify-size-mismatch', { count: mismatched.length }))
          return
        }

        if (files.length === 1) {
          const singlePath = this.getActualFilePath(files[0] && files[0].path ? files[0].path : '')
          try {
            const sha256 = await this.calculateSha256(singlePath)
            try {
              const { clipboard } = require('electron')
              clipboard.writeText(sha256)
            } catch (_) {}
            this.$msg.success(this.$t('task.verify-success-sha256', { sha256 }))
          } catch (_) {
            this.$msg.error(this.$t('task.verify-hash-fail'))
          }
          return
        }

        this.$msg.success(this.$t('task.verify-success-multi', { count: files.length }))
      },
      onResumeClick () {
        const { task, taskName } = this
        commands.emit('resume-task', {
          task,
          taskName
        })
      },
      onRestartClick (event) {
        const { task, taskName } = this
        const { status } = task
        const showDialog = status === TASK_STATUS.COMPLETE || !!event.altKey
        commands.emit('restart-task', {
          task,
          taskName,
          showDialog
        })
      },
      onPauseClick () {
        const { task, taskName } = this
        commands.emit('pause-task', {
          task,
          taskName
        })
      },
      onStopClick () {
        if (!this.isSeeder) {
          return
        }

        const { task } = this
        commands.emit('stop-task-seeding', { task })
      },
      onDeleteClick (event) {
        const { task, taskName } = this
        const deleteWithFiles = !!event.shiftKey
        commands.emit('delete-task', {
          task,
          taskName,
          deleteWithFiles
        })
      },
      onTrashClick (event) {
        const { task, taskName } = this
        const deleteWithFiles = !!event.shiftKey
        commands.emit('delete-task-record', {
          task,
          taskName,
          deleteWithFiles
        })
      },
      onFolderClick () {
        const { path } = this
        commands.emit('reveal-in-folder', { path })
      },
      onLinkClick () {
        const { task } = this
        commands.emit('copy-task-link', { task })
      },
      onInfoClick () {
        const { task } = this
        commands.emit('show-task-info', { task })
      }
    }
  }
</script>

<style lang="scss">
.task-item-actions-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
}

.task-item-actions {
  position: relative;
  z-index: 2;
  height: 24px;
  padding: 0 10px;
  margin: 0;
  overflow: hidden;
  user-select: none;
  cursor: default;
  text-align: right;
  direction: rtl;
  border: 1px solid $--task-item-action-border-color;
  color: $--task-item-action-color;
  background-color: $--task-item-action-background;
  border-radius: 14px;
  transition: $--all-transition;
  &:hover {
    border-color: $--task-item-action-hover-border-color;
    color: $--task-item-action-hover-color;
    background-color: $--task-item-action-hover-background;
    width: auto;
  }
  &> .task-item-action {
    display: inline-block;
    padding: 5px;
    margin: 0 4px;
    font-size: 0;
    cursor: pointer;
    i {
      display: inline-block;
    }
  }
}

.task-item-actions--verify {
  direction: ltr;
  border-color: $--task-item-action-border-color;
  background-color: $--task-item-action-verify-background;
  position: relative;
  margin-right: -23px;
  z-index: 1;
  &:hover {
    border-color: $--task-item-action-hover-border-color;
    background-color: $--task-item-action-verify-hover-background;
  }
  .task-item-action {
    margin: 0 9px;
    i {
      margin-left: -25px;
    }
  }
}

.verify-slide-enter-active {
  transition: transform 0.25s ease-out, opacity 0.25s ease-out;
}

.verify-slide-enter {
  transform: translateX(24px);
  opacity: 0;
}

.verify-slide-enter-to {
  transform: translateX(0);
  opacity: 1;
}

.verify-slide-leave-active {
  transition: transform 0.25s ease-in, opacity 0.25s ease-in;
}

.verify-slide-leave {
  transform: translateX(0);
  opacity: 1;
}

.verify-slide-leave-to {
  transform: translateX(24px);
  opacity: 0;
}

.theme-dark {
  .task-item-actions.task-item-actions--verify {
    background-color: $--dk-task-item-action-verify-background;
    &:hover {
      background-color: $--dk-task-item-action-verify-hover-background;
    }
  }
}
</style>
