import { useState, useCallback } from 'react'
import { uploadPDF } from '../api/client'

export interface UploadedDoc {
  document_id: string
  filename: string
  chunk_count: number
  active: boolean
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

export function useUpload(uploadKey: string) {
  const [state, setState] = useState<UploadState>('idle')
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (file: File): Promise<Omit<UploadedDoc, 'active'> | null> => {
    setState('uploading')
    setError(null)
    try {
      const res = await uploadPDF(file, uploadKey)
      setState('done')
      return { document_id: res.document_id, filename: res.filename, chunk_count: res.chunk_count }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setState('error')
      setError(msg)
      return null
    }
  }, [uploadKey])

  const reset = useCallback(() => {
    setState('idle')
    setError(null)
  }, [])

  return { state, error, upload, reset }
}
