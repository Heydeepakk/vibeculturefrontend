// A tiny vibration on phones that support it (Android); silently does nothing elsewhere.
export const buzz = (ms = 8) => {
  try { navigator.vibrate?.(ms) } catch { /* not supported */ }
}
