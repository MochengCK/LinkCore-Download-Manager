<template>
  <mo-drag-select
    class="task-list"
    v-if="displayTaskList.length > 0"
    attribute="attr"
    @change="handleDragSelectChange"
    @mousedown.native="handleListBlankClick"
  >
    <div
      v-for="item in displayTaskList"
      :key="item.gid"
      :attr="item.gid"
      :class="getItemClass(item)"
      @click.stop="(e) => handleItemClick(item, e)"
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
      const selectedList = cloneDeep(this.$store.state.task.selectedGidList) || []
      return {
        selectedList,
        isMultiSelectModifierPressed: false,
        isMultiSelectMode: false
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
      },
      multiSelectModifier () {
        const v = this.preferenceConfig && this.preferenceConfig.taskMultiSelectModifier
        return (v ? `${v}`.toLowerCase() : 'ctrl').trim()
      },
      multiSelectKeystroke () {
        const raw = `${this.multiSelectModifier || ''}`.trim().toLowerCase()
        const tokens = raw
          .split(/[-+]/g)
          .map(s => `${s || ''}`.trim())
          .filter(Boolean)
          .map(t => {
            if (t === 'control') return 'ctrl'
            if (t === 'command') return 'cmd'
            if (t === 'meta') return 'cmd'
            if (t === 'commandorcontrol' || t === 'cmdorctrl') return 'cmdctrl'
            return t
          })

        const modifiers = []
        let key = ''
        tokens.forEach(t => {
          if (t === 'cmdctrl' || t === 'ctrl' || t === 'cmd' || t === 'shift' || t === 'alt') {
            if (!modifiers.includes(t)) modifiers.push(t)
          } else {
            key = t
          }
        })

        const normalized = [...modifiers, key].filter(Boolean).join('-')
        return normalized || 'ctrl'
      },
      multiSelectModifiers () {
        const raw = `${this.multiSelectKeystroke || ''}`.trim().toLowerCase()
        const tokens = raw
          .split(/[-+]/g)
          .map(s => `${s || ''}`.trim())
          .filter(Boolean)
          .map(t => {
            if (t === 'control') return 'ctrl'
            if (t === 'command') return 'cmd'
            if (t === 'meta') return 'cmd'
            if (t === 'commandorcontrol' || t === 'cmdorctrl') return 'cmdctrl'
            return t
          })

        const allowed = new Set(['cmdctrl', 'ctrl', 'cmd', 'shift', 'alt'])
        const uniq = []
        tokens.forEach(t => {
          if (!allowed.has(t)) return
          if (uniq.includes(t)) return
          uniq.push(t)
        })
        return uniq.length > 0 ? uniq : ['ctrl']
      },
      isMultiSelectToggleShortcut () {
        const raw = `${this.multiSelectKeystroke || ''}`.trim().toLowerCase()
        if (!raw) return false
        const tokens = raw.split(/[-+]/g).map(s => `${s || ''}`.trim()).filter(Boolean)
        const allowed = new Set(['cmdctrl', 'ctrl', 'cmd', 'shift', 'alt', 'meta'])
        return tokens.some(t => !allowed.has(t))
      }
    },
    mounted () {
      this.handleKeyEvent = (e) => {
        if (e && e.type === 'keydown' && this.isMultiSelectToggleShortcut && this.isMultiSelectToggleHit(e)) {
          if (!e.repeat) {
            this.isMultiSelectMode = !this.isMultiSelectMode
          }
          this.isMultiSelectModifierPressed = this.isMultiSelectMode
          e.preventDefault()
          return
        }
        this.isMultiSelectModifierPressed = this.isMultiSelectToggleShortcut
          ? this.isMultiSelectMode
          : this.getModifierPressedFromEvent(e)
      }
      window.addEventListener('keydown', this.handleKeyEvent)
      window.addEventListener('keyup', this.handleKeyEvent)
    },
    beforeDestroy () {
      if (this.handleKeyEvent) {
        window.removeEventListener('keydown', this.handleKeyEvent)
        window.removeEventListener('keyup', this.handleKeyEvent)
      }
    },
    methods: {
      normalizeKeystroke (event) {
        const parts = []
        if (event.ctrlKey || event.metaKey) parts.push('cmdctrl')
        if (event.shiftKey) parts.push('shift')
        if (event.altKey) parts.push('alt')
        let key = event.key || ''
        key = key.toLowerCase()
        if (key === 'control' || key === 'meta' || key === 'shift' || key === 'alt') {
          return ''
        }
        if (key === 'arrowup') key = 'up'
        if (key === 'arrowdown') key = 'down'
        if (key === 'arrowleft') key = 'left'
        if (key === 'arrowright') key = 'right'
        if (key === 'escape') key = 'esc'
        const result = [...parts, key].filter(Boolean).join('-')
        return result
      },
      isMultiSelectToggleHit (event) {
        const expected = `${this.multiSelectKeystroke || ''}`.trim().toLowerCase()
        if (!expected) return false
        const actual = this.normalizeKeystroke(event)
        return actual && actual === expected
      },
      getModifierPressedFromEvent (e) {
        const required = this.multiSelectModifiers || []
        return required.every((key) => {
          if (key === 'shift') return !!e.shiftKey
          if (key === 'alt') return !!e.altKey
          if (key === 'cmd') return !!e.metaKey
          if (key === 'cmdctrl') return !!(e.ctrlKey || e.metaKey)
          return !!e.ctrlKey
        })
      },
      isMultiSelectEvent (e) {
        return this.isMultiSelectToggleShortcut
          ? this.isMultiSelectMode
          : this.getModifierPressedFromEvent(e)
      },
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
        const incoming = Array.isArray(selectedList) ? selectedList : []
        const next = this.isMultiSelectModifierPressed
          ? Array.from(new Set([...(this.selectedList || []), ...incoming]))
          : incoming
        this.selectedList = next
        this.$store.dispatch('task/selectTasks', cloneDeep(next))
      },
      handleItemClick (item, e) {
        const gid = item && item.gid
        if (!gid) {
          return
        }

        const current = Array.isArray(this.selectedList) ? this.selectedList : []
        const useMulti = this.isMultiSelectEvent(e)
        let next = []

        if (useMulti) {
          const set = new Set(current)
          if (set.has(gid)) {
            set.delete(gid)
          } else {
            set.add(gid)
          }
          next = Array.from(set)
        } else {
          next = [gid]
        }

        this.selectedList = next
        this.$store.dispatch('task/selectTasks', cloneDeep(next))
      },
      handleListBlankClick (e) {
        if (!e || e.target !== e.currentTarget) {
          return
        }
        if (typeof e.button === 'number' && e.button !== 0) {
          return
        }
        if (!this.selectedList || this.selectedList.length === 0) {
          return
        }
        this.selectedList = []
        this.$store.dispatch('task/selectTasks', [])
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
