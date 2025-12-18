<template>
  <mo-drag-select
    class="task-list"
    v-if="displayTaskList.length > 0"
    attribute="attr"
    @change="handleDragSelectChange"
  >
    <div
      v-for="item in displayTaskList"
      :key="item.gid"
      :attr="item.gid"
      :class="getItemClass(item)"
    >
      <mo-task-item
        :task="item"
      />
    </div>
  </mo-drag-select>
  <div class="no-task" v-else>
    <div class="no-task-inner">
      {{ $t('task.no-task') }}
    </div>
  </div>
</template>

<script>
  import { mapState } from 'vuex'
  import { cloneDeep } from 'lodash'
  import {
    AUDIO_SUFFIXES,
    DOCUMENT_SUFFIXES,
    IMAGE_SUFFIXES,
    SUB_SUFFIXES,
    VIDEO_SUFFIXES
  } from '@shared/constants'
  import {
    getFileExtension,
    getFileNameFromFile
  } from '@shared/utils'
  import DragSelect from '@/components/DragSelect/Index'
  import TaskItem from './TaskItem'

  export default {
    name: 'mo-task-list',
    components: {
      [DragSelect.name]: DragSelect,
      [TaskItem.name]: TaskItem
    },
    props: {
      category: {
        type: String,
        default: ''
      }
    },
    data () {
      const selectedList = cloneDeep(this.$store.state.task.selectedList) || []
      return {
        selectedList
      }
    },
    computed: {
      ...mapState('task', {
        taskList: state => state.taskList,
        selectedGidList: state => state.selectedGidList
      }),
      ...mapState('preference', {
        preferenceConfig: state => state.config
      }),
      displayTaskList () {
        if (!this.category) {
          return this.taskList
        }
        return this.taskList.filter((task) => {
          return this.taskMatchesCategory(task, this.category)
        })
      }
    },
    methods: {
      normalizeSuffixes (suffixes = []) {
        return suffixes
          .map((s) => `${s}`.toLowerCase())
          .map((s) => s.startsWith('.') ? s.slice(1) : s)
      },
      getCategorySuffixes (category) {
        const archives = [
          'zip',
          'rar',
          '7z',
          'tar',
          'gz',
          'bz2',
          'xz'
        ]
        const programs = [
          'exe',
          'msi',
          'deb',
          'rpm',
          'dmg',
          'apk',
          'app'
        ]

        switch (category) {
        case 'archives':
          return archives
        case 'programs':
          return programs
        case 'videos':
          return this.normalizeSuffixes([...VIDEO_SUFFIXES, ...SUB_SUFFIXES])
        case 'music':
          return this.normalizeSuffixes(AUDIO_SUFFIXES)
        case 'images':
          return this.normalizeSuffixes(IMAGE_SUFFIXES)
        case 'documents':
          return this.normalizeSuffixes(DOCUMENT_SUFFIXES)
        default:
          return []
        }
      },
      getTaskFileExtensions (task) {
        const files = (task && task.files) || []
        const suffix = (this.preferenceConfig && this.preferenceConfig.downloadingFileSuffix) || ''
        const result = []
        files.forEach((file) => {
          let name = getFileNameFromFile(file)
          if (suffix && name && name.endsWith(suffix)) {
            name = name.slice(0, -suffix.length)
          }
          const ext = `${getFileExtension(name)}`.toLowerCase()
          if (ext) {
            result.push(ext)
          }
        })
        return result
      },
      taskMatchesCategory (task, category) {
        const suffixes = this.getCategorySuffixes(category)
        if (suffixes.length === 0) {
          return false
        }
        const exts = this.getTaskFileExtensions(task)
        return exts.some((ext) => suffixes.includes(ext))
      },
      handleDragSelectChange (selectedList) {
        this.selectedList = selectedList
        this.$store.dispatch('task/selectTasks', cloneDeep(selectedList))
      },
      getItemClass (item) {
        const isSelected = this.selectedList.includes(item.gid)
        return {
          selected: isSelected
        }
      }
    },
    watch: {
      selectedGidList (newVal) {
        this.selectedList = newVal
      }
    }
  }
</script>

<style lang="scss">
.task-list {
  padding: 16px 16px 64px 16px;
  min-height: 100%;
  box-sizing: border-box;
}
.no-task {
  display: flex;
  height: 100%;
  text-align: center;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #555;
  user-select: none;
}
.no-task-inner {
  width: 100%;
  padding-top: 360px;
  background: transparent url('~@/assets/no-task.svg') top center no-repeat;
}
</style>
