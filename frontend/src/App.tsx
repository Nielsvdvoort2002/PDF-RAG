import { useState, useCallback, useEffect } from 'react'
import { createSession, getSession, listDocuments, reindexDocuments, deleteDocument, clearDocuments } from './api/client'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import { useChat } from './hooks/useChat'
import type { UploadedDoc } from './hooks/useUpload'

const SESSION_KEY = 'pdf-rag-state'
const UPLOAD_KEY_STORAGE = 'pdf-rag-upload-key'

function loadStoredSessionId(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw)?.sessionId ?? null) : null
  } catch {
    return null
  }
}

export default function App() {
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [sessionId, setSessionId] = useState<string | null>(loadStoredSessionId)
  const [sessionCreating, setSessionCreating] = useState(false)
  const [uploadKey, setUploadKey] = useState(() => localStorage.getItem(UPLOAD_KEY_STORAGE) ?? '')

  const { messages, sendMessage, loading, initMessages } = useChat(sessionId)

  // On mount: load documents from server and restore or create a chat session
  useEffect(() => {
    ;(async () => {
      const loadedDocs = await listDocuments()
        .then(ds => ds.map(d => ({ ...d, active: true })))
        .catch(() => [] as UploadedDoc[])
      if (loadedDocs.length) setDocs(loadedDocs)

      const storedSession = loadStoredSessionId()
      if (storedSession) {
        try {
          const session = await getSession(storedSession)
          initMessages(
            session.messages.map(m => ({
              id: crypto.randomUUID(),
              role: m.role,
              content: m.content,
            })),
          )
          return
        } catch {
          localStorage.removeItem(SESSION_KEY)
          setSessionId(null)
        }
      }

      if (loadedDocs.length > 0) {
        try {
          const res = await createSession(loadedDocs.map(d => d.document_id))
          setSessionId(res.session_id)
        } catch {}
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist sessionId whenever it changes
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ sessionId }))
    }
  }, [sessionId])

  const handleUploadKeyChange = useCallback((key: string) => {
    setUploadKey(key)
    localStorage.setItem(UPLOAD_KEY_STORAGE, key)
  }, [])

  const handleDocAdded = useCallback(
    async (doc: Omit<UploadedDoc, 'active'>) => {
      setDocs(prev => [...prev, { ...doc, active: true }])

      if (!sessionId) {
        setSessionCreating(true)
        try {
          const res = await createSession([doc.document_id])
          setSessionId(res.session_id)
        } catch {}
        finally {
          setSessionCreating(false)
        }
      }
    },
    [sessionId],
  )

  const handleReindex = useCallback(() => reindexDocuments(uploadKey), [uploadKey])

  const handleDeleteDoc = useCallback(
    async (documentId: string) => {
      await deleteDocument(documentId, uploadKey)
      setDocs(prev => prev.filter(d => d.document_id !== documentId))
    },
    [uploadKey],
  )

  const handleClearDocs = useCallback(async () => {
    await clearDocuments(uploadKey)
    setDocs([])
  }, [uploadKey])

  const handleToggleDoc = useCallback((documentId: string) => {
    setDocs(prev =>
      prev.map(d => (d.document_id === documentId ? { ...d, active: !d.active } : d)),
    )
  }, [])

  const handleSend = useCallback(
    (text: string) => {
      const activeIds = docs.filter(d => d.active).map(d => d.document_id)
      const ids = activeIds.length > 0 ? activeIds : docs.map(d => d.document_id)
      sendMessage(text, ids.length > 0 ? ids : undefined)
    },
    [sendMessage, docs],
  )

  return (
    <div className="flex h-screen bg-void overflow-hidden">
      <Sidebar
        docs={docs}
        onDocAdded={handleDocAdded}
        onToggleDoc={handleToggleDoc}
        onDeleteDoc={handleDeleteDoc}
        onClearDocs={handleClearDocs}
        uploadKey={uploadKey}
        onUploadKeyChange={handleUploadKeyChange}
        onReindex={handleReindex}
      />
      <ChatWindow
        messages={messages}
        onSend={handleSend}
        loading={loading}
        disabled={!sessionId || sessionCreating}
        sessionReady={!!sessionId}
        docCount={docs.length}
      />
    </div>
  )
}
