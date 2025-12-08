<template>
  <el-container class="content panel" direction="vertical">
    <el-header class="panel-header" height="84">
      <h4 class="hidden-xs-only">{{ title }}</h4>
      <mo-subnav-switcher
        :title="title"
        :subnavs="subnavs"
        class="hidden-sm-and-up"
      />
    </el-header>
    <el-main class="panel-content">
      <el-form
        class="form-preference"
        ref="basicForm"
        label-position="right"
        size="mini"
        :model="form"
        :rules="rules"
      >
        <!-- 外观设置卡片 -->
        <div class="preference-card">
          <h3 class="card-title">{{ $t('preferences.appearance') }}</h3>
          <el-form-item size="mini">
            <el-col class="form-item-sub" :span="24">
              <mo-theme-switcher
                v-model="form.theme"
                @change="handleThemeChange"
                ref="themeSwitcher"
              />
            </el-col>
            <el-col v-if="showHideAppMenuOption" class="form-item-sub" :span="16">
              <el-checkbox v-model="form.hideAppMenu" @change="autoSaveForm">
                {{ $t('preferences.hide-app-menu') }}
              </el-checkbox>
            </el-col>
            <el-col class="form-item-sub" :span="16">
              <el-checkbox v-model="form.autoHideWindow" @change="autoSaveForm">
                {{ $t('preferences.auto-hide-window') }}
              </el-checkbox>
            </el-col>
            <el-col v-if="isMac" class="form-item-sub" :span="16">
              <el-checkbox v-model="form.traySpeedometer" @change="autoSaveForm">
                {{ $t('preferences.tray-speedometer') }}
              </el-checkbox>
            </el-col>
            <el-col class="form-item-sub" :span="16">
              <el-checkbox v-model="form.showProgressBar" @change="autoSaveForm">
                {{ $t('preferences.show-progress-bar') }}
              </el-checkbox>
            </el-col>
          </el-form-item>
        </div>

        <!-- 运行模式卡片 (仅Mac) -->
        <div v-if="isMac" class="preference-card">
          <h3 class="card-title">{{ $t('preferences.run-mode') }}</h3>
          <el-form-item size="mini">
            <el-col class="form-item-sub" :span="24">
              <el-select v-model="form.runMode" @change="autoSaveForm">
                <el-option
                  v-for="item in runModes"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value">
                </el-option>
              </el-select>
            </el-col>
          </el-form-item>
        </div>

        <!-- 语言设置卡片 -->
        <div class="preference-card">
          <h3 class="card-title">{{ $t('preferences.language') }}</h3>
          <div class="language-container">
            <!-- 语言选择框 -->
            <el-select
              v-model="form.locale"
              @change="handleLocaleChange(form.locale)"
              :placeholder="$t('preferences.change-language')"
              class="language-select"
            >
              <el-option
                v-for="item in locales"
                :key="item.value"
                :label="item.label"
                :value="item.value">
              </el-option>
            </el-select>
            <!-- 撤回更改按钮 - 使用visibility而非v-if，避免调整卡片大小 -->
            <el-button
              type="danger"
              size="mini"
              @click="undoLocaleChange"
              class="undo-change-btn"
              :style="{ visibility: localeChanged ? 'visible' : 'hidden' }"
            >
              {{ originalLanguageText }}
            </el-button>
          </div>
        </div>

        <!-- 启动设置卡片 -->
        <div class="preference-card">
          <h3 class="card-title">{{ $t('preferences.startup') }}</h3>
          <el-form-item size="mini">
            <el-col
              class="form-item-sub"
              :span="24"
              v-if="!isLinux"
            >
              <el-checkbox v-model="form.openAtLogin" @change="autoSaveForm">
                {{ $t('preferences.open-at-login') }}
              </el-checkbox>
            </el-col>
            <el-col class="form-item-sub" :span="24">
              <el-checkbox v-model="form.keepWindowState" @change="autoSaveForm">
                {{ $t('preferences.keep-window-state') }}
              </el-checkbox>
            </el-col>
            <el-col class="form-item-sub" :span="24">
              <el-checkbox v-model="form.resumeAllWhenAppLaunched" @change="autoSaveForm">
                {{ $t('preferences.auto-resume-all') }}
              </el-checkbox>
            </el-col>
          </el-form-item>
        </div>

        <!-- 下载目录卡片 -->
        <div class="preference-card">
          <h3 class="card-title">{{ $t('preferences.default-dir') }}</h3>
          <el-form-item size="mini">
            <el-input placeholder="" v-model="form.dir" :readonly="isMas">
              <mo-history-directory
                slot="prepend"
                @selected="handleHistoryDirectorySelected"
              />
              <mo-select-directory
                v-if="isRenderer"
                slot="append"
                @selected="handleNativeDirectorySelected"
              />
            </el-input>
            <div class="el-form-item__info" v-if="isMas" style="margin-top: 8px;">
              {{ $t('preferences.mas-default-dir-tips') }}
            </div>
          </el-form-item>
        </div>

        <!-- 传输设置卡片 -->
        <div class="preference-card">
          <h3 class="card-title">{{ $t('preferences.transfer-settings') }}</h3>
          <el-form-item size="mini">
            <el-col class="form-item-sub" :span="24">
              {{ $t('preferences.transfer-speed-upload') }}
              <el-input-number
                v-model="maxOverallUploadLimitParsed"
                controls-position="right"
                :min="0"
                :max="65535"
                :step="1"
                :label="$t('preferences.transfer-speed-download')"
                >
              </el-input-number>
              <el-select
                style="width: 100px;"
                v-model="uploadUnit"
                @change="handleUploadChange">
                <el-option
                  v-for="item in speedUnits"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value">
                </el-option>
              </el-select>
            </el-col>
            <el-col class="form-item-sub" :span="24">
              {{ $t('preferences.transfer-speed-download') }}
              <el-input-number
                v-model="maxOverallDownloadLimitParsed"
                controls-position="right"
                :min="0"
                :max="65535"
                :step="1"
                :label="$t('preferences.transfer-speed-download')">
              </el-input-number>
              <el-select
                style="width: 100px;"
                v-model="downloadUnit"
                @change="handleDownloadChange">
                <el-option
                  v-for="item in speedUnits"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value">
                </el-option>
              </el-select>
            </el-col>
          </el-form-item>
        </div>

        <!-- BT设置卡片 -->
        <div class="preference-card">
          <h3 class="card-title">{{ $t('preferences.bt-settings') }}</h3>
          <el-form-item size="mini">
            <el-col class="form-item-sub" :span="24">
              <el-checkbox v-model="form.btSaveMetadata" @change="autoSaveForm">
                {{ $t('preferences.bt-save-metadata') }}
              </el-checkbox>
            </el-col>
            <el-col class="form-item-sub" :span="24">
              <el-checkbox
                v-model="form.btAutoDownloadContent"
                @change="autoSaveForm"
              >
                {{ $t('preferences.bt-auto-download-content') }}
              </el-checkbox>
            </el-col>
            <el-col class="form-item-sub" :span="24">
              <el-checkbox
                v-model="form.btForceEncryption"
                @change="autoSaveForm"
              >
                {{ $t('preferences.bt-force-encryption') }}
              </el-checkbox>
            </el-col>
            <el-col class="form-item-sub" :span="24">
              <el-switch
                v-model="form.keepSeeding"
                :active-text="$t('preferences.keep-seeding')"
                @change="onKeepSeedingChange"
              >
              </el-switch>
            </el-col>
            <el-col class="form-item-sub" :span="24" v-if="!form.keepSeeding">
              {{ $t('preferences.seed-ratio') }}
              <el-input-number
                v-model="form.seedRatio"
                @change="autoSaveForm"
                controls-position="right"
                :min="1"
                :max="100"
                :step="0.1"
                :label="$t('preferences.seed-ratio')">
              </el-input-number>
            </el-col>
            <el-col class="form-item-sub" :span="24" v-if="!form.keepSeeding">
              {{ $t('preferences.seed-time') }}
              ({{ $t('preferences.seed-time-unit') }})
              <el-input-number
                v-model="form.seedTime"
                @change="autoSaveForm"
                controls-position="right"
                :min="60"
                :max="525600"
                :step="1"
                :label="$t('preferences.seed-time')">
              </el-input-number>
            </el-col>
          </el-form-item>
        </div>

        <!-- 任务管理卡片 -->
        <div class="preference-card">
          <h3 class="card-title">{{ $t('preferences.task-manage') }}</h3>
          <el-form-item size="mini">
            <el-col class="form-item-sub" :span="24">
              {{ $t('preferences.max-concurrent-downloads') }}
              <el-input-number
                v-model="form.maxConcurrentDownloads"
                @change="autoSaveForm"
                controls-position="right"
                :min="1"
                :max="maxConcurrentDownloads"
                :step="1"
                :label="$t('preferences.max-concurrent-downloads')">
              </el-input-number>
            </el-col>
            <el-col class="form-item-sub" :span="24">
              {{ $t('preferences.max-connection-per-server') }}
              <el-input-number
                v-model="form.maxConnectionPerServer"
                @change="autoSaveForm"
                controls-position="right"
                :min="1"
                :max="form.engineMaxConnectionPerServer"
                :step="1"
                :label="$t('preferences.max-connection-per-server')">
              </el-input-number>
            </el-col>
            <el-col class="form-item-sub" :span="24">
              <el-checkbox v-model="form.continue" @change="autoSaveForm">
                {{ $t('preferences.continue') }}
              </el-checkbox>
            </el-col>
            <el-col class="form-item-sub" :span="24">
              <el-checkbox v-model="form.newTaskShowDownloading" @change="autoSaveForm">
                {{ $t('preferences.new-task-show-downloading') }}
              </el-checkbox>
            </el-col>
            <el-col class="form-item-sub" :span="24">
              <el-checkbox v-model="form.taskNotification" @change="autoSaveForm">
                {{ $t('preferences.task-completed-notify') }}
              </el-checkbox>
            </el-col>
            <el-col class="form-item-sub" :span="24">
              <el-checkbox v-model="form.noConfirmBeforeDeleteTask" @change="autoSaveForm">
                {{ $t('preferences.no-confirm-before-delete-task') }}
              </el-checkbox>
            </el-col>
          </el-form-item>
        </div>
      </el-form>
    </el-main>
  </el-container>
</template>

<script>
  import is from 'electron-is'
  import { mapState } from 'vuex'
  import { cloneDeep, extend, isEmpty } from 'lodash'
  import SubnavSwitcher from '@/components/Subnav/SubnavSwitcher'
  import HistoryDirectory from '@/components/Preference/HistoryDirectory'
  import SelectDirectory from '@/components/Native/SelectDirectory'
  import ThemeSwitcher from '@/components/Preference/ThemeSwitcher'
  import { availableLanguages, getLanguage } from '@shared/locales'
  import { getLocaleManager } from '@/components/Locale'
  import {
    calcFormLabelWidth,
    changedConfig,
    checkIsNeedRestart,
    convertLineToComma,
    diffConfig,
    extractSpeedUnit
  } from '@shared/utils'
  import {
    APP_RUN_MODE,
    EMPTY_STRING,
    ENGINE_MAX_CONCURRENT_DOWNLOADS,
    ENGINE_RPC_PORT
  } from '@shared/constants'
  import { reduceTrackerString } from '@shared/utils/tracker'

  const initForm = (config) => {
    const {
      autoHideWindow,
      btForceEncryption,
      btSaveMetadata,
      dir,
      engineMaxConnectionPerServer,
      followMetalink,
      followTorrent,
      hideAppMenu,
      keepSeeding,
      keepWindowState,
      locale,
      maxConcurrentDownloads,
      maxConnectionPerServer,
      maxOverallDownloadLimit,
      maxOverallUploadLimit,
      newTaskShowDownloading,
      noConfirmBeforeDeleteTask,
      openAtLogin,
      pauseMetadata,
      resumeAllWhenAppLaunched,
      runMode,
      seedRatio,
      seedTime,
      showProgressBar,
      taskNotification,
      theme,
      traySpeedometer
    } = config

    const btAutoDownloadContent = followTorrent &&
      followMetalink &&
      !pauseMetadata

    const result = {
      autoHideWindow,
      btAutoDownloadContent,
      btForceEncryption,
      btSaveMetadata,
      continue: config.continue,
      dir,
      engineMaxConnectionPerServer,
      followMetalink,
      followTorrent,
      hideAppMenu,
      keepSeeding,
      keepWindowState,
      locale,
      maxConcurrentDownloads,
      maxConnectionPerServer,
      maxOverallDownloadLimit,
      maxOverallUploadLimit,
      newTaskShowDownloading,
      noConfirmBeforeDeleteTask,
      openAtLogin,
      pauseMetadata,
      resumeAllWhenAppLaunched,
      runMode,
      seedRatio,
      seedTime,
      showProgressBar,
      taskNotification,
      theme,
      traySpeedometer
    }
    return result
  }

  export default {
    name: 'mo-preference-basic',
    components: {
      [SubnavSwitcher.name]: SubnavSwitcher,
      [HistoryDirectory.name]: HistoryDirectory,
      [SelectDirectory.name]: SelectDirectory,
      [ThemeSwitcher.name]: ThemeSwitcher
    },
    data () {
      const { locale } = this.$store.state.preference.config
      const formOriginal = initForm(this.$store.state.preference.config)
      let form = {}
      form = initForm(extend(form, formOriginal, changedConfig.basic))

      return {
        form,
        formLabelWidth: calcFormLabelWidth(locale),
        formOriginal,
        locales: availableLanguages,
        rules: {},
        saveTimeout: null,
        originalLocale: locale, // 记录用户初始选择的语言
        localeChanged: false, // 语言是否已更改
        originalLanguageText: this.$t('preferences.undo-change') // 记录初始语言的"撤回更改"文本
      }
    },
    computed: {
      isRenderer: () => is.renderer(),
      isMac: () => is.macOS(),
      isMas: () => is.mas(),
      isLinux () { return is.linux() },
      title () {
        return this.$t('preferences.basic')
      },
      maxConcurrentDownloads () {
        return ENGINE_MAX_CONCURRENT_DOWNLOADS
      },
      maxOverallDownloadLimitParsed: {
        get () {
          return parseInt(this.form.maxOverallDownloadLimit)
        },
        set (value) {
          const limit = value > 0 ? `${value}${this.downloadUnit}` : 0
          this.form.maxOverallDownloadLimit = limit
        }
      },
      maxOverallUploadLimitParsed: {
        get () {
          return parseInt(this.form.maxOverallUploadLimit)
        },
        set (value) {
          const limit = value > 0 ? `${value}${this.uploadUnit}` : 0
          this.form.maxOverallUploadLimit = limit
        }
      },
      downloadUnit: {
        get () {
          const { maxOverallDownloadLimit } = this.form
          return extractSpeedUnit(maxOverallDownloadLimit)
        },
        set (value) {
          return value
        }
      },
      uploadUnit: {
        get () {
          const { maxOverallUploadLimit } = this.form
          return extractSpeedUnit(maxOverallUploadLimit)
        },
        set (value) {
          return value
        }
      },
      runModes () {
        let result = [
          {
            label: this.$t('preferences.run-mode-standard'),
            value: APP_RUN_MODE.STANDARD
          },
          {
            label: this.$t('preferences.run-mode-tray'),
            value: APP_RUN_MODE.TRAY
          }
        ]

        if (this.isMac) {
          result = [
            ...result,
            {
              label: this.$t('preferences.run-mode-hide-tray'),
              value: APP_RUN_MODE.HIDE_TRAY
            }
          ]
        }

        return result
      },
      speedUnits () {
        return [
          {
            label: 'KB/s',
            value: 'K'
          },
          {
            label: 'MB/s',
            value: 'M'
          }
        ]
      },
      subnavs () {
        return [
          {
            key: 'basic',
            title: this.$t('preferences.basic'),
            route: '/preference/basic'
          },
          {
            key: 'advanced',
            title: this.$t('preferences.advanced'),
            route: '/preference/advanced'
          },
          {
            key: 'lab',
            title: this.$t('preferences.lab'),
            route: '/preference/lab'
          }
        ]
      },
      showHideAppMenuOption () {
        return is.windows() || is.linux()
      },
      rpcDefaultPort () {
        return ENGINE_RPC_PORT
      },
      ...mapState('preference', {
        config: state => state.config
      })
    },
    watch: {
      form: {
        handler () {
          // Only save if form has changed from original
          const hasChanges = !isEmpty(diffConfig(this.formOriginal, this.form))
          if (hasChanges) {
            this.autoSaveForm()
          }
        },
        deep: true
      },
      // 监控语言变化，更新localeChanged状态
      'form.locale' (newLocale, oldLocale) {
        this.localeChanged = newLocale !== this.originalLocale
      }
    },
    methods: {
      autoSaveForm () {
        // Debounce auto-save to avoid too many requests
        if (this.saveTimeout) {
          clearTimeout(this.saveTimeout)
        }
        this.saveTimeout = setTimeout(() => {
          // Double-check there are actual changes before submitting
          if (!isEmpty(diffConfig(this.formOriginal, this.form))) {
            this.submitForm('basicForm')
          }
        }, 100)
      },
      handleLocaleChange (locale) {
        const lng = getLanguage(locale)
        getLocaleManager().changeLanguage(lng)
        this.autoSaveForm()
        // 更新语言已更改状态
        this.localeChanged = this.form.locale !== this.originalLocale
      },
      // 撤回语言更改
      undoLocaleChange () {
        this.form.locale = this.originalLocale
        this.handleLocaleChange(this.originalLocale)
        this.localeChanged = false
      },
      handleThemeChange (theme) {
        this.form.theme = theme
        this.autoSaveForm()
      },
      handleDownloadChange (value) {
        const speedLimit = parseInt(this.form.maxOverallDownloadLimit, 10)
        this.downloadUnit = value
        const limit = speedLimit > 0 ? `${speedLimit}${value}` : 0
        this.form.maxOverallDownloadLimit = limit
        this.autoSaveForm()
      },
      handleUploadChange (value) {
        const speedLimit = parseInt(this.form.maxOverallUploadLimit, 10)
        this.uploadUnit = value
        const limit = speedLimit > 0 ? `${speedLimit}${value}` : 0
        this.form.maxOverallUploadLimit = limit
        this.autoSaveForm()
      },
      onKeepSeedingChange (enable) {
        this.form.seedRatio = enable ? 0 : 1
        this.form.seedTime = enable ? 525600 : 60
        this.autoSaveForm()
      },
      handleHistoryDirectorySelected (dir) {
        this.form.dir = dir
        this.autoSaveForm()
      },
      handleNativeDirectorySelected (dir) {
        this.form.dir = dir
        this.$store.dispatch('preference/recordHistoryDirectory', dir)
        this.autoSaveForm()
      },
      onDirectorySelected (dir) {
        this.form.dir = dir
        this.autoSaveForm()
      },
      syncFormConfig () {
        this.$store.dispatch('preference/fetchPreference')
          .then((config) => {
            this.form = initForm(config)
            this.formOriginal = cloneDeep(this.form)
          })
      },
      submitForm (formName) {
        this.$refs[formName].validate((valid) => {
          if (!valid) {
            console.error('[Motrix] preference form valid:', valid)
            return false
          }

          const data = {
            ...diffConfig(this.formOriginal, this.form),
            ...changedConfig.advanced
          }

          const {
            autoHideWindow,
            btAutoDownloadContent,
            btTracker,
            rpcListenPort
          } = data

          if ('btAutoDownloadContent' in data) {
            data.followTorrent = btAutoDownloadContent
            data.followMetalink = btAutoDownloadContent
            data.pauseMetadata = !btAutoDownloadContent
          }

          if (btTracker) {
            data.btTracker = reduceTrackerString(convertLineToComma(btTracker))
          }

          if (rpcListenPort === EMPTY_STRING) {
            data.rpcListenPort = this.rpcDefaultPort
          }

          console.log('[Motrix] preference changed data:', data)

          this.$store.dispatch('preference/save', data)
            .then(() => {
              this.$store.dispatch('app/fetchEngineOptions')
              this.syncFormConfig()
              // Don't show success message for auto-save to avoid constant notifications
            })
            .catch(() => {
              this.$msg.error(this.$t('preferences.save-fail-message'))
            })

          changedConfig.basic = {}
          changedConfig.advanced = {}

          if (this.isRenderer) {
            if ('autoHideWindow' in data) {
              this.$electron.ipcRenderer.send('command',
                                              'application:auto-hide-window', autoHideWindow)
            }

            if (checkIsNeedRestart(data)) {
              this.$electron.ipcRenderer.send('command', 'application:relaunch')
            }
          }
        })
      }
    },
    beforeRouteLeave (to, from, next) {
      // Since we now use auto-save on changes, there's no need to check for unsaved changes
      changedConfig.basic = {}
      changedConfig.advanced = {}
      next()
    }
  }
</script>
