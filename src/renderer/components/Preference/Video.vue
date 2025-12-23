<template>
  <el-main class="panel-content">
    <el-form
      class="form-preference"
      ref="videoForm"
      label-position="right"
      size="mini"
      :model="form"
      :rules="rules"
    >
      <div class="preference-card">
        <h3 class="card-title">{{ $t('preferences.video-bilibili-card') }}</h3>
        <el-form-item :label="$t('preferences.video-cookie')">
          <el-input
            type="textarea"
            rows="4"
            auto-complete="off"
            v-model="form.videoCookie"
            @input="autoSaveForm"
          />
          <div class="el-form-item__info" style="margin-top: 8px;">
            {{ $t('preferences.video-cookie-tips') }}
          </div>
        </el-form-item>

        <el-form-item :label="$t('preferences.video-preferred-quality')">
          <el-select v-model="form.videoPreferredQn" @change="autoSaveForm" :placeholder="$t('preferences.video-preferred-quality-placeholder')">
            <el-option v-for="q in qualityOptions" :key="q.value" :label="q.label" :value="q.value" />
          </el-select>
          <div class="el-form-item__info" style="margin-top: 8px;">
            {{ $t('preferences.video-preferred-quality-tips') }}
          </div>
        </el-form-item>

        <el-form-item :label="$t('preferences.video-preferred-format')">
          <el-select v-model="form.videoPreferredFormat" @change="autoSaveForm" :placeholder="$t('preferences.video-preferred-format-placeholder')">
            <el-option :key="'auto'" :label="$t('preferences.video-preferred-format-auto')" :value="''" />
            <el-option v-for="f in formatOptions" :key="f.value" :label="f.label" :value="f.value" />
          </el-select>
          <div class="el-form-item__info" style="margin-top: 8px;">
            {{ $t('preferences.video-preferred-format-tips') }}
          </div>
        </el-form-item>
      </div>
    </el-form>
  </el-main>
</template>

<script>
  import { mapState } from 'vuex'
  import { isEmpty } from 'lodash'
  import { diffConfig, normalizeCookie } from '@shared/utils'

  const initForm = (config) => {
    const c = config || {}
    return {
      videoCookie: c.videoCookie || '',
      videoPreferredQn: c.videoPreferredQn !== undefined && c.videoPreferredQn !== null ? c.videoPreferredQn : '',
      videoPreferredFormat: c.videoPreferredFormat || ''
    }
  }

  export default {
    name: 'mo-preference-video',
    data () {
      return {
        form: {},
        formOriginal: {},
        rules: {},
        saveTimeout: null,
        qualityOptions: [
          { value: '', label: this.$t('preferences.video-preferred-quality-auto') },
          { value: 16, label: '360P (16)' },
          { value: 32, label: '480P (32)' },
          { value: 64, label: '720P (64)' },
          { value: 80, label: '1080P (80)' },
          { value: 112, label: '1080P+ (112)' },
          { value: 116, label: '1080P60 (116)' },
          { value: 120, label: '4K (120)' }
        ],
        formatOptions: [
          { value: 'mp4', label: 'MP4' },
          { value: 'mkv', label: 'MKV' },
          { value: 'mov', label: 'MOV' },
          { value: 'm4v', label: 'M4V' },
          { value: 'flv', label: 'FLV' },
          { value: 'ts', label: 'TS' }
        ]
      }
    },
    computed: {
      ...mapState('preference', {
        config: state => state.config
      })
    },
    watch: {
      config: {
        immediate: true,
        handler (val) {
          const f = initForm(val)
          this.form = f
          this.formOriginal = initForm(val)
        }
      },
      form: {
        deep: true,
        handler () {
          const hasChanges = !isEmpty(diffConfig(this.formOriginal, this.form))
          if (hasChanges) {
            this.autoSaveForm()
          }
        }
      }
    },
    methods: {
      autoSaveForm () {
        if (this.saveTimeout) {
          clearTimeout(this.saveTimeout)
        }
        this.saveTimeout = setTimeout(() => {
          const diff = diffConfig(this.formOriginal, this.form)
          if (!isEmpty(diff)) {
            this.submitForm(diff)
          }
        }, 100)
      },
      submitForm (payload) {
        const nextPayload = { ...payload }
        if (Object.prototype.hasOwnProperty.call(nextPayload, 'videoCookie')) {
          nextPayload.videoCookie = normalizeCookie(nextPayload.videoCookie || '')
        }
        this.$store.dispatch('preference/save', nextPayload)
          .then(() => {
            this.formOriginal = initForm({ ...this.config, ...nextPayload })
            this.$msg.success(this.$t('preferences.save-success-message'))
          })
          .catch(() => {
            this.$msg.error(this.$t('preferences.save-fail-message'))
          })
      }
    }
  }
</script>
