const matchHotkey = (event) => {
  if (!event) return false
  if (event.shiftKey) return true
  const key = (event.key || '').toLowerCase()
  return key === 'shift'
}

const sendToggleAutoHijackOverride = () => {
  try {
    chrome.runtime.sendMessage({ type: 'shiftHotkeyTriggered' }, () => {})
  } catch (e) {
  }
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('keydown', (event) => {
    if (matchHotkey(event)) {
      sendToggleAutoHijackOverride()
    }
  }, true)

  window.addEventListener('click', (event) => {
    if (matchHotkey(event)) {
      sendToggleAutoHijackOverride()
    }
  }, true)
}
