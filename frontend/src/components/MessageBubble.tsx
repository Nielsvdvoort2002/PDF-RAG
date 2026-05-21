import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../hooks/useChat'

interface MessageBubbleProps {
  message: ChatMessage
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false)

  if (message.role === 'user') {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[72%] bg-accent/15 border border-accent/25 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-sm text-ink-bright leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    )
  }

  const isThinking = message.streaming && message.content === ''

  return (
    <div className="flex gap-3 animate-fade-up">
      {/* Bot avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-surface border border-wire flex items-center justify-center mt-0.5">
        <BotIcon />
      </div>

      <div className="flex-1 min-w-0">
        {/* Bubble */}
        <div className="bg-cave border border-wire rounded-2xl rounded-tl-sm px-4 py-3">
          {isThinking ? (
            <div className="flex gap-1.5 py-0.5">
              {[0, 150, 300].map(delay => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 rounded-full bg-ink-dim animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          ) : (
            <div
              className="
                prose prose-invert prose-sm max-w-none
                prose-p:text-ink-bright prose-p:leading-relaxed prose-p:my-2 first:prose-p:mt-0 last:prose-p:mb-0
                prose-headings:text-ink-bright prose-headings:font-display prose-headings:font-semibold
                prose-strong:text-ink-bright prose-strong:font-semibold
                prose-em:text-ink-base
                prose-code:text-accent prose-code:bg-surface prose-code:border prose-code:border-wire
                  prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                  prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-surface prose-pre:border prose-pre:border-wire prose-pre:rounded-lg
                prose-li:text-ink-bright prose-li:leading-relaxed
                prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                prose-blockquote:border-accent/40 prose-blockquote:text-ink-base
                prose-hr:border-wire
                prose-table:text-xs
                prose-th:text-ink-dim prose-th:font-mono prose-th:font-medium
              "
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              {message.streaming && (
                <span className="inline-block w-[2px] h-4 bg-accent animate-blink ml-0.5 align-middle rounded-full" />
              )}
            </div>
          )}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => setSourcesOpen(o => !o)}
              className="flex items-center gap-1.5 text-[11px] font-mono text-ink-dim hover:text-ink-base transition-colors"
            >
              <ChevronIcon open={sourcesOpen} />
              {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
            </button>

            {sourcesOpen && (
              <div className="mt-2 space-y-2">
                {message.sources.map((src, i) => (
                  <div key={i} className="bg-surface border border-wire rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <SmallDocIcon />
                      <span className="text-[10px] font-mono text-ink-dim">
                        …{src.document_id.slice(-8)} · chunk {src.chunk_index}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-ink-base leading-relaxed line-clamp-3">
                      {src.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BotIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5 text-accent">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 2a3 3 0 00-3 3v.5H5a2 2 0 00-2 2v7a2 2 0 002 2h10a2 2 0 002-2v-7a2 2 0 00-2-2h-2V5a3 3 0 00-3-3z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="11" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SmallDocIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3 h-3 text-accent flex-shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3a1 1 0 011-1h4.586a1 1 0 01.707.293l2.414 2.414A1 1 0 0112 5.414V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3z" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
    </svg>
  )
}
