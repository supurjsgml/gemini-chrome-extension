export function $t(key: string, substitutions?: string | string[]): string {
  if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
    const translated = chrome.i18n.getMessage(key, substitutions)
    if (translated) {
      return translated
    }
  }

  if (substitutions !== undefined) {
    const values = Array.isArray(substitutions) ? substitutions : [substitutions]
    return values.reduce((acc, val, idx) => acc.replace(`$${idx + 1}`, val), key)
  }

  return key
}
