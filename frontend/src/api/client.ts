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

export interface ChatResponse {
  response: string
  sources: ChatSource[]
}

export interface ReindexResult {
  document_id: string
  chunks: number
  status: string
}

async function failure(res: Response, fallback: string): Promise<Error> {
  try {
    const json = await res.json()
    return new Error(json.detail || json.message || fallback)
  } catch {
    return new Error(fallback)
  }
}

export async function uploadPDF(file: File, uploadKey: string): Promise<UploadResponse> {
  const trimmedKey = uploadKey.trim()
  if (!trimmedKey) throw new Error('Upload key required')

  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/api/upload`, {
    method: 'POST',
    body: form,
    headers: { 'X-Upload-Key': trimmedKey },
  })
  if (!res.ok) throw await failure(res, `Upload failed (${res.status})`)
  return res.json()
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const res = await fetch(`${BASE}/api/documents`)
  if (!res.ok) throw new Error(`Failed to load documents (${res.status})`)
  return (await res.json()).documents
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

export async function sendChat(
  session_id: string,
  message: string,
  document_ids?: string[],
  onToken?: (token: string) => void,
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, message, document_ids }),
  })
  if (!res.ok) throw await failure(res, `Chat failed (${res.status})`)

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sources: ChatSource[] = []
  let response = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line)
      if (event.type === 'meta') {
        sources = event.sources
      } else if (event.type === 'delta') {
        response += event.c
        onToken?.(event.c)
      } else if (event.type === 'error') {
        throw new Error(event.message)
      }
    }
  }

  return { response, sources }
}

export async function deleteDocument(document_id: string, uploadKey: string): Promise<void> {
  const res = await fetch(`${BASE}/api/documents/${document_id}`, {
    method: 'DELETE',
    headers: { 'X-Upload-Key': uploadKey },
  })
  if (!res.ok) throw await failure(res, `Delete failed (${res.status})`)
}

export async function clearDocuments(uploadKey: string): Promise<void> {
  const res = await fetch(`${BASE}/api/documents`, {
    method: 'DELETE',
    headers: { 'X-Upload-Key': uploadKey },
  })
  if (!res.ok) throw await failure(res, `Clear failed (${res.status})`)
}

export async function reindexDocuments(uploadKey: string): Promise<{ results: ReindexResult[] }> {
  const res = await fetch(`${BASE}/api/reindex`, {
    method: 'POST',
    headers: { 'X-Upload-Key': uploadKey },
  })
  if (!res.ok) throw await failure(res, `Reindex failed (${res.status})`)
  return res.json()
}
