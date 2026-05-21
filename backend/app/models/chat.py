from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    document_ids: list[str]


class CreateSessionResponse(BaseModel):
    session_id: str


class ChatMessage(BaseModel):
    role: str
    content: str


class SessionResponse(BaseModel):
    session_id: str
    document_ids: list[str]
    messages: list[ChatMessage]


class ChatRequest(BaseModel):
    session_id: str
    message: str
    document_ids: list[str] | None = None  # override session-level document filter
