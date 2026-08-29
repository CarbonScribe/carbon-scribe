'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { chunkedUpload } from '@/lib/utils/chunkedUpload'
import type { ChunkedUploadOptions, UploadProgress } from '@/lib/utils/chunkedUpload'

export type { ChunkedUploadOptions, UploadProgress }

export interface UseChunkedUploadState {
  progress: UploadProgress | null
  uploading: boolean
  error: string | null
}

export interface UseChunkedUploadActions {
  start: (options: Omit<ChunkedUploadOptions, 'signal' | 'onProgress'>) => Promise<{ cid: string } | null>
  cancel: () => void
  reset: () => void
}

export function useChunkedUpload(): UseChunkedUploadState & UseChunkedUploadActions {
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    setProgress(null)
    setUploading(false)
    setError(null)
  }, [])

  // Abort on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const start = useCallback(
    async (options: Omit<ChunkedUploadOptions, 'signal' | 'onProgress'>): Promise<{ cid: string } | null> => {
      const controller = new AbortController()
      abortRef.current = controller

      setUploading(true)
      setError(null)
      setProgress({ bytesUploaded: 0, totalBytes: options.file.size, percent: 0 })

      try {
        const result = await chunkedUpload({
          ...options,
          signal: controller.signal,
          onProgress: setProgress,
        })
        setUploading(false)
        return result
      } catch (err: any) {
        setUploading(false)
        if (err.name === 'AbortError') {
          setError('Upload cancelled')
          return null
        }
        const message = err instanceof Error ? err.message : 'Upload failed'
        setError(message)
        return null
      }
    },
    [],
  )

  return { progress, uploading, error, start, cancel, reset }
}
