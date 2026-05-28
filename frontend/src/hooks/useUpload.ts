import { useState, useCallback } from 'react'
import { uploadPDF } from '../api/client'

export interface UploadedDoc {
  document_id: string
  filename: string
  chunk_count: number
  active: boolean
}

export function useUpload(uploadKey: string) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(async (file: File): Promise<Omit<UploadedDoc, 'active'> | null> => {
    setUploading(true)
    setError(null)
    try {
      const res = await uploadPDF(file, uploadKey)
      return { document_id: res.document_id, filename: res.filename, chunk_count: res.chunk_count }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      return null
    } finally {
      setUploading(false)
    }
  }, [uploadKey])

  return { uploading, error, upload }
}
