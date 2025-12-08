<template>
  <div class="floating-bar" :class="{ 'hidden-sm-and-down': true }">
    <div class="floating-bar-inner">
      <button
        class="floating-bar-item"
        title="添加任务"
        @click="handleAddTask"
      >
        <mo-icon name="menu-add" width="20" height="20" />
      </button>
      <div class="floating-bar-divider"></div>
      <button
        class="floating-bar-item"
        :class="{ disabled: !canPauseAllTasks }"
        :disabled="!canPauseAllTasks"
        title="暂停所有任务"
        @click="handlePauseAllTasks"
      >
        <mo-icon name="task-pause-line" width="20" height="20" />
      </button>
      <button
        class="floating-bar-item"
        :class="{ disabled: !canResumeAllTasks }"
        :disabled="!canResumeAllTasks"
        title="恢复所有任务"
        @click="handleResumeAllTasks"
      >
        <mo-icon name="task-start-line" width="20" height="20" />
      </button>
    </div>
  </div>
</template>

<script>
  import { mapState } from 'vuex'
  import { ADD_TASK_TYPE } from '@shared/constants'
  import '@/components/Icons/menu-add'
  import '@/components/Icons/task-pause-line'
  import '@/components/Icons/task-start-line'

  export default {
    name: 'mo-floating-bar',
    computed: {
      ...mapState('app', {
        stat: state => state.stat
      }),
      canPauseAllTasks () {
        // 暂停按钮在有活跃任务时可用
        return this.stat.numActive > 0
      },
      canResumeAllTasks () {
        // 恢复按钮在不是所有任务都是活跃时可用（即有可恢复的任务）
        const totalTasks = this.stat.numActive + this.stat.numWaiting + this.stat.numStopped
        return totalTasks > this.stat.numActive
      }
    },
    methods: {
      handleAddTask (taskType = ADD_TASK_TYPE.URI) {
        this.$store.dispatch('app/showAddTaskDialog', taskType)
      },
      handlePauseAllTasks () {
        if (!this.canPauseAllTasks) return
        this.$store.dispatch('task/pauseAllTask')
          .then(() => {
            this.$msg.success(this.$t('task.pause-all-task-success'))
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t('task.pause-all-task-fail'))
            }
          })
      },
      handleResumeAllTasks () {
        if (!this.canResumeAllTasks) return
        this.$store.dispatch('task/resumeAllTask')
          .then(() => {
            this.$msg.success(this.$t('task.resume-all-task-success'))
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t('task.resume-all-task-fail'))
            }
          })
      }
    }
  }
</script>

<style lang="scss">
  @import '~@/components/Theme/Variables';
  @import '~@/components/Theme/Light/Variables';

  .floating-bar {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 15;
    pointer-events: none;

    .floating-bar-inner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 5px 10px;
      background-color: $--floating-bar-background;
      border: 1px solid $--speedometer-border-color;
      border-radius: 100px;
      pointer-events: auto;
      opacity: 0.5;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      width: 150px;
      height: 40px;
      box-sizing: border-box;

      &:hover {
        opacity: 1;
        border-color: $--speedometer-hover-border-color;
      }
    }

    .floating-bar-divider {
      width: 1px;
      height: 20px;
      background-color: $--floating-bar-divider-color;
      margin: 0 3px;
    }

    .floating-bar-item {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: none;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      transition: background-color 0.25s, opacity 0.25s;
      padding: 0;

      &:hover:not(.disabled) {
        background-color: $--floating-bar-item-hover-background;
      }

      &.disabled {
        opacity: 0.4;
        cursor: not-allowed;
        pointer-events: none;
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        pointer-events: none;
      }

      svg {
        color: $--floating-bar-item-color;
      }
    }
  }

  @media (max-width: 520px) {
    .floating-bar {
      display: none;
    }
  }
</style>
