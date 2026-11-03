export const MAP_IMAGE_BYTES = 50 * 1024 * 1024
export const MAP_SOURCE_BYTES = 100 * 1024 * 1024
export const MAP_PREVIEW_BYTES = 5 * 1024 * 1024
export const MAP_TOTAL_IMAGE_BYTES = 200 * 1024 * 1024
export const MAP_ARCHIVE_BYTES = 400 * 1024 * 1024
export const MAP_IMAGE_PIXELS = 64000000
export const MAP_IMAGE_EDGE = 16000
export const MAP_PREVIEW_EDGE = 2048
export const MAP_OPTIMIZED_EDGE = 4096
export const MAP_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const base64Limit = (bytes: number) => 4 * Math.ceil(bytes / 3) + 128
