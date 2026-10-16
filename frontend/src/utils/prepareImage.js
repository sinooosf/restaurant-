// Turns a picture chosen from the computer into a small, web-friendly JPEG
// before it is uploaded: phone photos are often 5–10 MB and 4000 px wide,
// far more than a menu card needs.
//
//   prepareImage(file) -> Promise<Blob>   (image/jpeg, longest side <= 900 px)
//   throws Error with a code: 'not-image' | 'too-big' | 'unreadable'

export const MAX_SOURCE_BYTES = 15 * 1024 * 1024
export const MAX_SIDE = 900

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function fail(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(fail('unreadable'))
    }
    img.src = url
  })
}

export async function prepareImage(file) {
  if (!file || !ACCEPTED.includes(file.type)) throw fail('not-image')
  if (file.size > MAX_SOURCE_BYTES) throw fail('too-big')

  const img = await loadImage(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw fail('unreadable')

  // JPEG has no transparency: paint white first (menu cards are light).
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob) throw fail('unreadable')
  return blob
}
