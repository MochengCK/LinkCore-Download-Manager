<template>
  <el-container class="main panel" direction="horizontal">
    <el-aside width="200px" class="subnav hidden-xs-only">
      <router-view name="subnav" />
    </el-aside>
    <router-view name="form" />
  </el-container>
</template>

<script>
  export default {
    name: 'mo-content-preference',
    created () {
      this.$store.dispatch('preference/fetchPreference')
    }
  }
</script>

<style lang="scss">
.form-preference {
  padding: 16px 16px 64px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;

  .preference-card {
    background: $--panel-background;
    border-radius: 12px;
    padding: 24px;
    border: 1px solid $--border-color-light;
    transition: all 0.3s ease;
  }

  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: $--color-text-primary;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid $--border-color-light;
  }

  .el-switch__label {
    font-weight: normal;
    color: $--color-text-regular;
    &.is-active {
      color: $--color-text-regular;
    }
  }

  .el-checkbox__input.is-checked + .el-checkbox__label {
    color: $--color-text-regular;
  }

  .el-form-item {
    a {
      color: $--color-text-regular;
      text-decoration: none;
      &:hover {
        color: $--color-text-primary;
        text-decoration: underline;
      }
      &:active {
        color: $--color-text-primary;
      }
    }
  }

  .el-form-item.el-form-item--mini {
    margin-bottom: 20px;
  }

  .el-form-item__content {
    color: $--color-text-regular;
  }

  .form-item-sub {
    margin-bottom: 8px;
    &:last-of-type {
      margin-bottom: 0;
    }
  }
}

/* Dark theme styles */
.theme-dark .form-preference {
  .preference-card {
    background: $--dk-panel-background;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .card-title {
    color: $--dk-panel-title-color;
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }
}

/* Ensure card width matches panel-header width */
@media only screen and (min-width: 568px) {
  .form-preference {
    padding-right: 29px !important;
  }
}

.form-actions {
  position: sticky;
  bottom: 0;
  left: auto;
  z-index: 10;
  width: -webkit-fill-available;
  box-sizing: border-box;
  padding: 24px 16px;
}

.action-link {
  cursor: pointer;
  color: $--link-color;
  &:hover {
    color: $--link-hover-color;
    text-decoration: underline;
  }
}

/* Language container styles for connected look */
.language-container {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
}

.language-select {
  width: 100%;
  border-radius: 4px 4px 0 0 !important;
  border-bottom: none !important;
  margin-bottom: -1px !important;
}

.undo-change-btn {
  width: 100%;
  border-radius: 0 0 4px 4px !important;
  border-top: none !important;
  margin-top: -2px !important;
  height: 32px;
  line-height: 30px;
  padding: 0 12px;
}
</style>
