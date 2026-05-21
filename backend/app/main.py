from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chat, upload

app = FastAPI(title="PDF RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
