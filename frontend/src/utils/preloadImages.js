// Downloads (and decodes) a list of pictures in the background so that, by
// the time the customer sees the menu, every image is already in the
// browser cache and shows up instantly.
//
// It never waits forever: after `timeoutMs` it gives up waiting and lets the
// app continue (the images keep loading by themselves).
export function preloadImages(urls, { timeoutMs = 8000 } = {}) {
  const unique = [...new Set((urls || []).filter(Boolean))]

  const loads = unique.map(
    (url) =>
      new Promise((resolve) => {
        const img = new Image()
        img.decoding = 'async'

        img.onload = () => {
          if (typeof img.decode === 'function') {
            img.decode().catch(() => {}).then(resolve)
          } else {
            resolve()
          }
        }
        img.onerror = resolve

        img.src = url
      })
  )

  return Promise.race([
    Promise.all(loads),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ])
}
