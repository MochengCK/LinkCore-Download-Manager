export const availableLanguages = [
  {
    value: 'de',
    label: 'Deutsch'
  },
  {
    value: 'en-US',
    label: 'English'
  },
  {
    value: 'es',
    label: 'Español'
  },
  {
    value: 'fr',
    label: 'Français'
  },
  {
    value: 'it',
    label: 'Italiano'
  },
  {
    value: 'ja',
    label: '日本語'
  },
  {
    value: 'ko',
    label: '한국어'
  },
  {
    value: 'pt-BR',
    label: 'Português (Brasil)'
  },
  {
    value: 'ru',
    label: 'Русский'
  },
  {
    value: 'zh-CN',
    label: '简体中文'
  },
  {
    value: 'zh-TW',
    label: '繁體中文'
  }
]

const checkLngIsAvailable = (locale) => {
  return availableLanguages.some(lng => lng.value === locale)
}

export const getLanguage = (locale = 'en-US') => {
  if (checkLngIsAvailable(locale)) {
    return locale
  }

  if (locale.startsWith('de')) {
    return 'de'
  }

  if (locale.startsWith('en')) {
    return 'en-US'
  }

  if (locale.startsWith('es')) {
    return 'es'
  }

  if (locale.startsWith('fr')) {
    return 'fr'
  }

  if (locale.startsWith('it')) {
    return 'it'
  }

  if (locale.startsWith('pt')) {
    return 'pt-BR'
  }

  if (locale === 'zh-HK') {
    return 'zh-TW'
  }

  if (locale.startsWith('zh')) {
    return 'zh-CN'
  }
}
