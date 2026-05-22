import { useState, useCallback } from 'react'
import { sendChat, type ChatSource } from '../api/client'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
}

export function useChat(sessionId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  const sendMessage = useCallback(
    async (text: string, activeDocIds?: string[]) => {
      if (!sessionId || loading) return

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
      const asstId = crypto.randomUUID()

      setMessages(prev => [...prev, userMsg, { id: asstId, role: 'assistant', content: '' }])
      setLoading(true)

      try {
        const { response, sources } = await sendChat(sessionId, text, activeDocIds, token => {
          setMessages(prev =>
            prev.map(m => (m.id === asstId ? { ...m, content: m.content + token } : m)),
          )
        })
        setMessages(prev =>
          prev.map(m => (m.id === asstId ? { ...m, content: response || m.content, sources } : m)),
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed'
        setMessages(prev =>
          prev.map(m => (m.id === asstId ? { ...m, content: `Error: ${msg}` } : m)),
        )
      } finally {
        setLoading(false)
      }
    },
    [sessionId, loading],
  )

  const initMessages = useCallback((msgs: ChatMessage[]) => setMessages(msgs), [])

  return { messages, sendMessage, loading, initMessages }
}
