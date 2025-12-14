<template>
  <el-container id="container">
    <router-view />
    <mo-floating-bar />
    <mo-speedometer />
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
        currentTaskPeers: state => state.currentTaskPeers
      })
    },
    methods: {
      nav (page) {
        this.$router.push({
          path: page
        }).catch(err => {
          console.log(err)
        })
      }
    }
  }
</script>

<style lang="scss">
  .mo-speedometer {
    position: fixed;
    right: 16px;
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
