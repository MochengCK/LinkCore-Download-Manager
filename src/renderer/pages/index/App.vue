<template>
  <div id="app">
    <mo-title-bar
      v-if="isRenderer"
      :showActions="showWindowActions"
    />
    <router-view />
    <mo-engine-client
      :secret="rpcSecret"
    />
    <mo-ipc v-if="isRenderer" />
    <mo-dynamic-tray v-if="enableTraySpeedometer" />
  </div>
</template>

<script>
  import is from 'electron-is'
  import { mapGetters, mapState } from 'vuex'
  import { APP_RUN_MODE, APP_THEME } from '@shared/constants'
  import DynamicTray from '@/components/Native/DynamicTray'
  import EngineClient from '@/components/Native/EngineClient'
  import Ipc from '@/components/Native/Ipc'
  import TitleBar from '@/components/Native/TitleBar'
  import { getLanguage } from '@shared/locales'
  import { getLocaleManager } from '@/components/Locale'

  export default {
    name: 'LinkCore Download Manager-app',
    components: {
      [DynamicTray.name]: DynamicTray,
      [EngineClient.name]: EngineClient,
      [Ipc.name]: Ipc,
      [TitleBar.name]: TitleBar
    },
    computed: {
      isMac: () => is.macOS(),
      isRenderer: () => is.renderer(),
      ...mapState('app', {
        systemTheme: state => state.systemTheme
      }),
      ...mapState('preference', {
        showWindowActions: state => {
          return (is.windows() || is.linux()) && state.config.hideAppMenu
        },
        runMode: state => state.config.runMode,
        traySpeedometer: state => state.config.traySpeedometer,
        rpcSecret: state => state.config.rpcSecret
      }),
      ...mapGetters('preference', [
        'theme',
        'locale',
        'direction'
      ]),
      themeClass () {
        if (this.theme === APP_THEME.AUTO) {
          return `theme-${this.systemTheme}`
        } else {
          return `theme-${this.theme}`
        }
      },
      i18nClass () {
        return `i18n-${this.locale}`
      },
      directionClass () {
        return `dir-${this.direction}`
      },
      enableTraySpeedometer () {
        const { isMac, isRenderer, traySpeedometer, runMode } = this
        return isMac && isRenderer && traySpeedometer && runMode !== APP_RUN_MODE.HIDE_TRAY
      }
    },
    methods: {
      updateRootClassName () {
        const { themeClass = '', i18nClass = '', directionClass = '' } = this
        const className = `${themeClass} ${i18nClass} ${directionClass}`
        document.documentElement.className = className
      }
    },
    beforeMount () {
      this.updateRootClassName()
    },
    mounted () {
      this._updateMessageShown = false
      const onUpdateAvailable = (event, version, releaseNotes) => {
        const cfg = (this.$store.state.preference && this.$store.state.preference.config) || {}
        const autoCheckEnabled = !!cfg.autoCheckUpdate
        if (autoCheckEnabled) {
          this.$store.dispatch('preference/updateUpdateAvailable', true)
          this.$store.dispatch('preference/updateNewVersion', version)
          this.$store.dispatch('preference/updateLastCheckUpdateTime', Date.now())
          this.$store.dispatch('preference/updateReleaseNotes', releaseNotes || '')
        }
      }
      const onUpdateNotAvailable = () => {
        const cfg = (this.$store.state.preference && this.$store.state.preference.config) || {}
        const autoCheckEnabled = !!cfg.autoCheckUpdate
        if (autoCheckEnabled) {
          this.$store.dispatch('preference/updateUpdateAvailable', false)
          this.$store.dispatch('preference/updateNewVersion', '')
          this.$store.dispatch('preference/updateLastCheckUpdateTime', Date.now())
        }
      }
      const onUpdateError = () => {}
      this.$electron.ipcRenderer.on('update-available', onUpdateAvailable)
      this.$electron.ipcRenderer.on('update-not-available', onUpdateNotAvailable)
      this.$electron.ipcRenderer.on('update-error', onUpdateError)
      this._updateHandlers = { onUpdateAvailable, onUpdateNotAvailable, onUpdateError }
    },
    destroyed () {
      const h = this._updateHandlers || {}
      if (h.onUpdateAvailable) {
        this.$electron.ipcRenderer.removeListener('update-available', h.onUpdateAvailable)
      }
      if (h.onUpdateNotAvailable) {
        this.$electron.ipcRenderer.removeListener('update-not-available', h.onUpdateNotAvailable)
      }
      if (h.onUpdateError) {
        this.$electron.ipcRenderer.removeListener('update-error', h.onUpdateError)
      }
    },
    watch: {
      locale (val) {
        const lng = getLanguage(val)
        getLocaleManager().changeLanguage(lng)
      },
      themeClass () {
        this.updateRootClassName()
      },
      i18nClass () {
        this.updateRootClassName()
      },
      directionClass () {
        this.updateRootClassName()
      }
    }
  }
</script>

<style>
</style>
