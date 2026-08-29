import { getAccessToken } from '@/lib/auth/token-storage'

export interface UploadProgress {
  bytesUploaded: number
  totalBytes: number
  percent: number
}

export interface ChunkedUploadOptions {
  url: string
  file: File
  metadata: Record<string, string>
  /** Session key for localStorage resume tracking */
  sessionKey: string
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
}

interface UploadSession {
  sessionKey: string
  fileName: string
  fileSize: number
  bytesUploaded: number
}

const STORAGE_KEY = 'ipfs_upload_sessions'
const CHUNK_SIZE = 2 * 1024 * 1024 // 2 MB
const MAX_RETRIES = 3
const BASE_DELAY_MS = 500

function loadSession(sessionKey: string): UploadSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const sessions: Record<string, UploadSession> = JSON.parse(raw)
    return sessions[sessionKey] ?? null
  } catch {
    return null
  }
}

function saveSession(session: UploadSession): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const sessions: Record<string, UploadSession> = raw ? JSON.parse(raw) : {}
    sessions[session.sessionKey] = session
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // storage unavailable — continue without persistence
  }
}

function clearSession(sessionKey: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const sessions: Record<string, UploadSession> = JSON.parse(raw)
    delete sessions[sessionKey]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch {
    // ignore
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function uploadChunk(
  url: string,
  file: File,
  chunkStart: number,
  chunkEnd: number,
  metadata: Record<string, string>,
  signal: AbortSignal,
): Promise<Response> {
  const chunk = file.slice(chunkStart, chunkEnd)
  const formData = new FormData()
  formData.append('file', chunk, file.name)
  formData.append('chunkStart', String(chunkStart))
  formData.append('chunkEnd', String(chunkEnd - 1))
  formData.append('totalSize', String(file.size))
  formData.append('fileName', file.name)
  Object.entries(metadata).forEach(([key, value]) => formData.append(key, value))

  const token = getAccessToken()

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (signal.aborted) throw new DOMException('Upload cancelled', 'AbortError')

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Range': `bytes ${chunkStart}-${chunkEnd - 1}/${file.size}`,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
        signal,
      })

      // 308 Resume Incomplete — server acknowledged chunk, continue
      if (response.ok || response.status === 308) return response

      if (response.status >= 500 || response.status === 408 || response.status === 429) {
        if (attempt < MAX_RETRIES - 1) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt))
          continue
        }
      }

      return response
    } catch (err: any) {
      if (err.name === 'AbortError') throw err
      if (attempt < MAX_RETRIES - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt))
        continue
      }
      throw err
    }
  }

  throw new Error(`Chunk upload failed after ${MAX_RETRIES} attempts`)
}

/**
 * Upload a file in sequential chunks, resuming from the last saved offset
 * if a persisted session exists for the same sessionKey.
 */
export async function chunkedUpload(options: ChunkedUploadOptions): Promise<{ cid: string }> {
  const {
    url,
    file,
    metadata,
    sessionKey,
    onProgress,
    signal = new AbortController().signal,
  } = options

  const existing = loadSession(sessionKey)
  let bytesUploaded =
    existing?.fileName === file.name && existing?.fileSize === file.size
      ? existing.bytesUploaded
      : 0

  const total = file.size

  onProgress?.({
    bytesUploaded,
    totalBytes: total,
    percent: Math.round((bytesUploaded / total) * 100),
  })

  let lastResponse: Response | null = null

  while (bytesUploaded < total) {
    if (signal.aborted) throw new DOMException('Upload cancelled', 'AbortError')

    const chunkEnd = Math.min(bytesUploaded + CHUNK_SIZE, total)
    const response = await uploadChunk(url, file, bytesUploaded, chunkEnd, metadata, signal)

    if (!response.ok && response.status !== 308) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Chunk upload failed (${response.status}): ${errorText}`)
    }

    bytesUploaded = chunkEnd
    lastResponse = response

    saveSession({ sessionKey, fileName: file.name, fileSize: total, bytesUploaded })
    onProgress?.({
      bytesUploaded,
      totalBytes: total,
      percent: Math.round((bytesUploaded / total) * 100),
    })
  }

  clearSession(sessionKey)

  const data = await lastResponse!.json().catch(() => ({}))
  const cid: string = data?.cid ?? data?.data?.cid ?? ''
  return { cid }
}
