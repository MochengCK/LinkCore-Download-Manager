<template>
  <el-dropdown
    @command="handleRoute"
    @visible-change="onVisibleChange"
    class="subnav-switch"
    size="medium"
    trigger="hover"
    :show-timeout="0"
  >
    <h4 class="subnav-title">
      <transition name="subnav-title-switch" mode="out-in">
        <span :key="title" class="subnav-title__text">{{ title }}</span>
      </transition>
      <i
        class="el-icon-arrow-down el-icon--right subnav-title__icon"
        :class="{ 'is-open': isDropdownVisible }"
      />
    </h4>
    <el-dropdown-menu slot="dropdown" class="subnav-switch-dropdown">
      <el-dropdown-item :command="sn.route" v-for="sn in subnavs" :key="sn.key">
        {{ sn.title }}
      </el-dropdown-item>
    </el-dropdown-menu>
  </el-dropdown>
</template>

<script>
  export default {
    name: 'mo-subnav-switcher',
    props: {
      title: {
        type: String
      },
      subnavs: {
        type: Array
      }
    },
    data () {
      return {
        isDropdownVisible: false
      }
    },
    methods: {
      onVisibleChange (visible) {
        this.isDropdownVisible = visible
      },
      handleRoute (route) {
        this.$router.push({
          path: route
        }).catch(err => {
          console.log(err)
        })
      }
    }
  }
</script>

<style lang='scss'>
.subnav-switch-dropdown {
  background: $--select-dropdown-background;
  & .el-dropdown-menu__item {
    font-size: 16px;
    color: $--select-option-color;
  }
}
.subnav-switch {
  & .subnav-title {
    color: $--subnav-action-color;
    font-size: 16px;
  }
}

.subnav-title__text {
  display: inline-block;
}

.subnav-title__icon {
  display: inline-block;
  transform-origin: 50% 50%;
  transition: transform 0.2s ease;
}

.subnav-title__icon.is-open {
  transform: rotate(180deg);
}

.subnav-title-switch-enter-active,
.subnav-title-switch-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.subnav-title-switch-enter,
.subnav-title-switch-leave-to {
  opacity: 0;
  transform: translateY(2px);
}
.theme-dark {
  .subnav-switch-dropdown {
    background-color: $--dk-subnav-background;
    border-color: $--dk-subnav-border-color;
    color: $--dk-subnav-text-color;
    & .el-dropdown-menu__item {
      color: $--dk-subnav-text-color;
      &.selected {
        color: $--color-primary;
      }
      &.hover,
      &:hover {
        background-color: $--color-primary;
        color: $--dk-titlebar-close-active-color;
      }
    }
  }
  & .el-dropdown {
    & .subnav-title {
      color: $--dk-subnav-action-color;
    }
  }
}
</style>
