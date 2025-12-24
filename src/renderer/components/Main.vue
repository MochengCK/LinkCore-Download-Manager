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
  import { dialog } from '@electron/remote'
  import { commands } from '@/components/CommandManager/instance'
  import { TASK_STATUS, APP_THEME } from '@shared/constants'
  import api from '@/api'
  import {
    bytesToSize,
    timeRemaining,
    timeFormat,
    getTaskName
  } from '@shared/utils'
  import {
    moveTaskFilesToTrash
  } from '@/utils/native'
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
        hasModalMaskVisible: false,
        lastTaskStatuses: {},
        progressWindow: null,
        progressTaskGid: ''
      }
    },
    computed: {
      ...mapState('app', {
        addTaskVisible: state => state.addTaskVisible,
        addTaskType: state => state.addTaskType,
        currentPage: state => state.currentPage,
        systemTheme: state => state.systemTheme
      }),
      ...mapState('task', {
        taskDetailVisible: state => state.taskDetailVisible,
        currentTaskGid: state => state.currentTaskGid,
        currentTaskItem: state => state.currentTaskItem,
        currentTaskFiles: state => state.currentTaskFiles,
        currentTaskPeers: state => state.currentTaskPeers,
        selectedGidList: state => state.selectedGidList,
        taskList: state => state.taskList
      }),
      ...mapState('preference', {
        taskPlanActionFromConfig: state => (state.config && state.config.taskPlanAction) || 'none',
        taskPlanTypeFromConfig: state => (state.config && state.config.taskPlanType) || 'complete',
        taskPlanTimeFromConfig: state => (state.config && state.config.taskPlanTime) || '',
        taskPlanOnlyWhenIdleFromConfig: state => !!(state.config && state.config.taskPlanOnlyWhenIdle),
        prefTheme: state => state.config && state.config.theme
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
      },
      taskList: {
        deep: true,
        handler (val) {
          this.handleTaskListChange(val || [])
        }
      },
      prefTheme () {
        this.handleThemeChangeForProgressWindow()
      },
      systemTheme () {
        this.handleThemeChangeForProgressWindow()
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
      },
      handleTaskProgressAutoOpen (payload) {
        const data = payload || {}
        const gid = data && data.gid ? `${data.gid}` : ''
        if (!gid) {
          return
        }
        const list = this.taskList || []
        const task = list.find(item => item && `${item.gid}` === gid)
        if (!task) {
          return
        }
        this.openProgressWindowForTask(task)
      },
      handleThemeChangeForProgressWindow () {
        if (!this.progressWindow || (this.progressWindow.isDestroyed && this.progressWindow.isDestroyed())) {
          return
        }
        if (!this.progressTaskGid) {
          return
        }
        const list = this.taskList || []
        const task = list.find(item => item && `${item.gid}` === this.progressTaskGid)
        if (!task) {
          return
        }
        try {
          const prefState = this.$store && this.$store.state && this.$store.state.preference
          const prefConfig = prefState && prefState.config ? prefState.config : {}
          const themeConfig = prefConfig.theme || APP_THEME.LIGHT
          const appState = this.$store && this.$store.state && this.$store.state.app
          const systemTheme = appState && appState.systemTheme ? appState.systemTheme : APP_THEME.LIGHT
          const finalTheme = themeConfig === APP_THEME.AUTO ? systemTheme : themeConfig
          const isDark = finalTheme === APP_THEME.DARK
          const bodyBg = isDark ? '#1f1f1f' : '#ffffff'
          const textColor = isDark ? '#e5e5e5' : '#303133'
          const statusColor = isDark ? '#c0c4cc' : '#606266'
          const metaColor = isDark ? '#b0b0b0' : '#909399'
          const barBg = isDark ? '#3a3a3a' : '#ebeef5'
          const barInner = '#409EFF'
          const controlsBg = isDark ? '#252525' : '#ffffff'
          const controlsBorder = isDark ? '#4a4a4a' : '#dcdfe6'
          const controlsDivider = isDark ? '#555555' : '#e4e7ed'
          const controlsItemColor = isDark ? '#e5e5e5' : '#606266'
          const controlsItemHoverBg = isDark ? '#333333' : '#f2f6fc'
          const win = this.progressWindow
          if (!win || (win.isDestroyed && win.isDestroyed())) {
            return
          }
          if (typeof win.setBackgroundColor === 'function') {
            win.setBackgroundColor(bodyBg)
          }
          try {
            win.webContents.send('task-progress-theme-update', {
              bodyBg,
              textColor,
              statusColor,
              metaColor,
              barBg,
              barInner,
              controlsBg,
              controlsBorder,
              controlsDivider,
              controlsItemColor,
              controlsItemHoverBg
            })
          } catch (e) {}
          this.updateProgressWindow(task)
        } catch (e) {}
      },
      async handleTaskProgressControl (payload) {
        const data = payload || {}
        const gid = data && data.gid ? `${data.gid}` : ''
        const action = data && data.action ? `${data.action}` : ''
        if (!gid || !action) {
          return
        }
        const list = this.taskList || []
        let task = list.find(item => item && `${item.gid}` === gid)
        if (!task) {
          try {
            task = await api.fetchTaskItem({ gid })
          } catch (e) {
            task = null
          }
        }
        if (!task) {
          return
        }
        const taskName = getTaskName(task, {
          defaultName: this.$t('task.get-task-name')
        })
        if (action === 'pause') {
          this.$msg.info(this.$t('task.download-pause-message', { taskName }))
          this.$store.dispatch('task/pauseTask', task)
            .catch(({ code }) => {
              if (code === 1) {
                this.$msg.error(this.$t('task.pause-task-fail', { taskName }))
              }
            })
          return
        }
        if (action === 'resume') {
          this.$store.dispatch('task/resumeTask', task)
            .catch(({ code }) => {
              if (code === 1) {
                this.$msg.error(this.$t('task.resume-task-fail', {
                  taskName
                }))
              }
            })
          return
        }
        if (action === 'cancel') {
          const deleteWithFiles = false
          this.handleDeleteTaskFromProgress(task, taskName, deleteWithFiles)
        }
      },
      async deleteTaskFilesFromProgress (task) {
        const prefState = this.$store && this.$store.state && this.$store.state.preference
        const config = prefState && prefState.config ? prefState.config : {}
        const downloadingFileSuffix = config.downloadingFileSuffix || ''
        try {
          await moveTaskFilesToTrash(task, downloadingFileSuffix, config)
        } catch (err) {
          console.warn('[Motrix] deleteTaskFilesFromProgress error:', err)
        }
      },
      async removeTaskItemFromProgress (task, taskName) {
        try {
          await this.$store.dispatch('task/removeTask', task)
          this.$msg.success(this.$t('task.delete-task-success', {
            taskName
          }))
        } catch ({ code }) {
          if (code === 1) {
            this.$msg.error(this.$t('task.delete-task-fail', {
              taskName
            }))
          }
        }
      },
      async handleDeleteTaskFromProgress (task, taskName, deleteWithFiles = false) {
        const prefState = this.$store && this.$store.state && this.$store.state.preference
        const prefConfig = prefState && prefState.config ? prefState.config : {}
        const noConfirmBeforeDelete = !!prefConfig.noConfirmBeforeDeleteTask
        if (noConfirmBeforeDelete) {
          await this.$store.dispatch('task/forcePauseTask', task)
            .finally(async () => {
              if (deleteWithFiles) {
                await this.deleteTaskFilesFromProgress(task)
              }
              return this.removeTaskItemFromProgress(task, taskName)
            })
          return
        }
        dialog.showMessageBox({
          type: 'warning',
          title: this.$t('task.delete-task'),
          message: this.$t('task.delete-task-confirm', { taskName }),
          buttons: [this.$t('app.yes'), this.$t('app.no')],
          cancelId: 1,
          checkboxLabel: this.$t('task.delete-task-label'),
          checkboxChecked: deleteWithFiles
        }).then(async ({ response, checkboxChecked }) => {
          if (response !== 0) {
            return
          }
          await this.$store.dispatch('task/forcePauseTask', task)
            .finally(async () => {
              if (checkboxChecked) {
                await this.deleteTaskFilesFromProgress(task)
              }
              return this.removeTaskItemFromProgress(task, taskName)
            })
        })
      },
      handleShowTaskProgress (payload) {
        const task = payload && payload.task
        if (!task) {
          return
        }
        this.openProgressWindowForTask(task)
      },
      buildProgressWindowHtml (useCustomFrame = false) {
        const prefState = this.$store && this.$store.state && this.$store.state.preference
        const prefConfig = prefState && prefState.config ? prefState.config : {}
        const themeConfig = prefConfig.theme || APP_THEME.LIGHT
        const appState = this.$store && this.$store.state && this.$store.state.app
        const systemTheme = appState && appState.systemTheme ? appState.systemTheme : APP_THEME.LIGHT
        const finalTheme = themeConfig === APP_THEME.AUTO ? systemTheme : themeConfig
        const isDark = finalTheme === APP_THEME.DARK
        const bodyBg = isDark ? '#1f1f1f' : '#ffffff'
        const textColor = isDark ? '#e5e5e5' : '#303133'
        const statusColor = isDark ? '#c0c4cc' : '#606266'
        const metaColor = isDark ? '#b0b0b0' : '#909399'
        const barBg = isDark ? '#3a3a3a' : '#ebeef5'
        const barInner = '#409EFF'
        const controlsBg = isDark ? '#252525' : '#ffffff'
        const controlsBorder = isDark ? '#4a4a4a' : '#dcdfe6'
        const controlsDivider = isDark ? '#555555' : '#e4e7ed'
        const controlsItemColor = isDark ? '#e5e5e5' : '#606266'
        const controlsItemHoverBg = isDark ? '#333333' : '#f2f6fc'
        const titleBarStyle = useCustomFrame
          ? '.title-bar{height:26px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;-webkit-app-region:drag;background-color:VAR_BODY_BG;}'
          : '.title-bar{display:none;}'
        const contentStyle = useCustomFrame
          ? '.content{box-sizing:border-box;padding:0 12px 12px 12px;height:calc(100vh - 26px);overflow-y:auto;}'
          : '.content{box-sizing:border-box;padding:0 12px 12px 12px;height:100vh;overflow-y:auto;}'
        const styles = [
          'body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:12px;color:VAR_TEXT_COLOR;background-color:VAR_BODY_BG;overflow:hidden;}',
          titleBarStyle,
          contentStyle,
          '.title-text{font-size:12px;opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:8px;}',
          '.title-actions{display:flex;gap:4px;-webkit-app-region:no-drag;}',
          '.title-btn{width:18px;height:18px;border-radius:3px;border:none;background:transparent;color:VAR_TEXT_COLOR;cursor:pointer;padding:0;font-size:14px;line-height:18px;}',
          '.title-btn:hover{background-color:rgba(255,255,255,0.12);}',
          '.status{margin:6px 0 6px 0;color:VAR_STATUS_COLOR;font-size:12px;}',
          '.bar{height:6px;background:VAR_BAR_BG;border-radius:3px;overflow:hidden;margin-bottom:8px;}',
          '.bar-inner{height:100%;background:VAR_BAR_INNER;width:0;transition:width .2s ease;}',
          '.meta{color:VAR_META_COLOR;font-size:12px;margin-bottom:8px;}',
          '.meta-line{margin-bottom:2px;}',
          '.controls{margin-top:10px;display:flex;justify-content:center;pointer-events:none;}',
          '.controls-inner{display:flex;align-items:center;justify-content:center;gap:6px;padding:5px 10px;background-color:VAR_CONTROLS_BG;border:1px solid VAR_CONTROLS_BORDER;border-radius:100px;pointer-events:auto;box-shadow:0 6px 16px rgba(0,0,0,0.12);}',
          '.controls-divider{width:1px;height:20px;background-color:VAR_CONTROLS_DIVIDER;margin:0 3px;}',
          '.controls-btn{width:26px;height:26px;border-radius:50%;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;color:VAR_CONTROLS_ITEM_COLOR;transition:background-color .2s ease,opacity .2s ease;}',
          '.controls-btn:hover:not(:disabled){background-color:VAR_CONTROLS_ITEM_HOVER_BG;}',
          '.controls-btn:disabled{cursor:not-allowed;opacity:0.4;}',
          '.controls-btn-icon{width:14px;height:14px;display:block;position:relative;}',
          '.icon-pause::before,.icon-pause::after{content:"";position:absolute;top:1px;bottom:1px;width:3px;border-radius:1px;background:currentColor;}',
          '.icon-pause::before{left:2px;}',
          '.icon-pause::after{right:2px;}',
          '.icon-resume::before{content:"";position:absolute;top:1px;bottom:1px;left:3px;border-style:solid;border-width:6px 0 6px 9px;border-color:transparent transparent transparent currentColor;}',
          '.icon-cancel::before,.icon-cancel::after{content:"";position:absolute;top:1px;bottom:1px;left:50%;width:2px;border-radius:1px;background:currentColor;transform-origin:center;}',
          '.icon-cancel::before{transform:translateX(-50%) rotate(45deg);}',
          '.icon-cancel::after{transform:translateX(-50%) rotate(-45deg);}'
        ].join('').replace(/VAR_BODY_BG/g, bodyBg)
          .replace(/VAR_TEXT_COLOR/g, textColor)
          .replace(/VAR_STATUS_COLOR/g, statusColor)
          .replace(/VAR_META_COLOR/g, metaColor)
          .replace(/VAR_BAR_BG/g, barBg)
          .replace(/VAR_BAR_INNER/g, barInner)
          .replace(/VAR_CONTROLS_BG/g, controlsBg)
          .replace(/VAR_CONTROLS_BORDER/g, controlsBorder)
          .replace(/VAR_CONTROLS_DIVIDER/g, controlsDivider)
          .replace(/VAR_CONTROLS_ITEM_COLOR/g, controlsItemColor)
          .replace(/VAR_CONTROLS_ITEM_HOVER_BG/g, controlsItemHoverBg)
        const html = [
          '<!DOCTYPE html>',
          '<html>',
          '<head>',
          '<meta charset="utf-8" />',
          '<title>Task Progress</title>',
          `<style>${styles}</style>`,
          '</head>',
          '<body>',
          '<div class="title-bar">',
          '<div class="title-text" id="window-title"></div>',
          '<div class="title-actions"><button class="title-btn" id="min-btn">–</button><button class="title-btn" id="close-btn">×</button></div>',
          '</div>',
          '<div class="content">',
          '<div class="status" id="status"></div>',
          '<div class="bar"><div class="bar-inner" id="bar"></div></div>',
          '<div class="meta">',
          '<div class="meta-line" id="size"></div>',
          '<div class="meta-line" id="downloaded"></div>',
          '<div class="meta-line" id="speed"></div>',
          '<div class="meta-line" id="remaining"></div>',
          '</div>',
          '<div class="controls">',
          '<div class="controls-inner">',
          '<button id="pause" class="controls-btn"><span class="controls-btn-icon icon-pause"></span></button>',
          '<div class="controls-divider"></div>',
          '<button id="resume" class="controls-btn"><span class="controls-btn-icon icon-resume"></span></button>',
          '<button id="cancel" class="controls-btn"><span class="controls-btn-icon icon-cancel"></span></button>',
          '</div>',
          '</div>',
          '</div>',
          '<script>',
          'const { ipcRenderer } = require("electron");',
          'let currentGid = "";',
          'const windowTitleEl = document.getElementById("window-title");',
          'const closeBtn = document.getElementById("close-btn");',
          'const minBtn = document.getElementById("min-btn");',
          'const statusEl = document.getElementById("status");',
          'const barEl = document.getElementById("bar");',
          'const sizeEl = document.getElementById("size");',
          'const downloadedEl = document.getElementById("downloaded");',
          'const speedEl = document.getElementById("speed");',
          'const remainingEl = document.getElementById("remaining");',
          'const pauseBtn = document.getElementById("pause");',
          'const resumeBtn = document.getElementById("resume");',
          'const cancelBtn = document.getElementById("cancel");',
          'try {',
          '  const remote = require("@electron/remote");',
          '  const currentWindow = remote.getCurrentWindow();',
          '  if (minBtn && currentWindow && typeof currentWindow.minimize === "function") {',
          '    minBtn.onclick = () => currentWindow.minimize();',
          '  }',
          '  if (closeBtn && currentWindow && typeof currentWindow.close === "function") {',
          '    closeBtn.onclick = () => currentWindow.close();',
          '  }',
          '} catch (e) {',
          '  if (closeBtn) { closeBtn.onclick = () => { window.close(); }; }',
          '}',
          'function sendAction(action) {',
          '  if (!currentGid) {',
          '    return;',
          '  }',
          '  ipcRenderer.send("command", "task-progress:control", { gid: currentGid, action });',
          '}',
          'if (pauseBtn) { pauseBtn.onclick = () => sendAction("pause"); }',
          'if (resumeBtn) { resumeBtn.onclick = () => sendAction("resume"); }',
          'if (cancelBtn) { cancelBtn.onclick = () => sendAction("cancel"); }',
          'ipcRenderer.on("task-progress-theme-update", (event, payload) => {',
          '  if (!payload) {',
          '    return;',
          '  }',
          '  const bodyBg = payload.bodyBg || "#ffffff";',
          '  const textColor = payload.textColor || "#303133";',
          '  const statusColor = payload.statusColor || "#606266";',
          '  const metaColor = payload.metaColor || "#909399";',
          '  const barBg = payload.barBg || "#ebeef5";',
          '  const barInner = payload.barInner || "#409EFF";',
          '  const controlsBg = payload.controlsBg || "#ffffff";',
          '  const controlsBorder = payload.controlsBorder || "#dcdfe6";',
          '  const controlsDivider = payload.controlsDivider || "#e4e7ed";',
          '  const controlsItemColor = payload.controlsItemColor || "#606266";',
          '  const controlsItemHoverBg = payload.controlsItemHoverBg || "#f2f6fc";',
          '  document.body.style.backgroundColor = bodyBg;',
          '  document.body.style.color = textColor;',
          '  const titleBarEl = document.querySelector(".title-bar");',
          '  if (titleBarEl) {',
          '    titleBarEl.style.backgroundColor = bodyBg;',
          '    titleBarEl.style.color = textColor;',
          '  }',
          '  const titleBtnEls = document.querySelectorAll(".title-btn");',
          '  if (titleBtnEls && titleBtnEls.length) {',
          '    titleBtnEls.forEach(el => {',
          '      el.style.color = textColor;',
          '    });',
          '  }',
          '  if (statusEl) {',
          '    statusEl.style.color = statusColor;',
          '  }',
          '  const metaEl = document.querySelector(".meta");',
          '  if (metaEl) {',
          '    metaEl.style.color = metaColor;',
          '  }',
          '  const barContainer = document.querySelector(".bar");',
          '  if (barContainer) {',
          '    barContainer.style.backgroundColor = barBg;',
          '  }',
          '  if (barEl) {',
          '    barEl.style.backgroundColor = barInner;',
          '  }',
          '  const controlsInner = document.querySelector(".controls-inner");',
          '  if (controlsInner) {',
          '    controlsInner.style.backgroundColor = controlsBg;',
          '    controlsInner.style.borderColor = controlsBorder;',
          '  }',
          '  const dividerEls = document.querySelectorAll(".controls-divider");',
          '  if (dividerEls && dividerEls.length) {',
          '    dividerEls.forEach(el => {',
          '      el.style.backgroundColor = controlsDivider;',
          '    });',
          '  }',
          '  const btnEls = document.querySelectorAll(".controls-btn");',
          '  if (btnEls && btnEls.length) {',
          '    btnEls.forEach(el => {',
          '      el.style.color = controlsItemColor;',
          '    });',
          '  }',
          '  const styleEl = document.getElementById("dynamic-theme-style");',
          '  if (styleEl) {',
          '    styleEl.textContent = ".controls-btn:hover:not(:disabled){background-color:" + controlsItemHoverBg + ";}";',
          '  }',
          '});',
          'ipcRenderer.on("task-progress-update", (event, payload) => {',
          '  if (!payload) {',
          '    return;',
          '  }',
          '  currentGid = payload.gid ? String(payload.gid) : "";',
          '  const title = payload.title ? String(payload.title) : "";',
          '  const percentText = payload.percentText ? String(payload.percentText) : "0%";',
          '  if (windowTitleEl) {',
          '    windowTitleEl.innerText = title;',
          '  }',
          '  if (statusEl) {',
          '    statusEl.innerText = payload.statusText || "";',
          '  }',
          '  if (barEl) {',
          '    barEl.style.width = percentText;',
          '  }',
          '  if (sizeEl) {',
          '    sizeEl.innerText = payload.sizeText || "";',
          '  }',
          '  if (downloadedEl) {',
          '    downloadedEl.innerText = payload.downloadedText || "";',
          '  }',
          '  if (speedEl) {',
          '    speedEl.innerText = payload.speedText || "";',
          '  }',
          '  if (remainingEl) {',
          '    remainingEl.innerText = payload.remainingText || "";',
          '  }',
          '  if (pauseBtn) {',
          '    pauseBtn.title = payload.pauseText || "";',
          '    pauseBtn.disabled = !payload.canPause;',
          '    pauseBtn.style.display = payload.showPause ? \'flex\' : \'none\';',
          '  }',
          '  if (resumeBtn) {',
          '    resumeBtn.title = payload.resumeText || "";',
          '    resumeBtn.disabled = !payload.canResume;',
          '    resumeBtn.style.display = payload.showResume ? \'flex\' : \'none\';',
          '  }',
          '  if (cancelBtn) {',
          '    cancelBtn.title = payload.cancelText || "";',
          '    cancelBtn.disabled = !payload.canCancel;',
          '    cancelBtn.style.display = payload.showCancel ? \'flex\' : \'none\';',
          '  }',
          '});',
          '</scr' + 'ipt>',
          '</body>',
          '</html>'
        ].join('')
        return html
      },
      async refreshProgressTaskDirectly () {
        if (!this.progressWindow || (this.progressWindow.isDestroyed && this.progressWindow.isDestroyed())) {
          return
        }
        const gid = this.progressTaskGid
        if (!gid) {
          return
        }
        const doneStatuses = [TASK_STATUS.COMPLETE, TASK_STATUS.ERROR, TASK_STATUS.REMOVED]
        try {
          const task = await api.fetchTaskItem({ gid })
          if (!task || !task.gid) {
            this.closeProgressWindow()
            return
          }
          if (doneStatuses.includes(task.status)) {
            this.closeProgressWindow()
            return
          }
          this.updateProgressWindow(task)
        } catch (e) {
          this.closeProgressWindow()
        }
      },
      buildProgressPayload (task) {
        const t = task || {}
        const completed = Number(t.completedLength || 0)
        const total = Number(t.totalLength || 0)
        const speed = Number(t.downloadSpeed || 0)
        const percent = total > 0 ? Math.floor((completed * 100) / total) : 0
        const title = getTaskName(t, {
          defaultName: this.$t('task.get-task-name'),
          maxLen: -1
        })
        const completedText = bytesToSize(completed, 2)
        const totalText = total > 0 ? bytesToSize(total, 2) : ''
        const sizeText = totalText ? `${completedText} / ${totalText}` : completedText
        const speedValue = speed > 0 ? `${bytesToSize(speed, 2)}/s` : `${bytesToSize(0, 2)}/s`
        let remainingText = ''
        if (total > 0 && speed > 0 && completed < total) {
          const remainingSeconds = timeRemaining(total, completed, speed)
          if (remainingSeconds > 0) {
            remainingText = timeFormat(remainingSeconds, {
              prefix: this.$t('task.remaining-prefix'),
              i18n: {
                gt1d: this.$t('app.gt1d'),
                hour: this.$t('app.hour'),
                minute: this.$t('app.minute'),
                second: this.$t('app.second')
              }
            })
          }
        }
        if (!remainingText) {
          remainingText = `${this.$t('task.remaining-prefix')}: --`
        }
        const status = t.status
        let statusText = ''
        if (status === TASK_STATUS.ACTIVE) {
          statusText = this.$t('task.active')
        } else if (status === TASK_STATUS.WAITING) {
          statusText = this.$t('task.waiting')
        } else if (status === TASK_STATUS.PAUSED) {
          statusText = this.$t('task.pause')
        } else {
          statusText = ''
        }
        const doneStatuses = [TASK_STATUS.COMPLETE, TASK_STATUS.ERROR, TASK_STATUS.REMOVED]
        const canPause = status === TASK_STATUS.ACTIVE && completed > 0
        const canResume = status === TASK_STATUS.WAITING || status === TASK_STATUS.PAUSED
        const canCancel = !doneStatuses.includes(status)
        return {
          gid: t && t.gid ? `${t.gid}` : '',
          title,
          percent,
          percentText: `${percent}%`,
          nameText: title,
          statusText,
          sizeText: sizeText ? `${this.$t('task.task-file-size')}: ${sizeText}` : '',
          downloadedText: `${this.$t('task.task-download-length')}: ${completedText}`,
          speedText: `${this.$t('task.task-download-speed')}: ${speedValue}`,
          remainingText,
          pauseText: this.$t('task.pause'),
          resumeText: this.$t('task.resume'),
          cancelText: this.$t('task.delete'),
          canPause,
          canResume,
          canCancel,
          showPause: true,
          showResume: true,
          showCancel: true
        }
      },
      openProgressWindowForTask (task) {
        if (!task) {
          return
        }
        const gid = task && task.gid ? `${task.gid}` : ''
        if (!gid) {
          return
        }
        this.progressTaskGid = gid
        const prefState = this.$store && this.$store.state && this.$store.state.preference
        const prefConfig = prefState && prefState.config ? prefState.config : {}
        const themeConfig = prefConfig.theme || APP_THEME.LIGHT
        const appState = this.$store && this.$store.state && this.$store.state.app
        const systemTheme = appState && appState.systemTheme ? appState.systemTheme : APP_THEME.LIGHT
        const finalTheme = themeConfig === APP_THEME.AUTO ? systemTheme : themeConfig
        const isDark = finalTheme === APP_THEME.DARK
        const hideAppMenu = !!prefConfig.hideAppMenu
        const isWin = process && process.platform === 'win32'
        const isLinux = process && process.platform === 'linux'
        const useCustomFrame = hideAppMenu && (isWin || isLinux)
        const winExisting = this.progressWindow
        if (winExisting && (typeof winExisting.isDestroyed !== 'function' || !winExisting.isDestroyed())) {
          winExisting.focus()
          this.updateProgressWindow(task)
          return
        }
        const { BrowserWindow } = require('@electron/remote')
        let icon = null
        try {
          const staticPath = (typeof window !== 'undefined' && window.__static) ? window.__static : null
          if (staticPath) {
            const path = require('node:path')
            if (process && process.platform === 'win32') {
              icon = path.join(staticPath, './L_ico_256x256.ico')
            } else if (process && process.platform === 'linux') {
              icon = path.join(staticPath, './512x512.png')
            }
          }
        } catch (e) {}
        const win = new BrowserWindow({
          width: 500,
          height: 210,
          resizable: false,
          minimizable: true,
          maximizable: false,
          useContentSize: true,
          frame: !useCustomFrame,
          backgroundColor: isDark ? '#1f1f1f' : '#ffffff',
          icon,
          webPreferences: {
            enableRemoteModule: true,
            contextIsolation: false,
            nodeIntegration: true
          }
        })
        this.progressWindow = win
        win.on('closed', () => {
          this.progressWindow = null
          this.progressTaskGid = ''
        })
        const html = this.buildProgressWindowHtml(useCustomFrame)
        win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
        win.once('ready-to-show', () => {
          const payload = this.buildProgressPayload(task)
          const windowTitle = this.$t('task.task-info-dialog-title', {
            title: payload.title
          })
          win.setTitle(windowTitle)
          if (hideAppMenu) {
            if (typeof win.setMenuBarVisibility === 'function') {
              win.setMenuBarVisibility(false)
            }
            if (win.setMenu) {
              win.setMenu(null)
            }
          }
          win.show()
          this.updateProgressWindow(task)
        })
      },
      updateProgressWindow (task) {
        if (!this.progressWindow || (this.progressWindow.isDestroyed && this.progressWindow.isDestroyed())) {
          return
        }
        const payload = this.buildProgressPayload(task)
        const windowTitle = this.$t('task.task-info-dialog-title', {
          title: payload.title
        })
        this.progressWindow.setTitle(windowTitle)
        try {
          this.progressWindow.webContents.send('task-progress-update', payload)
        } catch (e) {}
      },
      closeProgressWindow () {
        if (!this.progressWindow) {
          this.progressTaskGid = ''
          return
        }
        try {
          this.progressWindow.close()
        } catch (e) {}
        this.progressWindow = null
        this.progressTaskGid = ''
      },
      handleTaskListChange (list) {
        const prev = this.lastTaskStatuses || {}
        let candidate = null
        list.forEach(task => {
          const gid = task && task.gid ? `${task.gid}` : ''
          if (!gid) {
            return
          }
          const prevStatus = prev[gid]
          const currentStatus = task.status
          if (!candidate && currentStatus === TASK_STATUS.ACTIVE && prevStatus !== TASK_STATUS.ACTIVE) {
            candidate = task
          }
        })
        const nextStatuses = {}
        list.forEach(task => {
          const gid = task && task.gid ? `${task.gid}` : ''
          if (!gid) {
            return
          }
          nextStatuses[gid] = task.status
        })
        this.lastTaskStatuses = nextStatuses
        if (candidate) {
          const prefState = this.$store && this.$store.state && this.$store.state.preference
          const prefConfig = prefState && prefState.config ? prefState.config : {}
          const autoOpenTaskProgressWindow = prefConfig.autoOpenTaskProgressWindow !== false
          if (autoOpenTaskProgressWindow) {
            this.openProgressWindowForTask(candidate)
          }
        }
        if (this.progressWindow && this.progressTaskGid) {
          const gid = this.progressTaskGid
          const current = list.find(item => item && `${item.gid}` === gid)
          const doneStatuses = [TASK_STATUS.COMPLETE, TASK_STATUS.ERROR, TASK_STATUS.REMOVED]
          const taskState = this.$store && this.$store.state && this.$store.state.task
          const currentListType = taskState && taskState.currentList ? taskState.currentList : 'all'
          const closeWhenMissingLists = ['all']
          if (!current) {
            if (closeWhenMissingLists.includes(currentListType)) {
              this.closeProgressWindow()
            } else {
              this.refreshProgressTaskDirectly()
            }
            return
          }
          if (doneStatuses.includes(current.status)) {
            this.closeProgressWindow()
          } else {
            this.updateProgressWindow(current)
          }
        }
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

      commands.on('show-task-progress', this.handleShowTaskProgress)
      commands.on('task-progress:control', this.handleTaskProgressControl)
      commands.on('task-progress:auto-open', this.handleTaskProgressAutoOpen)
    },
    destroyed () {
      if (this._modalObserver) {
        try {
          this._modalObserver.disconnect()
          this._modalObserver = null
        } catch (e) {}
      }
      commands.off('show-task-progress', this.handleShowTaskProgress)
      commands.off('task-progress:control', this.handleTaskProgressControl)
      commands.off('task-progress:auto-open', this.handleTaskProgressAutoOpen)
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
      outline: none;
      border: none;
      box-shadow: none;
      &:focus,
      &:active {
        outline: none;
        border: none;
        box-shadow: none;
      }
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
      outline: none;
      border: none;
      box-shadow: none;
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
