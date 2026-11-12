const key = 'duel-room-recovery-v1'
export function readRecovery(endpoint,storage) {
  try {
    storage ??= globalThis.sessionStorage
    const value = JSON.parse(storage.getItem(key))
    if (value?.endpoint===endpoint && typeof value.token==='string' && value.token.length<1024 && value.expires>Date.now()) return value
    storage.removeItem(key)
  } catch { /* Storage may be unavailable. */ }
  return null
}
export function saveRecovery(endpoint,token,storage) {
  try { (storage || globalThis.sessionStorage).setItem(key,JSON.stringify({ endpoint,token,expires:Date.now()+60000 })) } catch { /* Guest play still works without storage. */ }
}
export function clearRecovery(storage) {
  try { (storage || globalThis.sessionStorage).removeItem(key) } catch { /* Storage may be unavailable. */ }
}
