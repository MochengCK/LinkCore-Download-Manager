<template>
  <el-tooltip
    effect="dark"
    :content="$t('task.reveal-in-folder')"
    placement="top"
    :open-delay="500"
  >
    <i @click.stop="onFolderClick">
      <mo-icon name="folder" width="10" height="10" />
    </i>
  </el-tooltip>
</template>

<script>
  import '@/components/Icons/folder'
  import {
    showItemInFolder
  } from '@/utils/native'

  export default {
    name: 'mo-show-in-folder',
    props: {
      path: {
        type: String
      }
    },
    computed: {
    },
    methods: {
      onFolderClick () {
        if (!this.path) {
          return
        }
        showItemInFolder(this.path, {
          errorMsg: this.$t('task.file-not-exist')
        })
      }
    }
  }
</script>
