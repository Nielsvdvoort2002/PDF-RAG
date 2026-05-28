import { useState } from 'react'
import type { ReindexResult } from '../api/client'
import type { UploadedDoc } from '../hooks/useUpload'
import PDFUpload from './PDFUpload'

interface SidebarProps {
  docs: UploadedDoc[]
  onDocAdded: (doc: Omit<UploadedDoc, 'active'>) => void
  onToggleDoc: (documentId: string) => void
  onDeleteDoc: (documentId: string) => Promise<void>
  onClearDocs: () => Promise<void>
  uploadKey: string
  onUploadKeyChange: (key: string) => void
  onReindex: () => Promise<{ results: ReindexResult[] }>
}

export default function Sidebar({ docs, onDocAdded, onToggleDoc, onDeleteDoc, onClearDocs, uploadKey, onUploadKeyChange, onReindex }: SidebarProps) {
  const activeCount = docs.filter(d => d.active).length
  const [reindexing, setReindexing] = useState(false)
  const [reindexStatus, setReindexStatus] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const hasKey = uploadKey.trim().length > 0

  const handleDelete = async (documentId: string) => {
    setDeletingId(documentId)
    try {
      await onDeleteDoc(documentId)
    } finally {
      setDeletingId(null)
    }
  }

  const handleClear = async () => {
    setClearing(true)
    try {
      await onClearDocs()
    } finally {
      setClearing(false)
    }
  }

  const handleReindex = async () => {
    setReindexing(true)
    setReindexStatus(null)
    try {
      const { results } = await onReindex()
      const ok = results.filter(r => r.status === 'ok').length
      setReindexStatus(`Re-indexed ${ok}/${results.length} documents`)
    } catch (e) {
      setReindexStatus(e instanceof Error ? e.message : 'Failed')
    } finally {
      setReindexing(false)
    }
  }

  return (
    <aside
      className="w-[260px] flex-shrink-0 flex flex-col h-full border-r border-wire bg-pit"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(34,34,56,0.6) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-wire flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent/20">
            <DocIcon />
          </div>
          <div>
            <p className="font-display font-bold text-ink-bright leading-none tracking-tight">
              PDF RAG
            </p>
          </div>
        </div>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-[10px] font-mono font-medium text-ink-dim uppercase tracking-widest">
            Documents
          </span>
          <div className="flex items-center gap-1.5">
            {docs.length > 0 && (
              <span className="text-[10px] font-mono text-ink-dim bg-surface border border-wire px-1.5 py-0.5 rounded">
                {activeCount}/{docs.length} active
              </span>
            )}
            {docs.length > 0 && hasKey && (
              <button
                type="button"
                onClick={handleClear}
                disabled={clearing}
                title="Remove all documents"
                className="text-[10px] font-mono text-ink-dim hover:text-signal-fail transition-colors disabled:opacity-40"
              >
                {clearing ? '…' : 'clear all'}
              </button>
            )}
          </div>
        </div>

        {docs.length === 0 ? (
          <div className="px-4 py-3">
            <p className="text-xs font-mono text-ink-dim leading-relaxed">
              No documents yet.
              <br />
              Upload a PDF below.
            </p>
          </div>
        ) : (
          <ul className="px-2 pb-2 space-y-0.5">
            {docs.map(doc => (
              <li
                key={doc.document_id}
                className={[
                  'flex items-center gap-1 rounded-lg transition-all duration-150',
                  doc.active
                    ? 'bg-accent/10 border border-accent/25'
                    : 'border border-transparent hover:bg-surface',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => onToggleDoc(doc.document_id)}
                  title={doc.filename}
                  className="flex-1 flex items-center gap-2.5 px-2 py-2 text-left min-w-0"
                >
                  <span
                    className={[
                      'flex-shrink-0 w-1.5 h-1.5 rounded-full transition-colors',
                      doc.active ? 'bg-accent' : 'bg-ink-muted',
                    ].join(' ')}
                  />
                  <span
                    className={[
                      'flex-1 truncate text-xs font-mono min-w-0',
                      doc.active ? 'text-ink-bright' : 'text-ink-base',
                    ].join(' ')}
                  >
                    {doc.filename}
                  </span>
                  <span className="flex-shrink-0 text-[10px] font-mono text-ink-dim bg-surface px-1.5 py-0.5 rounded border border-wire">
                    {doc.chunk_count}
                  </span>
                </button>
                {hasKey && (
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.document_id)}
                    disabled={deletingId === doc.document_id}
                    title="Remove document"
                    className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-ink-dim hover:text-signal-fail transition-colors disabled:opacity-40 rounded mr-1"
                  >
                    {deletingId === doc.document_id ? '…' : '×'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Upload zone */}
      <div className="p-3 border-t border-wire flex-shrink-0 space-y-2">
        {/* Upload key — only you know this; required to add new PDFs */}
        <div>
          <label className="text-[10px] font-mono text-ink-dim uppercase tracking-widest block mb-1">
            Upload key
          </label>
          <input
            type="password"
            value={uploadKey}
            onChange={e => onUploadKeyChange(e.target.value)}
            placeholder="Required to upload"
            className="w-full bg-surface border border-wire rounded px-2 py-1.5 text-xs font-mono text-ink-base outline-none focus:border-accent/50 placeholder:text-ink-muted"
          />
        </div>
        <PDFUpload onDocAdded={onDocAdded} uploadKey={uploadKey} />

        {docs.length > 0 && uploadKey.trim().length > 0 && (
          <div>
            <button
              type="button"
              onClick={handleReindex}
              disabled={reindexing}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-wire text-xs font-mono text-ink-dim hover:border-accent/40 hover:text-ink-base transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reindexing ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                  Re-indexing…
                </>
              ) : (
                'Re-index documents'
              )}
            </button>
            {reindexStatus && (
              <p className="mt-1 text-[10px] font-mono text-ink-dim px-1">{reindexStatus}</p>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

function DocIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth={1.75} className="w-4 h-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4a2 2 0 012-2h5.172a2 2 0 011.414.586l2.828 2.828A2 2 0 0116 6.828V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
      />
      <path strokeLinecap="round" d="M8 10h4M8 13h2" />
    </svg>
  )
}
