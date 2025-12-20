<template>
  <el-container id="container">
    <router-view />
    <mo-floating-bar />
    <el-tooltip effect="dark" :content="$t('app.task-plan')" placement="top" :open-delay="500">
      <button
        class="mo-task-plan"
        :class="{ 'is-planned': isTaskPlanPlanned }"
        type="button"
        @click="onTaskPlanClick"
      >
        <mo-icon name="task-plan" width="20" height="20" />
      </button>
    </el-tooltip>
    <el-dialog
      :visible.sync="taskPlanVisible"
      width="360px"
      custom-class="task-plan-dialog"
      append-to-body
    >
      <div slot="title" class="task-plan-dialog-title">
        <el-radio-group v-model="taskPlanType" size="mini">
          <el-radio-button label="complete" :disabled="isTaskPlanCompleteTypeDisabled">{{ $t('app.task-plan-type-complete') }}</el-radio-button>
          <el-radio-button label="scheduled">{{ $t('app.task-plan-type-scheduled') }}</el-radio-button>
        </el-radio-group>
      </div>
      <el-form label-position="top">
        <el-form-item>
          <el-select v-model="taskPlanAction" :placeholder="$t('app.task-plan-select-placeholder')">
            <template v-if="taskPlanType === 'scheduled'">
              <el-option :label="$t('app.task-plan-action-resume-selected')" value="resume-selected" />
              <el-option :label="$t('app.task-plan-action-resume-all')" value="resume-all" />
              <el-option :label="$t('app.task-plan-action-pause-selected')" value="pause-selected" />
              <el-option :label="$t('app.task-plan-action-pause-all')" value="pause-all" />
            </template>
            <el-option :label="$t('app.task-plan-action-shutdown')" value="shutdown" />
            <el-option :label="$t('app.task-plan-action-sleep')" value="sleep" />
            <el-option :label="$t('app.task-plan-action-quit')" value="quit" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="taskPlanType === 'scheduled'">
          <el-time-picker
            v-model="taskPlanTime"
            :placeholder="$t('app.task-plan-time-placeholder')"
            format="HH:mm"
            value-format="HH:mm"
            size="mini"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item v-if="taskPlanType === 'scheduled' && isTaskPlanOnlyWhenIdleVisible">
          <el-checkbox v-model="taskPlanOnlyWhenIdle">{{ $t('app.task-plan-only-when-idle') }}</el-checkbox>
        </el-form-item>
      </el-form>
    </el-dialog>
    <div v-if="taskPlanVisible" class="mo-task-plan-save">
      <el-button type="primary" :disabled="isTaskPlanSaveDisabled" @click="saveTaskPlan">{{ $t('app.save') }}</el-button>
    </div>
    <mo-speedometer :class="{ 'is-shifted': isSpeedometerShifted }" />
    <mo-add-task :visible="addTaskVisible" :type="addTaskType" />
    <mo-task-detail
      :visible="taskDetailVisible"
      :gid="currentTaskGid"
      :task="currentTaskItem"
      :files="currentTaskFiles"
      :peers="currentTaskPeers"
    />
    <mo-dragger />
    <div class="aside-small-screen">
      <ul class="menu small-menu">
        <li
          @click="nav('/task')"
          :class="{ active: currentPage === '/task' }"
        >
          <el-tooltip
            effect="dark"
            :content="$t('menu.task')"
            placement="right"
            :open-delay="500"
          >
            <mo-icon name="menu-task" width="20" height="20" />
          </el-tooltip>
        </li>
        <li
          @click="nav('/preference')"
          :class="{ active: currentPage === '/preference' }"
        >
          <el-tooltip
            effect="dark"
            :content="$t('subnav.preferences')"
            placement="right"
            :open-delay="500"
          >
            <mo-icon name="menu-preference" width="20" height="20" />
          </el-tooltip>
        </li>
      </ul>
    </div>
  </el-container>
</template>

<script>
  import { mapState } from 'vuex'
  import FloatingBar from '@/components/BottomBar/FloatingBar'
  import Speedometer from '@/components/Speedometer/Speedometer'
  import AddTask from '@/components/Task/AddTask'
  import TaskDetail from '@/components/TaskDetail/Index'
  import Dragger from '@/components/Dragger/Index'
  import '@/components/Icons/menu-task'
  import '@/components/Icons/task-plan'
  import '@/components/Icons/menu-preference'

  export default {
    name: 'mo-main',
    components: {
      [FloatingBar.name]: FloatingBar,
      [Speedometer.name]: Speedometer,
      [AddTask.name]: AddTask,
      [TaskDetail.name]: TaskDetail,
      [Dragger.name]: Dragger
    },
    data () {
      return {
        taskPlanVisible: false,
        taskPlanAction: '',
        taskPlanType: 'complete',
        taskPlanTime: '',
        taskPlanOnlyWhenIdle: false,
        hasModalMaskVisible: false
      }
    },
    computed: {
      ...mapState('app', {
        addTaskVisible: state => state.addTaskVisible,
        addTaskType: state => state.addTaskType,
        currentPage: state => state.currentPage
      }),
      ...mapState('task', {
        taskDetailVisible: state => state.taskDetailVisible,
        currentTaskGid: state => state.currentTaskGid,
        currentTaskItem: state => state.currentTaskItem,
        currentTaskFiles: state => state.currentTaskFiles,
        currentTaskPeers: state => state.currentTaskPeers,
        selectedGidList: state => state.selectedGidList
      }),
      ...mapState('preference', {
        taskPlanActionFromConfig: state => (state.config && state.config.taskPlanAction) || 'none',
        taskPlanTypeFromConfig: state => (state.config && state.config.taskPlanType) || 'complete',
        taskPlanTimeFromConfig: state => (state.config && state.config.taskPlanTime) || '',
        taskPlanOnlyWhenIdleFromConfig: state => !!(state.config && state.config.taskPlanOnlyWhenIdle)
      }),
      isTaskPlanPlanned () {
        return (this.taskPlanActionFromConfig || 'none') !== 'none'
      },
      isTaskPlanCompleteTypeDisabled () {
        return this.isTaskPlanRequireScheduledType(this.taskPlanAction)
      },
      isTaskPlanOnlyWhenIdleVisible () {
        const action = this.normalizeTaskPlanAction(this.taskPlanAction)
        return ['shutdown', 'sleep', 'quit'].includes(action)
      },
      isTaskPlanSaveDisabled () {
        if (!this.taskPlanAction) {
          return true
        }
        const action = this.normalizeTaskPlanAction(this.taskPlanAction)
        if (this.isTaskPlanRequireSelection(action) && this.getSelectedGids().length === 0) {
          return true
        }
        if (this.taskPlanType === 'scheduled' && !this.taskPlanTime) {
          return true
        }
        return false
      },
      isSpeedometerShifted () {
        const { taskPlanVisible, addTaskVisible } = this
        return !!(taskPlanVisible || addTaskVisible)
      }
    },
    watch: {
      taskPlanActionFromConfig () {
        if (!this.taskPlanVisible) {
          this.taskPlanAction = this.normalizeTaskPlanAction(this.taskPlanActionFromConfig)
          this.taskPlanType = this.normalizeTaskPlanType(this.taskPlanTypeFromConfig, this.taskPlanActionFromConfig)
          this.taskPlanTime = this.normalizeTaskPlanTime(this.taskPlanTimeFromConfig)
          this.taskPlanOnlyWhenIdle = !!this.taskPlanOnlyWhenIdleFromConfig
        }
      },
      taskPlanAction () {
        const action = this.normalizeTaskPlanAction(this.taskPlanAction)
        if (this.isTaskPlanRequireScheduledType(action) && this.taskPlanType !== 'scheduled') {
          this.taskPlanType = 'scheduled'
        }
      },
      taskPlanType () {
        if (this.taskPlanType !== 'complete') {
          return
        }
        const action = this.normalizeTaskPlanAction(this.taskPlanAction)
        if (!['shutdown', 'sleep', 'quit'].includes(action)) {
          this.taskPlanAction = ''
        }
        this.taskPlanTime = ''
        this.taskPlanOnlyWhenIdle = false
      }
    },
    methods: {
      updateModalMaskVisible () {
        try {
          this.hasModalMaskVisible = !!document.body.querySelector('.v-modal')
        } catch (e) {
          this.hasModalMaskVisible = false
        }
      },
      normalizeTaskPlanAction (action) {
        const v = `${action || ''}`
        if (['resume-selected', 'resume-all', 'pause-selected', 'pause-all', 'shutdown', 'sleep', 'quit'].includes(v)) {
          return v
        }
        return ''
      },
      normalizeTaskPlanType (type, action) {
        const a = `${action || 'none'}`
        if (a === 'none') {
          return 'complete'
        }
        if (this.isTaskPlanRequireScheduledType(a)) {
          return 'scheduled'
        }
        const t = `${type || 'complete'}`
        if (['complete', 'scheduled'].includes(t)) {
          return t
        }
        return 'complete'
      },
      normalizeTaskPlanTime (time) {
        const v = `${time || ''}`
        if (!v) {
          return ''
        }
        return /^\d{2}:\d{2}$/.test(v) ? v : ''
      },
      isTaskPlanRequireSelection (action) {
        return ['resume-selected', 'pause-selected'].includes(`${action || ''}`)
      },
      isTaskPlanRequireScheduledType (action) {
        return ['resume-selected', 'resume-all', 'pause-selected', 'pause-all'].includes(`${action || ''}`)
      },
      getSelectedGids () {
        const list = Array.isArray(this.selectedGidList) ? this.selectedGidList : []
        return list.map(x => `${x || ''}`.trim()).filter(Boolean)
      },
      nav (page) {
        this.$router.push({
          path: page
        }).catch(err => {
          console.log(err)
        })
      },
      onTaskPlanClick () {
        if (this.isTaskPlanPlanned) {
          this.$store.dispatch('preference/save', {
            taskPlanAction: 'none',
            taskPlanType: 'complete',
            taskPlanTime: '',
            taskPlanGids: [],
            taskPlanOnlyWhenIdle: false
          })
          this.taskPlanAction = 'none'
          this.taskPlanVisible = false
          this.$msg.success(this.$t('app.task-plan-cancelled-message'))
          return
        }
        this.taskPlanAction = this.normalizeTaskPlanAction(this.taskPlanActionFromConfig)
        this.taskPlanType = this.normalizeTaskPlanType(this.taskPlanTypeFromConfig, this.taskPlanActionFromConfig)
        this.taskPlanTime = this.normalizeTaskPlanTime(this.taskPlanTimeFromConfig)
        this.taskPlanOnlyWhenIdle = !!this.taskPlanOnlyWhenIdleFromConfig
        this.taskPlanVisible = true
      },
      saveTaskPlan () {
        const action = this.normalizeTaskPlanAction(this.taskPlanAction)
        const type = this.normalizeTaskPlanType(this.taskPlanType, action)
        const time = this.normalizeTaskPlanTime(this.taskPlanTime)
        if (!action) {
          this.$msg.warning(this.$t('app.task-plan-select-warning'))
          return
        }
        const gids = this.isTaskPlanRequireSelection(action) ? this.getSelectedGids() : []
        if (this.isTaskPlanRequireSelection(action) && gids.length === 0) {
          this.$msg.warning(this.$t('app.task-plan-selected-warning'))
          return
        }
        if (type === 'scheduled' && !time) {
          this.$msg.warning(this.$t('app.task-plan-time-warning'))
          return
        }
        this.$store.dispatch('preference/save', {
          taskPlanAction: action,
          taskPlanType: type,
          taskPlanTime: type === 'scheduled' ? time : '',
          taskPlanGids: gids,
          taskPlanOnlyWhenIdle: type === 'scheduled' && this.isTaskPlanOnlyWhenIdleVisible ? !!this.taskPlanOnlyWhenIdle : false
        })
        this.taskPlanVisible = false
        const labelKey = {
          'resume-selected': 'app.task-plan-action-resume-selected',
          'resume-all': 'app.task-plan-action-resume-all',
          'pause-selected': 'app.task-plan-action-pause-selected',
          'pause-all': 'app.task-plan-action-pause-all',
          shutdown: 'app.task-plan-action-shutdown',
          sleep: 'app.task-plan-action-sleep',
          quit: 'app.task-plan-action-quit'
        }[action] || 'app.task-plan-action-quit'
        const label = type === 'scheduled' && time
          ? `${this.$t(labelKey)} (${time})`
          : this.$t(labelKey)
        this.$msg.success(this.$t('app.task-plan-set-message', { action: label }))
      }
    },
    mounted () {
      this.updateModalMaskVisible()
      if (typeof MutationObserver === 'undefined') {
        return
      }

      this._modalObserver = new MutationObserver(() => {
        this.updateModalMaskVisible()
      })

      try {
        this._modalObserver.observe(document.body, { childList: true, subtree: true })
      } catch (e) {}
    },
    destroyed () {
      if (this._modalObserver) {
        try {
          this._modalObserver.disconnect()
        } catch (e) {}
        this._modalObserver = null
      }
    }
  }
</script>

<style lang="scss">
  @import '~@/components/Theme/Variables';
  @import '~@/components/Theme/Light/Variables';

  .mo-task-plan {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(87px);
    z-index: 20;
    height: 40px;
    width: 40px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 100px;
    border: 1px solid $--speedometer-border-color;
    background-color: $--floating-bar-background;
    opacity: 0.5;
    transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    user-select: none;
    outline: none;
    overflow: hidden;
    white-space: nowrap;
    font-size: 0;
    line-height: 0;

    &:hover {
      opacity: 1;
      border-color: $--speedometer-hover-border-color;
    }

    svg {
      display: block;
      color: $--floating-bar-item-color;
    }

    &.is-planned {
      opacity: 1;
      border-color: #c2e7b0;
      animation: pulse-green 1s infinite;
    }

    &.is-planned:hover {
      border-color: #a5d6a7;
      opacity: 1;
    }
  }

  .el-dialog.task-plan-dialog {
    max-width: 360px;
    min-width: 320px;
  }

  .el-dialog.task-plan-dialog .task-plan-dialog-title {
    display: flex;
    align-items: center;
    margin-right: 28px;
  }

  .el-dialog.task-plan-dialog .el-select {
    width: 100%;
  }

  .mo-task-plan-save {
    position: fixed;
    right: 14px;
    bottom: 24px;
    z-index: 3001;
  }

  .mo-speedometer.is-shifted {
    bottom: 78px;
  }

  .theme-dark .mo-task-plan.is-planned {
    border-color: #a5d6a7;
  }

  @keyframes pulse-green {
    0% {
      box-shadow: 0 0 0 0 rgba(103, 194, 58, 0.4);
    }
    70% {
      box-shadow: 0 0 0 5px rgba(103, 194, 58, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(103, 194, 58, 0);
    }
  }

  .mo-speedometer {
    position: fixed;
    right: 14px;
    bottom: 24px;
    z-index: 20;
  }

  /* 小屏幕侧边栏样式 */
  .aside-small-screen {
    position: fixed;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1000;
    background-color: var(--speedometer-background);
    border-radius: 100px;
    opacity: 0.5;
    transition: opacity 0.3s ease;
    padding: 8px;
    &:hover {
      opacity: 1;
    }
  }

  /* 只针对小窗模式的菜单样式 */
  .aside-small-screen .menu {
    list-style: none;
    padding: 0;
    margin: 0 auto;
    user-select: none;
    cursor: default;
    > li {
      width: 32px;
      height: 32px;
      cursor: pointer;
      border-radius: 16px;
      transition: background-color 0.25s, border-radius 0.25s;
      display: flex;
      align-items: center;
      justify-content: center;
      &:hover {
        background-color: rgba(0, 0, 0, 0.15);
        border-radius: 8px;
      }
      &.active {
        background-color: rgba(0, 0, 0, 0.25);
        border-radius: 8px;
      }
    }
    svg {
      padding: 6px;
      color: $--icon-color;
    }
  }

  .aside-small-screen .small-menu {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 4px 0;
    > li {
      margin-top: 8px;
      margin-bottom: 8px;
      &:first-child {
        margin-top: 0;
      }
      &:last-child {
        margin-bottom: 0;
      }
    }
  }
</style>
