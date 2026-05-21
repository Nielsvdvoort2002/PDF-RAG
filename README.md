# PDF RAG

A Retrieval-Augmented Generation (RAG) chatbot that lets you upload PDF documents and ask questions about their contents. The backend extracts, chunks, and embeds PDF text into a vector database. When you send a message, the most relevant chunks are retrieved and fed to an LLM as context.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (React + Vite)                                      │
│  Sidebar (upload + doc list)   ChatWindow (SSE streaming)   │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────────┐
│ CloudFront                                                  │
│  /*       → S3 (static frontend)                            │
│  /api/*   → Lambda Function URL                             │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ AWS Lambda (Python 3.12, container image)                   │
│  POST /api/upload   POST /api/sessions   POST /api/chat     │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │ pdf_processor│  │    database     │  │  embeddings   │  │
│  │ (pdfplumber) │  │   (DynamoDB)    │  │  (FastEmbed)  │  │
│  └──────────────┘  └─────────────────┘  └───────┬───────┘  │
│  ┌──────────────┐                               │           │
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
├── .env                      # Secrets and config (never commit this)
│
├── backend/
│   ├── Dockerfile            # Lambda-compatible Python 3.12 image
│   ├── requirements.txt
│   └── app/
│       ├── main.py           # FastAPI app
│       ├── lambda_handler.py # Lambda entry point — streaming for /api/chat, Mangum for the rest
│       ├── config.py         # Pydantic settings (reads from environment variables)
│       ├── models/           # Pydantic request/response schemas
│       │   ├── chat.py
│       │   └── upload.py
│       ├── routers/          # Route handlers (thin — delegate to services)
│       │   ├── chat.py
│       │   └── upload.py
│       ├── services/         # All business logic
│       │   ├── database.py   # DynamoDB sessions & messages
│       │   ├── embeddings.py # FastEmbed (BAAI/bge-small-en-v1.5)
│       │   ├── llm.py        # Groq streaming chat
│       │   ├── pdf_processor.py  # Text extraction + chunking
│       │   ├── storage.py    # S3 upload / presigned URLs
│       │   └── vector_store.py   # Pinecone vector store
│       └── tests/
│           ├── test_chat.py
│           └── test_upload.py
│
└── frontend/
    ├── vite.config.ts        # Vite build config
    └── src/
        ├── App.tsx           # Root state, localStorage persistence
        ├── api/client.ts     # Fetch wrappers + SSE stream parser
        ├── hooks/
        │   ├── useChat.ts    # Message state + streaming logic
        │   └── useUpload.ts  # Upload state machine
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

1. **Validation** — the router rejects anything without a `.pdf` extension (HTTP 400).
2. **S3 storage** — the raw bytes are uploaded to `documents/{document_id}/{filename}`.
3. **Text extraction** — `pdf_processor.py` opens the file with `pdfplumber` and concatenates the text from every page.
4. **Chunking** — the full text is split into overlapping windows: 512 words per chunk, 50-word overlap. Each chunk carries its index so sources can be cited later.
5. **Embedding** — `embeddings.py` runs all chunk strings through the `BAAI/bge-small-en-v1.5` model (384-dimensional vectors) via FastEmbed. The model is loaded lazily on first call and reused.
6. **Vector store write** — `vector_store.py` upserts every (chunk, embedding, metadata) triple into Pinecone. Metadata stored per chunk: `document_id`, `chunk_index`, `text`.
7. **Response** — returns `document_id` (UUID), `filename`, `chunk_count`, and `s3_key`.

### 2. Session creation (`POST /api/sessions`)

A session binds a conversation to a set of documents. The frontend creates one after the first successful upload.

- The router stores `{session_id, document_ids, created_at}` in DynamoDB and returns the `session_id`.

### 3. Chat (`POST /api/chat`)

This is the core RAG loop, streamed as [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events):

1. **Session lookup** — fetches the session from DynamoDB. Returns HTTP 404 if not found.
2. **Query embedding** — the user's message is embedded with the same FastEmbed model used at upload time.
3. **Vector search** — the query embedding is compared against stored chunk embeddings, filtered to only the `document_ids` attached to this session. The top 5 chunks (`top_k=5`) are returned ranked by cosine similarity.
4. **Prompt construction** (`llm.py: build_messages`) — assembles a message list:
   - **System message**: instructs the model to answer only from the provided context, lists the retrieved chunks verbatim.
   - **History**: last 10 turns from DynamoDB (keeps context window manageable).
   - **User message**: the new query.
5. **LLM streaming** — `llm.py` calls the Groq API (`llama-3.1-8b-instant` by default) with `stream=True` and yields each token as it arrives.
6. **SSE output** — the Lambda handler yields `data: {"content": "<token>"}` for each token, then a final `data: {"done": true, "sources": [...chunks]}` frame. The Lambda Function URL is configured with `InvokeMode: RESPONSE_STREAM` so each chunk reaches the browser immediately.
7. **Persistence** — after the stream closes, both the user message and the completed assistant response are saved to DynamoDB.

### 4. Frontend streaming

`api/client.ts: streamChat` is an async generator. It reads the SSE response line-by-line, parses each `data:` payload, and yields typed `SSEChunk` objects to the caller.

`useChat.ts: sendMessage` consumes the generator:
- Appends a user message immediately.
- Creates a placeholder assistant message with `streaming: true`.
- Appends each token to the placeholder's `content` in place (React state update per token).
- On the `done` event, attaches `sources` to the assistant message and sets `streaming: false`.

### 5. Session persistence (localStorage)

`App.tsx` writes `{docs, sessionId}` to `localStorage` on every change. On mount it reads this back, then calls `GET /api/sessions/{id}` to verify the session still exists and restore message history.

---

## Deployment

### Prerequisites

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) configured (`aws configure`)
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- [Node.js](https://nodejs.org) (for the frontend build)
- A [Groq API key](https://console.groq.com)
- A [Pinecone](https://www.pinecone.io) account with a serverless index (dimension: 384, metric: cosine)

### 1. Deploy the backend and infrastructure

```bash
sam build && sam deploy --guided
```

SAM will prompt for a stack name, region, and the three required secrets. On first run it also creates an ECR repository and pushes the container image automatically. At the end it prints:

```
FrontendUrl      = https://xxxxxxxxxxxx.cloudfront.net
FrontendBucketName = pdf-rag-frontend-<account-id>
```

Save both values.

### 2. Build and upload the frontend

```bash
cd frontend
npm install
npm run build
aws s3 sync dist/ s3://<FrontendBucketName> --delete
```

Open `FrontendUrl` in the browser — the app is live.

### Re-deploying after changes

| Changed | Command |
|---|---|
| Backend code / dependencies | `sam build && sam deploy` |
| Frontend only | `npm run build && aws s3 sync dist/ s3://<FrontendBucketName> --delete` |

---

## Configuration reference

All settings are read by `config.py` from environment variables. In production these are set by the SAM template.

| Variable | Default | Description |
|---|---|---|
| `AWS_REGION` | `us-east-1` | AWS region (set automatically by Lambda) |
| `S3_BUCKET_NAME` | — | S3 bucket for uploaded PDFs (set by SAM) |
| `DYNAMODB_SESSIONS_TABLE` | `pdf-rag-sessions` | DynamoDB table for sessions |
| `DYNAMODB_MESSAGES_TABLE` | `pdf-rag-messages` | DynamoDB table for messages |
| `GROQ_API_KEY` | — | Required. Groq API key |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Any Groq-hosted model ID |
| `PINECONE_API_KEY` | — | Required. Pinecone API key |
| `PINECONE_INDEX_NAME` | `pdf-rag` | Pinecone index name |
| `EMBEDDING_MODEL` | `BAAI/bge-small-en-v1.5` | FastEmbed model name |
| `CHUNK_SIZE` | `512` | Words per chunk |
| `CHUNK_OVERLAP` | `50` | Overlapping words between adjacent chunks |
| `TOP_K` | `5` | Number of chunks retrieved per query |

---

## Running tests

Tests mock all external services (DynamoDB, Pinecone, Groq) so no live AWS credentials are needed.

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```
