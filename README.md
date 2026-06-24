# PDF RAG

A Retrieval-Augmented Generation (RAG) chatbot that lets you upload PDF documents (if a password is supplied) and ask questions about their contents. The backend extracts, chunks, and embeds PDF text into a vector database. When you send a message, the most relevant chunks are retrieved and fed to an LLM as context.

The app is hosted on AWS and accessible through the following link:
https://d79rdqmz8tzz8.cloudfront.net/

Two PDFs are uploaded, a paper about sepsis prediction and a paper about cardiac arrest prediction.

---

## How it works

### PDF upload (`POST /api/upload`)

To upload a PDF, an upload key is required. The file is then stored, and the text is processed using pdfplumber. The full text is split into overlapping windows: 512 words per chunk, 50-word overlap. The indexes of chunks are stored so that the LLM can cite them. Pinecone is used to construct embeddings using llama-text-embed-v2. The result of this is stored using Pinecone vector storage.

### Chat (`POST /api/chat`)

The core functionality of the RAG uses sessions stored in DynamoDB. The user's message is embedded and compared against the stored chunk embeddings. The top 3 chunks are returned ranked by cosine similarity. The LLM that is connected to is instructed to only use the provided context and to reference which chunk is used. 

After calling the Groq API, the result is read as a stream, processing each token as it arrives.


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
