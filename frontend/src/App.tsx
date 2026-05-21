import { useState, useCallback, useEffect } from 'react'
import { createSession, getSession, listDocuments } from './api/client'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import { useChat } from './hooks/useChat'
import type { UploadedDoc } from './hooks/useUpload'

const STORAGE_KEY = 'pdf-rag-state'
const UPLOAD_KEY_STORAGE = 'pdf-rag-upload-key'

function loadStoredSessionId(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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

  // On mount: load documents from server and restore chat history from stored session
  useEffect(() => {
    listDocuments()
      .then(serverDocs => {
        setDocs(serverDocs.map(d => ({ ...d, active: true })))
      })
      .catch(() => {})

    const storedSession = loadStoredSessionId()
    if (!storedSession) return
    getSession(storedSession)
      .then(session => {
        initMessages(
          session.messages.map(m => ({
            id: crypto.randomUUID(),
            role: m.role,
            content: m.content,
          })),
        )
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY)
        setSessionId(null)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist sessionId whenever it changes
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId }))
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
        } catch {
          // session creation failed — user will see the disabled input
        } finally {
          setSessionCreating(false)
        }
      }
    },
    [sessionId],
  )

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
        uploadKey={uploadKey}
        onUploadKeyChange={handleUploadKeyChange}
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
