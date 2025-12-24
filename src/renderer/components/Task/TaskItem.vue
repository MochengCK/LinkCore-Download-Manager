<template>
  <div :key="task.gid" class="task-item" v-on:dblclick="onDbClick">
    <div class="task-name" :title="taskFullName">
      <span>{{ taskFullName }}</span>
    </div>
    <mo-task-item-actions mode="LIST" :task="task" />
    <div class="task-progress">
      <mo-task-progress
        :completed="Number(task.completedLength)"
        :total="Number(task.totalLength)"
        :status="taskStatus"
        :speed="Number(task.downloadSpeed)"
      />
      <mo-task-progress-info :task="task" />
    </div>
  </div>
</template>

<script>
  import { mapState } from 'vuex'
  import { basename } from 'node:path'
  import { checkTaskIsSeeder, getTaskName, ellipsis } from '@shared/utils'
  import { TASK_STATUS } from '@shared/constants'
  import { openItem, getTaskActualPath } from '@/utils/native'
  import { commands } from '@/components/CommandManager/instance'
  import TaskItemActions from './TaskItemActions'
  import TaskProgress from './TaskProgress'
  import TaskProgressInfo from './TaskProgressInfo'

  export default {
    name: 'mo-task-item',
    components: {
      [TaskItemActions.name]: TaskItemActions,
      [TaskProgress.name]: TaskProgress,
      [TaskProgressInfo.name]: TaskProgressInfo
    },
    props: {
      task: {
        type: Object
      }
    },
    watch: {
      'task.status': {
        immediate: true,
        handler (val) {
          if (val === TASK_STATUS.COMPLETE) {
            this.ensureFixedDisplayName()
          }
        }
      }
    },
    computed: {
      ...mapState('preference', {
        preferenceConfig: state => state.config
      }),
      ...mapState('task', {
        taskDisplayNames: state => state.taskDisplayNames
      }),
      taskFullName () {
        const { task } = this
        if (task && task.status === TASK_STATUS.COMPLETE) {
          const gid = task && task.gid ? `${task.gid}` : ''
          const cached = gid && this.taskDisplayNames ? this.taskDisplayNames[gid] : ''
          if (cached) {
            return cached
          }
          return this.getCompletedDisplayName(task)
        }

        return getTaskName(task, {
          defaultName: this.$t('task.get-task-name'),
          maxLen: -1
        })
      },
      taskName () {
        const { task } = this
        if (task && task.status === TASK_STATUS.COMPLETE) {
          const gid = task && task.gid ? `${task.gid}` : ''
          const cached = gid && this.taskDisplayNames ? this.taskDisplayNames[gid] : ''
          if (cached) {
            return ellipsis(cached, 64)
          }
          return ellipsis(this.getCompletedDisplayName(task), 64)
        }

        return getTaskName(task, {
          defaultName: this.$t('task.get-task-name')
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
      }

    },
    methods: {
      getCompletedDisplayName (task) {
        const config = this.preferenceConfig || {}
        const suffix = config.downloadingFileSuffix || ''
        const path = getTaskActualPath(task, config)
        const base = basename(path || '')
        if (suffix && base.endsWith(suffix)) {
          return base.slice(0, -suffix.length)
        }
        return base
      },
      ensureFixedDisplayName () {
        const { task } = this
        const gid = task && task.gid ? `${task.gid}` : ''
        if (!gid) {
          return
        }
        const cached = this.taskDisplayNames ? this.taskDisplayNames[gid] : ''
        if (cached) {
          return
        }
        const name = this.getCompletedDisplayName(task)
        if (name) {
          this.$store.dispatch('task/setTaskDisplayName', { gid, name })
        }
      },
      onDbClick () {
        const { status } = this.task
        const { COMPLETE, WAITING, PAUSED, ACTIVE } = TASK_STATUS
        if (status === COMPLETE) {
          this.openTask()
          return
        }
        if ([WAITING, PAUSED, ACTIVE].includes(status)) {
          commands.emit('show-task-progress', { task: this.task })
          return
        }
        this.toggleTask()
      },
      async openTask () {
        const { taskName } = this
        this.$msg.info(this.$t('task.opening-task-message', { taskName }))
        const config = this.$store.state.preference.config || {}
        const fullPath = getTaskActualPath(this.task, config)
        const result = await openItem(fullPath)
        if (result) {
          this.$msg.error(this.$t('task.file-not-exist'))
        }
      },
      toggleTask () {
        this.$store.dispatch('task/toggleTask', this.task)
      }
    }
  }
</script>

<style lang="scss">
.task-item {
  position: relative;
  min-height: 78px;
  padding: 16px 12px;
  background-color: $--task-item-background;
  border: 1px solid $--task-item-border-color;
  border-radius: 6px;
  margin-bottom: 16px;
  transition: $--border-transition-base;
  &:hover {
    border-color: $--task-item-hover-border-color;
  }
  .task-item-actions-wrapper {
    position: absolute;
    top: 16px;
    right: 12px;
  }
}
.selected .task-item {
  border-color: $--task-item-hover-border-color;
}
  .task-name {
  color: #505753;
  margin-bottom: 1.5rem;
  margin-right: 170px;
  word-break: break-all;
  min-height: 26px;
  &> span {
    font-size: 14px;
    line-height: 26px;
    overflow : hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}
</style>
