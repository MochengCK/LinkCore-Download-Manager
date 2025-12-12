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

        <!-- 快捷键卡片 -->
        <div class="preference-card">
          <h3 class="card-title">{{ $t('preferences.shortcuts') }}</h3>
          <el-form-item size="mini">
            <el-row :gutter="8" style="margin-bottom: 8px;">
              <el-col :span="12">{{ $t('preferences.shortcut-command') }}</el-col>
              <el-col :span="12">{{ $t('preferences.shortcut-keystroke') }}</el-col>
            </el-row>
            <el-row v-for="command in getShortcutCommands()" :key="command" :gutter="8" style="margin-bottom: 8px;">
              <el-col :span="12">
                <el-input :value="getCommandLabel(command)" readonly />
              </el-col>
              <el-col :span="12">
                <el-input
                  :value="formatKeystrokeForDisplay(getKeystrokeByCommand(command))"
                  @keydown.native="setCommandKeystroke(command, normalizeKeystroke($event))"
                  :placeholder="$t('preferences.shortcut-placeholder')"
                />
              </el-col>
            </el-row>
            <el-button type="warning" size="mini" style="width: 100%;" @click="form.customKeymap = {}; autoSaveForm()">
              {{ $t('preferences.shortcut-reset-default') }}
            </el-button>
          </el-form-item>
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

        <!-- 扩展卡片 -->
        <div class="preference-card">
          <h3 class="card-title">{{ $t('preferences.browser-extensions') }}</h3>
          <el-form-item size="mini">
            <el-col class="form-item-sub" :span="24">
              <div class="form-item-sub">
                {{ $t('preferences.extension-channel') }}
                <el-input :value="appChannelUrl" readonly>
                  <el-button
                    slot="append"
                    icon="el-icon-document-copy"
                    @click="copyChannelUrl">
                    {{ $t('preferences.extension-copy-channel') }}
                  </el-button>
                </el-input>
              </div>
              <div class="el-form-item__info" style="margin-top: 8px;">
                {{ $t('preferences.extension-tips') }}
              </div>
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

        <!-- 文件管理卡片 -->
        <div class="preference-card">
          <h3 class="card-title">{{ $t('preferences.file-manage') }}</h3>
          <el-form-item size="mini">
            <el-col class="form-item-sub" :span="24">
              <el-input
                v-model="form.downloadingFileSuffix"
                @change="autoSaveForm"
                :placeholder="$t('preferences.downloading-file-suffix-tips')"
                :label="$t('preferences.downloading-file-suffix')">
                <template slot="prepend">
                  {{ $t('preferences.downloading-file-suffix') }}
                </template>
              </el-input>
            </el-col>
            <el-col class="form-item-sub" :span="24">
              <el-checkbox v-model="form.setFileMtimeOnComplete" @change="autoSaveForm">
                {{ $t('preferences.set-file-mtime-on-complete') }}
              </el-checkbox>
            </el-col>
            <!-- 自动分类文件设置 -->
            <el-col class="form-item-sub" :span="24">
              <el-checkbox v-model="form.autoCategorizeFiles" @change="autoSaveForm">
                {{ $t('preferences.auto-categorize-files') }}
              </el-checkbox>
              <div class="el-form-item__info">
                {{ $t('preferences.auto-categorize-files-tips') }}
                <el-button
                  type="primary"
                  size="mini"
                  @click="showCategoryDialog = true"
                  class="edit-rules-btn"
                  icon="el-icon-edit">
                  {{ $t('preferences.file-categories-edit') }}
                </el-button>
              </div>
            </el-col>
          </el-form-item>
        </div>
      </el-form>

      <!-- 文件分类规则编辑弹窗 -->
      <el-dialog
        :title="$t('preferences.file-categories')"
        :visible.sync="showCategoryDialog"
        width="800px"
        custom-class="tab-title-dialog category-rules-dialog"
        @open="handleCategoryDialogOpen"
        @close="handleCategoryDialogClose"
        :before-close="handleCategoryDialogBeforeClose"
      >
    <div class="category-dialog-content">
      <div class="category-list">
        <div
          v-for="(category, key) in tempFileCategories"
          :key="key"
          class="category-item"
        >
          <div class="category-header">
            <el-input
              v-model="category.name"
              :placeholder="$t('preferences.file-categories-folder-name')"
              size="mini"
              style="width: 200px; margin-right: 10px;"
              @input="handleCategoryChange"
            />
            <el-input
              v-model="category.extensions"
              :placeholder="$t('preferences.file-categories-extensions')"
              size="mini"
              style="flex: 1; margin-right: 10px;"
              @input="handleCategoryChange"
            />
            <el-button
              type="danger"
              size="mini"
              @click="removeCategory(key)"
              :disabled="key === 'others'"
            >
              {{ $t('preferences.file-categories-remove') }}
            </el-button>
          </div>
          <div class="category-info">
            <span class="category-key">{{ $t('preferences.file-categories-key') }}: {{ key }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗底部操作按钮 -->
    <div slot="footer" class="dialog-footer">
      <div style="flex: 1"></div>
      <el-button
        type="primary"
        size="mini"
        @click="addNewCategory"
      >
        {{ $t('preferences.file-categories-add') }}
      </el-button>
      <div style="flex: 1"></div>
      <el-button
        type="primary"
        @click="handleCategoryDialogSave"
        :disabled="!hasCategoryChanges"
        style="opacity: 1;"
      >
        {{ $t('preferences.save') }}
      </el-button>
    </div>

  </el-dialog>
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
    APP_HTTP_PORT,
    APP_RUN_MODE,
    EMPTY_STRING,
    ENGINE_MAX_CONCURRENT_DOWNLOADS
  } from '@shared/constants'
  import { reduceTrackerString } from '@shared/utils/tracker'
  import keymap from '@shared/keymap'

  const initForm = (config) => {
    const {
      autoHideWindow,
      btForceEncryption,
      btSaveMetadata,
      dir,
      downloadingFileSuffix,
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
      traySpeedometer,
      autoCategorizeFiles,
      fileCategories,
      setFileMtimeOnComplete,
      customKeymap
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
      downloadingFileSuffix,
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
      traySpeedometer,
      autoCategorizeFiles: autoCategorizeFiles || false,
      setFileMtimeOnComplete: setFileMtimeOnComplete || false,
      fileCategories: fileCategories || {
        images: { name: 'image-files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'] },
        documents: { name: 'document-files', extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx'] },
        audio: { name: 'audio-files', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'] },
        video: { name: 'video-files', extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'] },
        archives: { name: 'archive-files', extensions: ['zip', 'rar', '7z', 'tar', 'gz'] },
        programs: { name: 'program-files', extensions: ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm'] },
        others: { name: 'other-files', extensions: [] }
      },
      customKeymap: customKeymap || {}
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
        originalLanguageText: this.$t('preferences.undo-change'), // 记录初始语言的"撤回更改"文本
        showCategoryDialog: false, // 是否显示分类规则编辑弹窗
        tempFileCategories: null, // 弹窗临时数据
        originalFileCategories: null // 原始分类数据，用于检测修改
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
      // 检测分类数据是否有修改
      hasCategoryChanges () {
        if (!this.tempFileCategories || !this.originalFileCategories) {
          return false
        }
        return JSON.stringify(this.tempFileCategories) !== JSON.stringify(this.originalFileCategories)
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
      appChannelUrl () {
        return `http://127.0.0.1:${APP_HTTP_PORT}`
      },
      ...mapState('preference', {
        config: state => state.config
      }),
      // 本地化文件分类名称
      localizedFileCategories () {
        const categories = { ...this.form.fileCategories }

        // 遍历所有分类，将名称键值转换为本地化文本
        Object.keys(categories).forEach(key => {
          const category = categories[key]
          // 如果名称是键值（如'image-files'），则进行本地化
          if (category.name && category.name.includes('-files')) {
            categories[key] = {
              ...category,
              name: this.$t(`preferences.${category.name}`)
            }
          }
        })

        return categories
      }
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
      getShortcutCommands () {
        const baseCommands = Object.values(keymap)
        const customCommands = Object.values(this.form.customKeymap || {})
        const set = new Set([...baseCommands, ...customCommands])
        return Array.from(set)
      },
      getKeystrokeByCommand (command) {
        const custom = this.form.customKeymap || {}
        const customEntries = Object.entries(custom)
        for (const [ks, cmd] of customEntries) {
          if (cmd === command) return ks
        }
        const baseEntries = Object.entries(keymap)
        for (const [ks, cmd] of baseEntries) {
          if (cmd === command) return ks
        }
        return ''
      },
      normalizeKeystroke (event) {
        event.preventDefault()
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
      formatKeystrokeForDisplay (keystroke) {
        if (!keystroke) return ''
        const parts = keystroke.split('-').filter(Boolean)
        if (parts.length === 0) return ''
        const modifiers = []
        let key = ''
        parts.forEach(p => {
          switch (p) {
          case 'cmdctrl':
            modifiers.push('Ctrl/Cmd')
            break
          case 'ctrl':
            modifiers.push('Ctrl')
            break
          case 'cmd':
            modifiers.push('Cmd')
            break
          case 'shift':
            modifiers.push('Shift')
            break
          case 'alt':
            modifiers.push('Alt')
            break
          default:
            key = p
            break
          }
        })
        const specials = {
          esc: 'Esc',
          up: 'Up',
          down: 'Down',
          left: 'Left',
          right: 'Right'
        }
        const displayKey = specials[key] || (key.length === 1 ? key.toUpperCase() : key)
        return [...modifiers, displayKey].filter(Boolean).join(' + ')
      },
      setCommandKeystroke (command, keystroke) {
        const reserved = new Set(['cmdctrl-a', 'cmdctrl-m'])
        if (keystroke && reserved.has(keystroke)) {
          this.$msg.error(this.$t('preferences.shortcut-reserved') || '该快捷键与系统常用快捷键冲突，请更换')
          return
        }

        const baseEntries = Object.entries(keymap)
        const baseUsed = baseEntries.find(([ks, cmd]) => ks === keystroke && cmd !== command)
        const custom = { ...(this.form.customKeymap || {}) }
        const customUsed = Object.entries(custom).find(([ks, cmd]) => ks === keystroke && cmd !== command)
        if (keystroke && (baseUsed || customUsed)) {
          this.$msg.error(this.$t('preferences.shortcut-duplicated') || '该快捷键已被其他命令占用')
          return
        }

        // 允许为同一命令更新快捷键（移除旧映射）
        const next = { ...custom }
        Object.keys(next).forEach(k => {
          if (next[k] === command) {
            delete next[k]
          }
        })
        if (keystroke) {
          next[keystroke] = command
        }
        this.form.customKeymap = next
        this.autoSaveForm()
      },
      getCommandLabel (command) {
        const map = {
          'application:quit': 'app.quit',
          'application:new-task': 'task.new-task',
          'application:new-bt-task': 'task.new-bt-task',
          'application:open-file': 'task.open-file',
          'application:task-list': 'app.task-list',
          'application:preferences': 'app.preferences',
          'application:pause-all-task': 'task.pause-all-task',
          'application:resume-all-task': 'task.resume-all-task',
          'application:select-all-task': 'task.select-all-task'
        }
        const key = map[command]
        return key ? this.$t(key) : command
      },
      autoSaveForm () {
        // Debounce auto-save to avoid too many requests
        if (this.saveTimeout) {
          clearTimeout(this.saveTimeout)
        }
        this.saveTimeout = setTimeout(() => {
          // 验证下载中文件后缀格式
          this.validateDownloadingFileSuffix()

          // Double-check there are actual changes before submitting
          if (!isEmpty(diffConfig(this.formOriginal, this.form))) {
            this.submitForm('basicForm')
          }
        }, 100)
      },
      validateDownloadingFileSuffix () {
        const suffix = this.form.downloadingFileSuffix
        if (suffix && suffix.trim() !== '' && !suffix.startsWith('.')) {
          // 如果用户输入的后缀不以"."开头，自动添加"."
          this.form.downloadingFileSuffix = '.' + suffix
          this.$msg.warning(this.$t('preferences.downloading-file-suffix-format-warning'))
        }
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
      copyChannelUrl () {
        const text = this.appChannelUrl
        if (!text) return
        navigator.clipboard.writeText(text)
          .then(() => {
            this.$msg.success(this.$t('preferences.save-success-message'))
          })
          .catch(() => {
            this.$msg.error(this.$t('preferences.save-fail-message'))
          })
      },
      onDirectorySelected (dir) {
        this.form.dir = dir
        this.autoSaveForm()
      },
      // 弹窗打开时初始化临时数据
      handleCategoryDialogOpen () {
        // 深拷贝原始数据到临时数据
        this.tempFileCategories = cloneDeep(this.form.fileCategories)
        this.originalFileCategories = cloneDeep(this.form.fileCategories)
      },

      // 弹窗关闭时清理临时数据
      handleCategoryDialogClose () {
        this.tempFileCategories = null
        this.originalFileCategories = null
      },

      // 弹窗保存操作
      handleCategoryDialogSave () {
        // 验证分类数据
        const valid = this.validateCategories()
        if (!valid) {
          return
        }

        // 将临时数据同步到主表单
        this.form.fileCategories = cloneDeep(this.tempFileCategories)

        // 强制触发Vue响应式更新
        this.$set(this.form, 'fileCategories', { ...this.form.fileCategories })

        // 保存更改
        this.autoSaveForm()

        // 关闭弹窗
        this.showCategoryDialog = false

        this.$message({
          type: 'success',
          message: this.$t('preferences.save-success-message')
        })
      },

      handleCategoryDialogBeforeClose (done) {
        if (this.hasCategoryChanges) {
          this.$confirm(this.$t('preferences.file-categories-close-confirm'), this.$t('preferences.file-categories-close-title'), {
            confirmButtonText: this.$t('preferences.file-categories-close-confirm-button'),
            cancelButtonText: this.$t('preferences.file-categories-close-cancel-button'),
            type: 'warning'
          }).then(() => {
            // 用户选择保存并退出
            this.handleCategoryDialogSave()
            done()
          }).catch(() => {
            // 用户选择不保存直接退出
            done()
          })
        } else {
          // 没有更改，直接关闭
          done()
        }
      },

      // 添加新的分类规则
      addNewCategory () {
        // 生成唯一的分类键
        const newCategoryKey = 'new_category_' + Date.now()

        // 添加新的分类配置到临时数据
        this.$set(this.tempFileCategories, newCategoryKey, {
          name: this.$t('preferences.file-categories-new-folder-name'),
          extensions: []
        })
      },
      // 删除分类规则
      removeCategory (categoryKey) {
        this.$confirm(
          this.$t('preferences.file-categories-remove-confirm'),
          this.$t('preferences.file-categories-remove-title'),
          {
            confirmButtonText: this.$t('preferences.file-categories-remove-confirm-button'),
            cancelButtonText: this.$t('preferences.file-categories-remove-cancel-button'),
            type: 'warning'
          }
        ).then(() => {
          // 删除临时数据中的分类
          this.$delete(this.tempFileCategories, categoryKey)

          this.$message({
            type: 'success',
            message: this.$t('preferences.file-categories-remove-success')
          })
        }).catch(() => {
          // 用户取消删除
        })
      },

      // 处理分类数据实时更新
      handleCategoryChange () {
        // 验证分类数据
        const valid = this.validateCategories()
        if (!valid) {
          // 验证失败，不执行任何操作
        }
      },

      // 验证分类数据
      validateCategories () {
        for (const category of Object.values(this.form.fileCategories)) {
          // 检查文件夹名称
          if (!category.name || category.name.trim() === '') {
            this.$message({
              type: 'error',
              message: this.$t('preferences.file-categories-name-required')
            })
            return false
          }

          // 检查扩展名格式
          if (category.extensions && category.extensions.length > 0) {
            for (const ext of category.extensions) {
              if (ext && ext.includes('.')) {
                this.$message({
                  type: 'error',
                  message: this.$t('preferences.file-categories-ext-format-error')
                })
                return false
              }
            }
          }
        }
        return true
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

<style lang="scss" scoped>
 .content {
   height: 100%;
 }

 .panel {
   background: var(--panel-background);
 }

 .panel-header {
   padding: 0 24px;
   border-bottom: 1px solid var(--border-color);
   display: flex;
   align-items: center;
   justify-content: space-between;
 }

 .panel-content {
   padding: 0;
 }

 /* 文件分类样式 */
 .category-list {
   margin-top: 12px;
 }

 .category-item {
   margin-bottom: 12px;
   padding: 8px;
   border: 1px solid var(--border-color);
   border-radius: 4px;
   background: var(--background-color-light);
 }

 .category-item:last-child {
   margin-bottom: 0;
 }

 .category-item h4 {
   margin: 0 0 8px 0;
   font-size: 14px;
   font-weight: 500;
   color: $--color-text-primary;
 }

 /* 弹窗样式 */
 .category-dialog-content {
   max-height: 400px;
   overflow-y: auto;
   margin-bottom: 60px; /* 为底部按钮留出空间 */
 }

 /* 弹窗标题样式 */
 :deep(.el-dialog__title) {
   color: var(--text-color-primary, #303133);
 }

 /* 弹窗整体样式 */
 :deep(.el-dialog) {
   border: 1px solid var(--border-color);
 }

 :deep(.el-dialog__header) {
   border-bottom: 1px solid var(--border-color);
 }

 :deep(.el-dialog__body) {
   color: var(--text-color-primary, #303133);
   padding-bottom: 0;
 }

/* 使文件分类规则弹窗的遮罩层与新建任务弹窗一致 */
.el-dialog.category-rules-dialog {
  :deep(.el-dialog__wrapper) {
    background: rgba(0, 0, 0, 0.5);
  }
}

 .category-header {
   display: flex;
   align-items: center;
   margin-bottom: 8px;
 }

 .category-info {
   font-size: 12px;
   color: var(--text-color-secondary);
 }

 .category-key {
   background: var(--background-color-light);
   padding: 2px 6px;
   border-radius: 3px;
   font-family: monospace;
   color: var(--text-color-primary);
 }

 .dialog-actions {
   margin-top: 16px;
   text-align: center;
 }

 .dialog-footer {
   position: fixed;
   bottom: 0;
   left: 0;
   right: 0;
   background: var(--panel-background);
   padding: 16px 24px;
   border-top: 1px solid var(--border-color);
   display: flex;
   align-items: center;
   z-index: 1000;
 }

 /* 确保弹窗底部有足够空间 */
 :deep(.el-dialog__footer) {
   padding: 0;
 }

 /* 弹窗输入框和按钮的样式适配 */
 :deep(.el-input__inner) {
   background: var(--input-background);
   border-color: var(--border-color);
   color: var(--text-color-primary);
 }

 :deep(.el-input__inner:focus) {
   border-color: var(--primary-color);
 }

 :deep(.el-button:not(.el-button--primary)) {
   background: var(--button-background);
   border-color: var(--border-color);
   color: var(--text-color-primary);
 }

 :deep(.el-button--primary) {
   background: var(--primary-color);
   border-color: var(--primary-color);
   color: #fff;
 }

 :deep(.el-button--primary:disabled) {
   background: var(--primary-color);
   border-color: var(--primary-color);
   color: #fff;
   cursor: not-allowed;
 }

 /* 编辑规则按钮优化样式 */
 .edit-rules-btn {
   margin-left: 8px;
   padding: 6px 12px;
   border-radius: 6px;
   font-weight: 500;
   transition: all 0.2s ease-in-out;
   border: 1px solid transparent;
   background: var(--primary-color);
   color: #fff;
 }

 /* 白天模式适配 */
 .theme-light .edit-rules-btn {
   color: #000;
 }

 .theme-light .edit-rules-btn:hover {
   color: #000;
   background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light-1) 100%);
 }

 .edit-rules-btn:hover {
   background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light-1) 100%);
   border-color: var(--primary-color-light-1);
 }

 .edit-rules-btn:active {
   background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light-1) 100%);
   border-color: var(--primary-color-light-1);
 }

 .edit-rules-btn .el-icon-edit {
   margin-right: 4px;
   font-size: 12px;
 }

 /* 黑夜模式适配 */
 .theme-dark .edit-rules-btn {
   background: var(--primary-color);
   border-color: transparent;
   color: #fff;
 }

 .theme-dark .edit-rules-btn:hover {
   background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light-1) 100%);
   border-color: var(--primary-color-light-1);
 }

 .theme-dark .edit-rules-btn:active {
   background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-color-light-1) 100%);
   border-color: var(--primary-color-light-1);
 }

 /* 确保按钮在信息文本中正确对齐 */
 .el-form-item__info .edit-rules-btn {
   vertical-align: middle;
   margin-top: -2px;
 }
</style>
