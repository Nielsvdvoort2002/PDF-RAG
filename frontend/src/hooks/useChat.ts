import { useState, useCallback } from 'react'
import { streamChat, type ChatSource } from '../api/client'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  streaming?: boolean
}

export function useChat(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (text: string, activeDocIds?: string[]) => {
      if (!sessionId || loading) return

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
      const asstId = crypto.randomUUID()
      const asstMsg: ChatMessage = { id: asstId, role: 'assistant', content: '', streaming: true }

      setMessages(prev => [...prev, userMsg, asstMsg])
      setLoading(true)
      setError(null)

      try {
        for await (const chunk of streamChat(sessionId, text, activeDocIds)) {
          if (chunk.content) {
            setMessages(prev =>
              prev.map(m => (m.id === asstId ? { ...m, content: m.content + chunk.content } : m)),
            )
          }
          if (chunk.done) {
            setMessages(prev =>
              prev.map(m =>
                m.id === asstId ? { ...m, streaming: false, sources: chunk.sources } : m,
              ),
            )
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed'
        setError(msg)
        setMessages(prev =>
          prev.map(m =>
            m.id === asstId ? { ...m, streaming: false, content: `Error: ${msg}` } : m,
          ),
        )
      } finally {
        setLoading(false)
      }
    },
    [sessionId, loading],
  )

  const clearMessages = useCallback(() => setMessages([]), [])

  const initMessages = useCallback((msgs: ChatMessage[]) => setMessages(msgs), [])

  return { messages, sendMessage, loading, error, clearMessages, initMessages }
}
