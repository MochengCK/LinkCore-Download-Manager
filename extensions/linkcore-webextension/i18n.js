// 多语言翻译数据
const translations = {
  en: {
    extensionName: "LinkCore Download Manager",
    extensionDescription: "Send browser downloads to LinkCore Download Manager via aria2 RPC",
    actionTitle: "LinkCore",
    popupTitle: "LinkCore Download Manager",
    rpcAddress: "RPC Address",
    connectionStatus: "Connection Status",
    clientVersion: "Client Version",
    totalSpeed: "Total Download Speed",
    downloadTasks: "Download Tasks",
    noTasks: "No download tasks",
    autoHijack: "Auto-hijack browser downloads",
    connected: "Connected",
    disconnected: "Disconnected",
    contextMenuDownload: "Download with LinkCore"
  },
  zh_CN: {
    extensionName: "LinkCore Download Manager",
    extensionDescription: "通过 aria2 RPC 将浏览器下载发送到 LinkCore 下载管理器",
    actionTitle: "LinkCore",
    popupTitle: "LinkCore Download Manager",
    rpcAddress: "RPC 地址",
    connectionStatus: "连接状态",
    clientVersion: "客户端版本",
    totalSpeed: "总下载速度",
    downloadTasks: "下载任务",
    noTasks: "暂无下载任务",
    autoHijack: "自动接管浏览器下载",
    connected: "已连接",
    disconnected: "未连接",
    contextMenuDownload: "使用 LinkCore 下载"
  },
  zh_TW: {
    extensionName: "LinkCore Download Manager",
    extensionDescription: "透過 aria2 RPC 將瀏覽器下載發送到 LinkCore 下載管理器",
    actionTitle: "LinkCore",
    popupTitle: "LinkCore Download Manager",
    rpcAddress: "RPC 地址",
    connectionStatus: "連接狀態",
    clientVersion: "客戶端版本",
    totalSpeed: "總下載速度",
    downloadTasks: "下載任務",
    noTasks: "暫無下載任務",
    autoHijack: "自動接管瀏覽器下載",
    connected: "已連接",
    disconnected: "未連接",
    contextMenuDownload: "使用 LinkCore 下載"
  },
  ja: {
    extensionName: "LinkCore Download Manager",
    extensionDescription: "aria2 RPC を介してブラウザのダウンロードを LinkCore ダウンロードマネージャーに送信",
    actionTitle: "LinkCore",
    popupTitle: "LinkCore Download Manager",
    rpcAddress: "RPC アドレス",
    connectionStatus: "接続状態",
    clientVersion: "クライアントバージョン",
    totalSpeed: "合計ダウンロード速度",
    downloadTasks: "ダウンロードタスク",
    noTasks: "ダウンロードタスクはありません",
    autoHijack: "ブラウザのダウンロードを自動的にハイジャック",
    connected: "接続済み",
    disconnected: "未接続",
    contextMenuDownload: "LinkCore でダウンロード"
  },
  ko: {
    extensionName: "LinkCore Download Manager",
    extensionDescription: "aria2 RPC를 통해 브라우저 다운로드를 LinkCore 다운로드 관리자로 전송",
    actionTitle: "LinkCore",
    popupTitle: "LinkCore Download Manager",
    rpcAddress: "RPC 주소",
    connectionStatus: "연결 상태",
    clientVersion: "클라이언트 버전",
    totalSpeed: "총 다운로드 속도",
    downloadTasks: "다운로드 작업",
    noTasks: "다운로드 작업 없음",
    autoHijack: "브라우저 다운로드 자동 가로채기",
    connected: "연결됨",
    disconnected: "연결 안 됨",
    contextMenuDownload: "LinkCore로 다운로드"
  },
  es: {
    extensionName: "LinkCore Download Manager",
    extensionDescription: "Enviar descargas del navegador al administrador de descargas LinkCore a través de aria2 RPC",
    actionTitle: "LinkCore",
    popupTitle: "LinkCore Download Manager",
    rpcAddress: "Dirección RPC",
    connectionStatus: "Estado de conexión",
    clientVersion: "Versión del cliente",
    totalSpeed: "Velocidad total de descarga",
    downloadTasks: "Tareas de descarga",
    noTasks: "Sin tareas de descarga",
    autoHijack: "Secuestrar automáticamente las descargas del navegador",
    connected: "Conectado",
    disconnected: "Desconectado",
    contextMenuDownload: "Descargar con LinkCore"
  },
  fr: {
    extensionName: "LinkCore Download Manager",
    extensionDescription: "Envoyer les téléchargements du navigateur vers le gestionnaire de téléchargements LinkCore via aria2 RPC",
    actionTitle: "LinkCore",
    popupTitle: "LinkCore Download Manager",
    rpcAddress: "Adresse RPC",
    connectionStatus: "État de la connexion",
    clientVersion: "Version du client",
    totalSpeed: "Vitesse totale de téléchargement",
    downloadTasks: "Tâches de téléchargement",
    noTasks: "Aucune tâche de téléchargement",
    autoHijack: "Détournement automatique des téléchargements du navigateur",
    connected: "Connecté",
    disconnected: "Déconnecté",
    contextMenuDownload: "Télécharger avec LinkCore"
  },
  de: {
    extensionName: "LinkCore Download Manager",
    extensionDescription: "Browser-Downloads über aria2 RPC an LinkCore Download Manager senden",
    actionTitle: "LinkCore",
    popupTitle: "LinkCore Download Manager",
    rpcAddress: "RPC-Adresse",
    connectionStatus: "Verbindungsstatus",
    clientVersion: "Client-Version",
    totalSpeed: "Gesamtgeschwindigkeit herunterladen",
    downloadTasks: "Download-Aufgaben",
    noTasks: "Keine Download-Aufgaben",
    autoHijack: "Browser-Downloads automatisch abfangen",
    connected: "Verbunden",
    disconnected: "Getrennt",
    contextMenuDownload: "Mit LinkCore herunterladen"
  },
  ru: {
    extensionName: "LinkCore Download Manager",
    extensionDescription: "Отправка загрузок браузера в менеджер загрузок LinkCore через aria2 RPC",
    actionTitle: "LinkCore",
    popupTitle: "LinkCore Download Manager",
    rpcAddress: "Адрес RPC",
    connectionStatus: "Состояние подключения",
    clientVersion: "Версия клиента",
    totalSpeed: "Общая скорость загрузки",
    downloadTasks: "Задачи загрузки",
    noTasks: "Нет задач загрузки",
    autoHijack: "Автоматически перехватывать загрузки браузера",
    connected: "Подключено",
    disconnected: "Отключено",
    contextMenuDownload: "Скачать с LinkCore"
  }
}

// 当前语言
let currentLocale = 'en'

// 初始化语言
const initLocale = async () => {
  try {
    // 从 storage 读取客户端同步的语言
    const config = await new Promise((resolve) => {
      chrome.storage.local.get(['browserLocale'], (result) => {
        resolve(result || {})
      })
    })
    
    console.log('[i18n] Storage config:', config)
    
    if (config.browserLocale && translations[config.browserLocale]) {
      currentLocale = config.browserLocale
      console.log('[i18n] Using synced locale from storage:', currentLocale)
    } else {
      // 回退到浏览器默认语言
      const browserLang = chrome.i18n.getUILanguage()
      console.log('[i18n] No synced locale, using browser language:', browserLang)
      if (browserLang.startsWith('zh-CN') || browserLang.startsWith('zh_CN')) {
        currentLocale = 'zh_CN'
      } else if (browserLang.startsWith('zh-TW') || browserLang.startsWith('zh_TW')) {
        currentLocale = 'zh_TW'
      } else if (browserLang.startsWith('ja')) {
        currentLocale = 'ja'
      } else if (browserLang.startsWith('ko')) {
        currentLocale = 'ko'
      } else if (browserLang.startsWith('es')) {
        currentLocale = 'es'
      } else if (browserLang.startsWith('fr')) {
        currentLocale = 'fr'
      } else if (browserLang.startsWith('de')) {
        currentLocale = 'de'
      } else if (browserLang.startsWith('ru')) {
        currentLocale = 'ru'
      } else {
        currentLocale = 'en'
      }
      console.log('[i18n] Fallback locale:', currentLocale)
    }
  } catch (e) {
    console.error('[i18n] Failed to init locale:', e)
    currentLocale = 'en'
  }
  
  console.log('[i18n] Final locale:', currentLocale)
  return currentLocale
}

// 获取翻译文本
const t = (key) => {
  const locale = translations[currentLocale] || translations.en
  return locale[key] || key
}
