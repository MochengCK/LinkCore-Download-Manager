<template>
  <el-container
    class="main panel"
    direction="horizontal"
  >
    <el-container
      class="content panel"
      direction="vertical"
    >
      <el-header
        class="panel-header"
        height="84"
      >
        <h4
          v-if="subnavMode !== 'title'"
          class="task-title hidden-xs-only"
        >
          {{ title }}
        </h4>
        <h4
          v-if="subnavMode === 'floating'"
          class="task-title hidden-sm-and-up"
        >
          {{ title }}
        </h4>
        <mo-subnav-switcher
          v-if="subnavMode === 'title'"
          :title="title"
          :subnavs="subnavs"
        />
        <mo-task-actions />
      </el-header>
      <el-main class="panel-content">
        <mo-task-list />
      </el-main>
    </el-container>
    <div
      v-if="subnavMode === 'floating'"
      class="subnav-small-screen subnav-right"
    >
      <ul class="menu small-menu">
        <li
          @click="navStatus('all')"
          :class="{ active: status === 'all' }"
        >
          <el-tooltip
            effect="dark"
            :content="$t('task.all')"
            placement="left"
            :open-delay="500"
          >
            <mo-icon name="menu-task" width="20" height="20" />
          </el-tooltip>
        </li>
        <li
          @click="navStatus('active')"
          :class="{ active: status === 'active' }"
        >
          <el-tooltip
            effect="dark"
            :content="$t('task.active')"
            placement="left"
            :open-delay="500"
          >
            <mo-icon name="task-start" width="20" height="20" />
          </el-tooltip>
        </li>
        <li
          @click="navStatus('waiting')"
          :class="{ active: status === 'waiting' }"
        >
          <el-tooltip
            effect="dark"
            :content="$t('task.waiting')"
            placement="left"
            :open-delay="500"
          >
            <mo-icon name="task-pause" width="20" height="20" />
          </el-tooltip>
        </li>
        <li
          @click="navStatus('stopped')"
          :class="{ active: status === 'stopped' }"
        >
          <el-tooltip
            effect="dark"
            :content="$t('task.stopped')"
            placement="left"
            :open-delay="500"
          >
            <mo-icon name="task-stop" width="20" height="20" />
          </el-tooltip>
        </li>
      </ul>
    </div>
  </el-container>
</template>

<script>
  import { dialog } from '@electron/remote'
  import { mapState } from 'vuex'

  import { commands } from '@/components/CommandManager/instance'
  import { ADD_TASK_TYPE } from '@shared/constants'
  import TaskActions from '@/components/Task/TaskActions'
  import TaskList from '@/components/Task/TaskList'
  import SubnavSwitcher from '@/components/Subnav/SubnavSwitcher'
  import '@/components/Icons/menu-task'
  import '@/components/Icons/task-start'
  import '@/components/Icons/task-pause'
  import '@/components/Icons/task-stop'
  import {
    getTaskUri,
    parseHeader
  } from '@shared/utils'
  import {
    delayDeleteTaskFiles,
    showItemInFolder,
    moveTaskFilesToTrash
  } from '@/utils/native'

  export default {
    name: 'mo-content-task',
    components: {
      [TaskActions.name]: TaskActions,
      [TaskList.name]: TaskList,
      [SubnavSwitcher.name]: SubnavSwitcher
    },
    props: {
      status: {
        type: String,
        default: 'all'
      }
    },
    computed: {
      ...mapState('task', {
        taskList: state => state.taskList,
        selectedGidList: state => state.selectedGidList,
        selectedGidListCount: state => state.selectedGidList.length
      }),
      ...mapState('preference', {
        noConfirmBeforeDelete: state => state.config.noConfirmBeforeDeleteTask,
        subnavMode: state => state.config.subnavMode || 'floating'
      }),
      subnavs () {
        return [
          {
            key: 'all',
            title: this.$t('task.all'),
            route: '/task/all'
          },
          {
            key: 'active',
            title: this.$t('task.active'),
            route: '/task/active'
          },
          {
            key: 'waiting',
            title: this.$t('task.waiting'),
            route: '/task/waiting'
          },
          {
            key: 'stopped',
            title: this.$t('task.stopped'),
            route: '/task/stopped'
          }
        ]
      },
      title () {
        const subnav = this.subnavs.find((item) => item.key === this.status)
        return subnav.title
      }
    },
    watch: {
      status: 'onStatusChange'
    },
    methods: {
      navStatus (status) {
        this.$router.push({
          path: `/task/${status}`
        }).catch(err => {
          console.log(err)
        })
      },
      onStatusChange () {
        this.changeCurrentList()
      },
      changeCurrentList () {
        this.$store.dispatch('task/changeCurrentList', this.status)
      },
      directAddTask (uri, options = {}) {
        const uris = [uri]
        const payload = {
          uris,
          options: {
            ...options
          }
        }
        this.$store.dispatch('task/addUri', payload)
          .catch((err) => {
            this.$msg.error(err.message)
          })
      },
      showAddTaskDialog (uri, options = {}) {
        const {
          header,
          ...rest
        } = options
        console.log('[Motrix] show add task dialog options: ', options)

        const headers = parseHeader(header)
        const newOptions = {
          ...rest,
          ...headers
        }

        this.$store.dispatch('app/updateAddTaskUrl', uri)
        this.$store.dispatch('app/updateAddTaskOptions', newOptions)
        this.$store.dispatch('app/showAddTaskDialog', ADD_TASK_TYPE.URI)
      },
      async deleteTaskFiles (task) {
        try {
          // 获取下载中文件后缀配置
          const downloadingFileSuffix = this.$store.state.preference.config.downloadingFileSuffix || ''
          const result = await moveTaskFilesToTrash(task, downloadingFileSuffix)

          if (!result) {
            throw new Error('task.remove-task-file-fail')
          }
        } catch (err) {
          this.$msg.error(this.$t(err.message))
        }
      },
      async removeTask (task, taskName, isRemoveWithFiles = false) {
        await this.$store.dispatch('task/forcePauseTask', task)
          .finally(async () => {
            if (isRemoveWithFiles) {
              await this.deleteTaskFiles(task)
            }

            return this.removeTaskItem(task, taskName)
          })
      },
      async removeTaskRecord (task, taskName, isRemoveWithFiles = false) {
        await this.$store.dispatch('task/forcePauseTask', task)
          .finally(async () => {
            if (isRemoveWithFiles) {
              await this.deleteTaskFiles(task)
            }

            return this.removeTaskRecordItem(task, taskName)
          })
      },
      async removeTaskItem (task, taskName) {
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
      async removeTaskRecordItem (task, taskName) {
        try {
          await this.$store.dispatch('task/removeTaskRecord', task)
          this.$msg.success(this.$t('task.remove-record-success', {
            taskName
          }))
        } catch ({ code }) {
          if (code === 1) {
            this.$msg.error(this.$t('task.remove-record-fail', {
              taskName
            }))
          }
        }
      },
      removeTasks (taskList, isRemoveWithFiles = false) {
        const gids = taskList.map((task) => task.gid)
        this.$store.dispatch('task/batchForcePauseTask', gids)
          .finally(() => {
            if (isRemoveWithFiles) {
              this.batchDeleteTaskFiles(taskList)
            }

            this.removeTaskItems(gids)
          })
      },
      batchDeleteTaskFiles (taskList) {
        // 获取下载中文件后缀配置
        const config = this.$store.state.preference.config || {}
        const downloadingFileSuffix = config.downloadingFileSuffix || ''
        const promises = taskList.map((task, index) => {
          return delayDeleteTaskFiles(task, index * 200, downloadingFileSuffix, config)
        })
        Promise.allSettled(promises).then(results => {
          console.log('[Motrix] batch delete task files: ', results)
        })
      },
      removeTaskItems (gids) {
        this.$store.dispatch('task/batchRemoveTask', gids)
          .then(() => {
            this.$msg.success(this.$t('task.batch-delete-task-success'))
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t('task.batch-delete-task-fail'))
            }
          })
      },
      handlePauseTask (payload) {
        const { task, taskName } = payload
        this.$msg.info(this.$t('task.download-pause-message', { taskName }))
        this.$store.dispatch('task/pauseTask', task)
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t('task.pause-task-fail', { taskName }))
            }
          })
      },
      handleResumeTask (payload) {
        const { task, taskName } = payload
        this.$store.dispatch('task/resumeTask', task)
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t('task.resume-task-fail', {
                taskName
              }))
            }
          })
      },
      handleStopTaskSeeding (payload) {
        const { task } = payload
        this.$store.dispatch('task/stopSeeding', task)
        this.$msg.info({
          message: this.$t('task.bt-stopping-seeding-tip'),
          duration: 8000
        })
      },
      handleRestartTask (payload) {
        const { task, taskName, showDialog } = payload
        const { gid } = task
        const uri = getTaskUri(task)

        this.$store.dispatch('task/getTaskOption', gid)
          .then((data) => {
            console.log('[Motrix] get task option:', data)
            const { dir, header, split } = data
            const options = {
              dir,
              header,
              split,
              out: taskName
            }

            if (showDialog) {
              this.showAddTaskDialog(uri, options)
            } else {
              this.directAddTask(uri, options)
              this.$store.dispatch('task/removeTaskRecord', task)
            }
          })
      },
      handleRevealInFolder (payload) {
        const { path } = payload
        showItemInFolder(path, {
          errorMsg: this.$t('task.file-not-exist')
        })
      },
      handleDeleteTask (payload) {
        const { task, taskName, deleteWithFiles } = payload
        const { noConfirmBeforeDelete } = this

        if (noConfirmBeforeDelete) {
          this.removeTask(task, taskName, deleteWithFiles)
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
        }).then(({ response, checkboxChecked }) => {
          if (response === 0) {
            this.removeTask(task, taskName, checkboxChecked)
          }
        })
      },
      handleDeleteTaskRecord (payload) {
        const { task, taskName, deleteWithFiles } = payload
        const { noConfirmBeforeDelete } = this

        if (noConfirmBeforeDelete) {
          this.removeTaskRecord(task, taskName, deleteWithFiles)
          return
        }

        dialog.showMessageBox({
          type: 'warning',
          title: this.$t('task.remove-record'),
          message: this.$t('task.remove-record-confirm', { taskName }),
          buttons: [this.$t('app.yes'), this.$t('app.no')],
          cancelId: 1,
          checkboxLabel: this.$t('task.remove-record-label'),
          checkboxChecked: !!deleteWithFiles
        }).then(({ response, checkboxChecked }) => {
          if (response === 0) {
            this.removeTaskRecord(task, taskName, checkboxChecked)
          }
        })
      },
      handleBatchDeleteTask (payload) {
        const { deleteWithFiles } = payload
        const {
          noConfirmBeforeDelete,
          selectedGidList,
          selectedGidListCount,
          taskList
        } = this
        if (selectedGidListCount === 0) {
          return
        }

        const selectedTaskList = taskList.filter((task) => {
          return selectedGidList.includes(task.gid)
        })

        if (noConfirmBeforeDelete) {
          this.removeTasks(selectedTaskList, deleteWithFiles)
          return
        }

        const count = `${selectedGidListCount}`
        dialog.showMessageBox({
          type: 'warning',
          title: this.$t('task.delete-selected-task'),
          message: this.$t('task.batch-delete-task-confirm', { count }),
          buttons: [this.$t('app.yes'), this.$t('app.no')],
          cancelId: 1,
          checkboxLabel: this.$t('task.delete-task-label'),
          checkboxChecked: deleteWithFiles
        }).then(({ response, checkboxChecked }) => {
          if (response === 0) {
            this.removeTasks(selectedTaskList, checkboxChecked)
          }
        })
      },
      handleCopyTaskLink (payload) {
        const { task } = payload
        const uri = getTaskUri(task)
        try {
          const { clipboard } = require('electron')
          clipboard.writeText(uri)
          this.$msg.success(this.$t('task.copy-link-success'))
        } catch (e) {
          this.$msg.error(this.$t('preferences.save-fail-message'))
        }
      },
      handleShowTaskInfo (payload) {
        const { task } = payload
        this.$store.dispatch('task/showTaskDetail', task)
      }
    },
    created () {
      this.changeCurrentList()
    },
    mounted () {
      commands.on('pause-task', this.handlePauseTask)
      commands.on('resume-task', this.handleResumeTask)
      commands.on('stop-task-seeding', this.handleStopTaskSeeding)
      commands.on('restart-task', this.handleRestartTask)
      commands.on('reveal-in-folder', this.handleRevealInFolder)
      commands.on('delete-task', this.handleDeleteTask)
      commands.on('delete-task-record', this.handleDeleteTaskRecord)
      commands.on('batch-delete-task', this.handleBatchDeleteTask)
      commands.on('copy-task-link', this.handleCopyTaskLink)
      commands.on('show-task-info', this.handleShowTaskInfo)
    },
    destroyed () {
      commands.off('pause-task', this.handlePauseTask)
      commands.off('resume-task', this.handleResumeTask)
      commands.off('stop-task-seeding', this.handleStopTaskSeeding)
      commands.off('restart-task', this.handleRestartTask)
      commands.off('reveal-in-folder', this.handleRevealInFolder)
      commands.off('delete-task', this.handleDeleteTask)
      commands.off('delete-task-record', this.handleDeleteTaskRecord)
      commands.off('batch-delete-task', this.handleBatchDeleteTask)
      commands.off('copy-task-link', this.handleCopyTaskLink)
      commands.off('show-task-info', this.handleShowTaskInfo)
    }
  }
</script>

<style lang="scss">
.subnav-small-screen.subnav-right {
  position: fixed;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;
  background-color: var(--speedometer-background);
  border-radius: 100px;
  opacity: 0.5;
  transition: opacity 0.3s ease;
  padding: 8px;
}

.subnav-small-screen.subnav-right:hover {
  opacity: 1;
}

.subnav-small-screen .menu {
  list-style: none;
  padding: 0;
  margin: 0 auto;
  user-select: none;
  cursor: default;
}

.subnav-small-screen .menu > li {
  width: 32px;
  height: 32px;
  cursor: pointer;
  border-radius: 16px;
  transition: background-color 0.25s, border-radius 0.25s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.subnav-small-screen .menu > li:hover {
  background-color: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
}

.subnav-small-screen .menu > li.active {
  background-color: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
}

.subnav-small-screen .menu svg {
  padding: 6px;
  color: $--icon-color;
}

.subnav-small-screen .small-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 4px 0;
}

.subnav-small-screen .small-menu > li {
  margin-top: 8px;
  margin-bottom: 8px;
}

.subnav-small-screen .small-menu > li:first-child {
  margin-top: 0;
}

.subnav-small-screen .small-menu > li:last-child {
  margin-bottom: 0;
}
</style>
