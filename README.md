# PDF RAG

A Retrieval-Augmented Generation (RAG) chatbot that lets you upload PDF documents (if a password is supplied) and ask questions about their contents. The backend extracts, chunks, and embeds PDF text into a vector database. When you send a message, the most relevant chunks are retrieved and fed to an LLM as context.

Site is accessible from the following link:
https://d79rdqmz8tzz8.cloudfront.net/

Two PDFs are uploaded, a paper about sepsis prediction and a paper about cardiac arrest prediction.


---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (React + Vite)                                      │
│  Sidebar (upload + doc list)   ChatWindow (JSON stream)   │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────────┐
│ CloudFront                                                  │
│  /*       → S3                                              │
│  /api/*   → Lambda Function URL                             │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ AWS Lambda (Python 3.12, container image)                   │
│  POST /api/upload   POST /api/sessions   POST /api/chat     │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │ pdf_processor│  │    database     │  │  embeddings   │  │
│  │ (pdfplumber) │  │   (DynamoDB)    │  │  (Pinecone    │  │
│  └──────────────┘  └─────────────────┘  │  Inference)   │  │
│  ┌──────────────┐                       └───────┬───────┘  │
│  │   storage    │        ┌──────────────────────▼────────┐  │
│  │    (S3)      │        │  PineconeVectorStore          │  │
│  └──────────────┘        └───────────────────────────────┘  │
│                                    │ context chunks          │
│                          ┌─────────▼─────────┐              │
│                          │    llm (Groq)     │              │
│                          │ llama-3.1-8b      │              │
│                          └───────────────────┘              │
└─────────────────────────────────────────────────────────────┘
         AWS Lambda          AWS DynamoDB          AWS S3
         (backend)           (sessions +           (PDFs)
                              messages)
```

---

## Repository layout

```
PDF-RAG/
├── template.yaml             # AWS SAM infrastructure (Lambda, DynamoDB, S3, CloudFront)
├── docker-compose.yml        # Local running stack for docker (backend + DynamoDB Local)
├── .env                      # Config and secret keys
│
├── backend/
│   ├── Dockerfile            # Lambda-compatible Python image
│   ├── requirements.txt
│   └── app/
│       ├── main.py           # FastAPI app
│       ├── config.py         # Pydantic settings (reads from environment variables)
│       ├── models/           # Pydantic request/response schemas
│       │   ├── chat.py
│       │   ├── upload.py
│       │   └── reindex.py
│       ├── routers/          # Route handlers (thin — delegate to services)
│       │   ├── chat.py
│       │   └── upload.py
│       └── services/         # All business logic
│           ├── database.py   # DynamoDB sessions, messages & documents
│           ├── embeddings.py # Pinecone Inference API (llama-text-embed-v2)
│           ├── llm.py        # Groq streaming chat
│           ├── pdf_processor.py  # Text extraction + chunking
│           ├── storage.py    # S3 upload / download
│           └── vector_store.py   # Pinecone vector store
│
├── backend/tests/
│   ├── test_chat.py
│   └── test_upload.py
│
└── frontend/
    ├── vite.config.ts        # Vite build config
    └── src/
        ├── App.tsx           # Root state, localStorage persistence
        ├── api/client.ts     # Fetch wrappers + NDJSON stream parser
        ├── hooks/
        │   ├── useChat.ts    # Message state + streaming logic
        │   └── useUpload.ts  # Upload state
        └── components/
            ├── Sidebar.tsx       # Doc list + upload zone
            ├── ChatWindow.tsx    # Message feed + input bar
            ├── MessageBubble.tsx # Markdown rendering + sources
            └── PDFUpload.tsx     # Drag-and-drop file picker
```

---

## How it works

### 1. PDF upload (`POST /api/upload`)

When a user drops a PDF onto the sidebar:

1. **Validation** — the router rejects anything without a `.pdf` extension (HTTP 400). Requires `X-Upload-Key` header.
2. **S3 storage** — the raw bytes are uploaded to `documents/{document_id}/{filename}`.
3. **Text extraction** — `pdf_processor.py` opens the file with `pdfplumber` and concatenates the text from every page.
4. **Chunking** — the full text is split into overlapping windows: 512 words per chunk, 50-word overlap. Each chunk carries its index so sources can be cited later.
5. **Embedding** — `embeddings.py` calls the Pinecone Inference API (`llama-text-embed-v2`) to produce dense vectors for all chunks in one batch.
6. **Vector store write** — `vector_store.py` upserts every (chunk, embedding, metadata) triple into Pinecone. Metadata stored per chunk: `document_id`, `chunk_index`, `text`.
7. **Response** — returns `document_id` (UUID), `filename`, `chunk_count`, and `s3_key`.

### 2. Session creation (`POST /api/sessions`)

A session binds a conversation to a set of documents. The frontend creates one after the first successful upload.

- The router stores `{session_id, document_ids, created_at}` in DynamoDB and returns the `session_id`.

### 3. Chat (`POST /api/chat`)

This is the core RAG loop, streamed as newline-delimited JSON (`application/x-ndjson`):

1. **Session lookup** — fetches the session from DynamoDB. 
2. **Query embedding** — the user's message is embedded with the same model used at upload time (`input_type="query"`).
3. **Vector search** — the query embedding is compared against stored chunk embeddings, filtered to only the `document_ids` attached to this session. The top 3 chunks are returned ranked by cosine similarity.
4. **Prompt construction** (`llm.py: build_messages`) — assembles a message list:
   - **System message**: instructs the model to answer only from the provided context, lists the retrieved chunks verbatim.
   - **History**: last 10 turns from DynamoDB (keeps context window manageable).
   - **User message**: the new query.
5. **LLM streaming** — `llm.py` calls the Groq API (`llama-3.1-8b-instant` by default) with a stream, yielding each token as it arrives.
6. **NDJSON output** — the response stream emits one JSON object per line:
   - `{"type": "meta", "sources": [...chunks]}` — sent first, before any tokens
   - `{"type": "delta", "c": "<token>"}` — one per token
   - `{"type": "end"}` — signals completion (or `{"type": "error", "message": "..."}` on failure)
7. **Persistence** — the user message is saved to DynamoDB before streaming begins; the completed assistant response is saved after the stream closes.

### 4. Frontend streaming

`api/client.ts: sendChat` reads the NDJSON response line-by-line and:
- Fires `onToken(token)` for each `delta` event so the UI can append tokens in real time.
- Collects the full response and `sources` array, returning both when the stream ends.

`useChat.ts: sendMessage` consumes this:
- Appends a user message immediately.
- Creates a placeholder assistant message with empty content.
- Appends each token to the placeholder in place (one React state update per token).
- On completion, attaches `sources` to the assistant message.

### 5. Session persistence (localStorage)

`App.tsx` writes `{sessionId}` to `localStorage` on every change. On mount it reads this back, then calls `GET /api/sessions/{id}` to verify the session still exists and restore message history. If the session is gone, it clears the stored ID and creates a fresh one if documents are loaded.

---

## Local development

```bash
cp .env.example .env   # fill in API keys
docker compose up
```

This starts:
- `backend` — FastAPI on port 8000 with hot reload
- `dynamodb-local` — DynamoDB Local on port 8002

Set `DYNAMODB_ENDPOINT_URL=http://localhost:8002` in your `.env` for the backend to use the local DynamoDB instance.

Frontend dev server:

```bash
cd frontend
npm install
npm run dev   # Vite on http://localhost:5173
```

Set `VITE_API_URL=http://localhost:8000` in `frontend/.env.local` so the frontend talks to the local backend.

---

## Deployment

### Prerequisites

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) configured (`aws configure`)
- [Node.js](https://nodejs.org) (for the frontend build)
- A [Groq API key](https://console.groq.com)
- A [Pinecone](https://www.pinecone.io) account with a serverless index (dimension: 1024, metric: cosine — matching `llama-text-embed-v2`)

### 1. Deploy the backend and infrastructure

```bash
sam build && sam deploy --guided
```

SAM will prompt for a stack name, region, and the required secrets (`GroqApiKey`, `PineconeApiKey`, `PineconeIndexName`, `UploadApiKey`). On first run it also creates an ECR repository and pushes the container image automatically. At the end it prints:

```
FrontendUrl        = https://xxxxxxxxxxxx.cloudfront.net
FrontendBucketName = pdf-rag-frontend-<account-id>
```

Save both values.

### 2. Build and upload the frontend

```bash
cd frontend
npm install
VITE_API_URL='' npm run build   # BASE is empty; CloudFront routes /api/* to Lambda
aws s3 sync dist/ s3://<FrontendBucketName> --delete
```

Open `FrontendUrl` in the browser — the app is live.

### Re-deploying after changes

| Changed | Command |
|---|---|
| Backend code / dependencies | `sam build && sam deploy` |
| Frontend only | `npm run build && aws s3 sync dist/ s3://<FrontendBucketName> --delete` |

---

## Running tests

Tests mock all external services (DynamoDB, Pinecone, Groq) so no live AWS credentials are needed.

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```
