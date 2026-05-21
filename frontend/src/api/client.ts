const BASE = import.meta.env.VITE_API_URL ?? ''

export interface UploadResponse {
  document_id: string
  filename: string
  chunk_count: number
  s3_key: string
}

export interface DocumentRecord {
  document_id: string
  filename: string
  chunk_count: number
}

export interface ChatSource {
  text: string
  document_id: string
  chunk_index: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface Session {
  session_id: string
  document_ids: string[]
  messages: Message[]
}

export type SSEChunk =
  | { content: string; done?: never; sources?: never }
  | { done: true; sources: ChatSource[]; content?: never }

export async function uploadPDF(file: File, uploadKey: string): Promise<UploadResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    body: form,
    headers: { 'X-Upload-Key': uploadKey },
  })
  if (!res.ok) throw new Error((await res.text()) || `Upload failed (${res.status})`)
  return res.json()
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const res = await fetch(`${BASE}/api/documents`)
  if (!res.ok) throw new Error(`Failed to load documents (${res.status})`)
  const data = await res.json()
  return data.documents
}

export async function getSession(session_id: string): Promise<Session> {
  const res = await fetch(`${BASE}/api/sessions/${session_id}`)
  if (!res.ok) throw new Error(`Session not found (${res.status})`)
  return res.json()
}

export async function createSession(document_ids: string[]): Promise<{ session_id: string }> {
  const res = await fetch(`${BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_ids }),
  })
  if (!res.ok) throw new Error(`Session creation failed (${res.status})`)
  return res.json()
}

export async function* streamChat(
  session_id: string,
  message: string,
  document_ids?: string[],
): AsyncGenerator<SSEChunk> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, message, document_ids }),
  })
  if (!res.ok) throw new Error(`Chat failed (${res.status})`)

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            yield JSON.parse(line.slice(6)) as SSEChunk
          } catch {
            // skip malformed lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
