import type { UploadedDoc } from '../hooks/useUpload'
import PDFUpload from './PDFUpload'

interface SidebarProps {
  docs: UploadedDoc[]
  onDocAdded: (doc: Omit<UploadedDoc, 'active'>) => void
  onToggleDoc: (documentId: string) => void
  uploadKey: string
  onUploadKeyChange: (key: string) => void
}

export default function Sidebar({ docs, onDocAdded, onToggleDoc, uploadKey, onUploadKeyChange }: SidebarProps) {
  const activeCount = docs.filter(d => d.active).length

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
            <p className="text-[10px] font-mono text-ink-dim mt-0.5 tracking-widest uppercase">
              Document Intelligence
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
          {docs.length > 0 && (
            <span className="text-[10px] font-mono text-ink-dim bg-surface border border-wire px-1.5 py-0.5 rounded">
              {activeCount}/{docs.length} active
            </span>
          )}
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
              <li key={doc.document_id}>
                <button
                  type="button"
                  onClick={() => onToggleDoc(doc.document_id)}
                  title={doc.filename}
                  className={[
                    'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-all duration-150',
                    doc.active
                      ? 'bg-accent/10 border border-accent/25'
                      : 'border border-transparent hover:bg-surface',
                  ].join(' ')}
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
