export const MAX_ATTACHED_IMAGES = 4
export const MAX_IMAGE_DIMENSION = 1536
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

const INITIAL_WEBP_QUALITY = 0.84
const FALLBACK_WEBP_QUALITY = 0.7
const TARGET_MIME_TYPE = 'image/webp'

export interface AttachedImage {
  id: string
  source: 'capture' | 'clipboard'
  mimeType: string
  base64Data: string
  previewUrl: string
  width: number
  height: number
  byteSize: number
}

function generateImageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function calculateTargetDimensions(
  srcWidth: number,
  srcHeight: number
): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    throw new Error('Invalid image dimensions.')
  }

  const longestEdge = Math.max(srcWidth, srcHeight)
  if (longestEdge <= MAX_IMAGE_DIMENSION) {
    return { width: srcWidth, height: srcHeight }
  }

  const scale = MAX_IMAGE_DIMENSION / longestEdge
  return {
    width: Math.max(1, Math.round(srcWidth * scale)),
    height: Math.max(1, Math.round(srcHeight * scale)),
  }
}

function encodeCanvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error('Failed to encode image to WebP format.'))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality
    )
  })
}

function blobToPureBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Failed to read encoded image data.'))
        return
      }
      const commaIndex = result.indexOf(',')
      const pureBase64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result
      if (!pureBase64) {
        reject(new Error('Encoded Base64 image data is empty.'))
        return
      }
      resolve(pureBase64)
    }
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to convert Blob to Base64.'))
    }
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const trimmed = dataUrl.trim()
  if (!trimmed.startsWith('data:')) {
    throw new Error('Invalid Data URL format.')
  }

  const commaIndex = trimmed.indexOf(',')
  if (commaIndex === -1) {
    throw new Error('Malformed Data URL payload.')
  }

  const header = trimmed.slice(5, commaIndex)
  const payload = trimmed.slice(commaIndex + 1)
  const headerParts = header.split(';')
  const mimeType = headerParts[0] || 'image/png'
  const isBase64 = headerParts.includes('base64')

  if (!isBase64) {
    return new Blob([decodeURIComponent(payload)], { type: mimeType })
  }

  const binaryString = atob(payload)
  const length = binaryString.length
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

export async function processImageBlob(
  blob: Blob,
  source: 'capture' | 'clipboard'
): Promise<AttachedImage> {
  if (!blob || blob.size === 0) {
    throw new Error('Image data is empty.')
  }

  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')

  try {
    const { width, height } = calculateTargetDimensions(bitmap.width, bitmap.height)
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to acquire 2D canvas context.')
    }

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)

    let outputBlob = await encodeCanvasToBlob(canvas, TARGET_MIME_TYPE, INITIAL_WEBP_QUALITY)
    if (outputBlob.size > MAX_IMAGE_BYTES) {
      outputBlob = await encodeCanvasToBlob(canvas, TARGET_MIME_TYPE, FALLBACK_WEBP_QUALITY)
    }
    if (outputBlob.size > MAX_IMAGE_BYTES) {
      throw new Error('Compressed image exceeds the 2MB size limit.')
    }

    const base64Data = await blobToPureBase64(outputBlob)
    const previewUrl = URL.createObjectURL(outputBlob)

    return {
      id: generateImageId(),
      source,
      mimeType: outputBlob.type || TARGET_MIME_TYPE,
      base64Data,
      previewUrl,
      width,
      height,
      byteSize: outputBlob.size,
    }
  } finally {
    bitmap.close()
    canvas.width = 0
    canvas.height = 0
  }
}

export async function processDataUrl(
  dataUrl: string,
  source: 'capture' | 'clipboard'
): Promise<AttachedImage> {
  const blob = dataUrlToBlob(dataUrl)
  return processImageBlob(blob, source)
}

export function revokeAttachedImage(image: AttachedImage): void {
  if (image && image.previewUrl && image.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(image.previewUrl)
  }
}

export function revokeAttachedImages(images: AttachedImage[]): void {
  for (const image of images) {
    revokeAttachedImage(image)
  }
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
