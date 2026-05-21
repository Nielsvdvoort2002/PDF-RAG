import { useRef, useEffect, useState, type KeyboardEvent } from 'react'
import type { ChatMessage } from '../hooks/useChat'
import MessageBubble from './MessageBubble'

interface ChatWindowProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  loading: boolean
  disabled: boolean
  sessionReady: boolean
  docCount: number
}

export default function ChatWindow({
  messages,
  onSend,
  loading,
  disabled,
  sessionReady,
  docCount,
}: ChatWindowProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }, [input])

  const handleSend = () => {
    const text = input.trim()
    if (!text || loading || disabled) return
    onSend(text)
    setInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = !!input.trim() && !loading && !disabled

  return (
    <main className="flex-1 flex flex-col h-full bg-void min-w-0 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-wire">
        <div>
          <h1 className="font-display font-semibold text-ink-bright text-sm leading-none">Chat</h1>
          <p className="text-[11px] font-mono text-ink-dim mt-1">
            {sessionReady
              ? `${docCount} document${docCount !== 1 ? 's' : ''} loaded`
              : 'Upload a PDF to begin'}
          </p>
        </div>
        {sessionReady && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-signal-ok">
            <span className="w-1.5 h-1.5 rounded-full bg-signal-ok" />
            Ready
          </div>
        )}
      </header>

      {/* Message feed */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
        {messages.length === 0 && (
          <EmptyState docCount={docCount} />
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 px-4 pb-4 pt-3 border-t border-wire">
        <div
          className={[
            'flex gap-2 items-end rounded-xl border px-3 py-2 transition-colors duration-150',
            disabled
              ? 'bg-cave border-wire opacity-50'
              : 'bg-cave border-wire hover:border-accent/30 focus-within:border-accent/50',
          ].join(' ')}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Upload a PDF to start chatting…' : 'Ask about your documents…'}
            disabled={disabled || loading}
            rows={1}
            className="flex-1 bg-transparent text-sm text-ink-bright placeholder:text-ink-dim resize-none outline-none font-sans leading-relaxed"
            style={{ minHeight: '24px' }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 bg-accent disabled:bg-ink-muted text-white disabled:text-ink-dim hover:enabled:bg-accent/80 active:enabled:scale-95"
          >
            {loading ? (
              <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <SendIcon />
            )}
          </button>
        </div>
        <p className="text-center text-[10px] font-mono text-ink-muted mt-2">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </main>
  )
}

function EmptyState({ docCount }: { docCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center pb-16">
      <div className="w-14 h-14 rounded-2xl bg-surface border border-wire flex items-center justify-center mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} className="w-7 h-7 text-ink-dim">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-sm font-mono text-ink-base">
        {docCount === 0 ? 'Upload a PDF to get started' : 'Ask anything about your documents'}
      </p>
      <p className="text-xs font-mono text-ink-dim mt-1.5">
        {docCount === 0 ? 'Drop files in the sidebar →' : `${docCount} document${docCount !== 1 ? 's' : ''} ready`}
      </p>
    </div>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 13V3m0 0L3 8m5-5l5 5" />
    </svg>
  )
}
