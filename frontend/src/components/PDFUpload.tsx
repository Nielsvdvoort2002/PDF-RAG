import { useRef, useState, useCallback, type DragEvent, type ChangeEvent } from 'react'
import { useUpload, type UploadedDoc } from '../hooks/useUpload'

interface PDFUploadProps {
  onDocAdded: (doc: Omit<UploadedDoc, 'active'>) => void
  uploadKey: string
}

export default function PDFUpload({ onDocAdded, uploadKey }: PDFUploadProps) {
  const { state, error, upload } = useUpload(uploadKey)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf')) return
      const doc = await upload(file)
      if (doc) onDocAdded(doc)
    },
    [upload, onDocAdded],
  )

  const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const uploading = state === 'uploading'

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={onChange} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        disabled={uploading}
        className={[
          'w-full rounded-lg border border-dashed py-3.5 px-3 text-center transition-all duration-150',
          dragging
            ? 'border-accent bg-accent/10 text-accent'
            : uploading
              ? 'border-wire text-ink-dim cursor-not-allowed'
              : 'border-wire text-ink-dim hover:border-accent/40 hover:bg-surface hover:text-ink-base cursor-pointer',
        ].join(' ')}
      >
        {uploading ? (
          <span className="flex flex-col items-center gap-1.5">
            <span className="w-4 h-4 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
            <span className="text-xs font-mono">Indexing…</span>
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1.5">
            <UploadIcon />
            <span className="text-xs font-mono leading-tight">
              Drop PDF or click to browse
            </span>
          </span>
        )}
      </button>

      {error && (
        <p className="mt-1.5 text-xs font-mono text-signal-fail px-1 truncate" title={error}>
          {error}
        </p>
      )}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      />
    </svg>
  )
}
