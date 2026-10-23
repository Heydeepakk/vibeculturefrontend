// Small per-browser memories that make the shop feel personal. Storage can be blocked
// (private mode etc.), so every access is wrapped and failure just means "nothing remembered".

const RECENT_KEY = 'vc_recently_viewed'
const ORDERED_KEY = 'vc_just_ordered'

export const getRecentlyViewed = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || [] } catch { return [] }
}

export const rememberViewed = (id) => {
  if (!id) return
  try {
    const list = [id, ...getRecentlyViewed().filter(x => x !== id)].slice(0, 12)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch { /* storage unavailable */ }
}

// set just before going to /orders after a successful payment; read (and cleared) once there
export const markJustOrdered = () => {
  try { sessionStorage.setItem(ORDERED_KEY, '1') } catch { /* storage unavailable */ }
}

export const takeJustOrdered = () => {
  try {
    const v = sessionStorage.getItem(ORDERED_KEY) === '1'
    sessionStorage.removeItem(ORDERED_KEY)
    return v
  } catch { return false }
}
