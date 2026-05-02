"""
Knowledge Base API Routes
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from backend.models.schemas import KnowledgeBase, Document
from backend.memory.knowledge import KnowledgeMemory
from backend.core.config import DATABASE_PATH

router = APIRouter()

# In-memory store
kb_db: dict[str, KnowledgeBase] = {}
docs_db: dict[str, list[Document]] = {}

# KnowledgeMemory instance for vector search
kb_memory = KnowledgeMemory(DATABASE_PATH)


class CreateKBRequest(BaseModel):
    name: str
    embedding_provider: str = "ollama"
    embedding_model: str = "nomic-embed-text"


class UpdateKBRequest(BaseModel):
    name: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


@router.get("")
async def list_knowledge_bases():
    """List all knowledge bases"""
    return {"knowledge_bases": list(kb_db.values()), "total": len(kb_db)}


@router.post("")
async def create_knowledge_base(request: CreateKBRequest):
    """Create a new knowledge base"""
    kb = KnowledgeBase(
        name=request.name,
        embedding_provider=request.embedding_provider,
        embedding_model=request.embedding_model
    )
    kb_db[kb.id] = kb
    docs_db[kb.id] = []
    await kb_memory.create_knowledge_base(
        kb_id=kb.id,
        name=request.name,
        embedding_provider=request.embedding_provider,
        embedding_model=request.embedding_model,
    )
    return {"knowledge_base": kb, "message": "Knowledge base created"}


@router.get("/{kb_id}")
async def get_knowledge_base(kb_id: str):
    """Get knowledge base details"""
    if kb_id not in kb_db:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return {"knowledge_base": kb_db[kb_id]}


@router.delete("/{kb_id}")
async def delete_knowledge_base(kb_id: str):
    """Delete a knowledge base"""
    if kb_id not in kb_db:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    del kb_db[kb_id]
    if kb_id in docs_db:
        del docs_db[kb_id]
    return {"message": "Knowledge base deleted"}


@router.post("/{kb_id}/documents")
async def upload_document(kb_id: str, file: UploadFile = File(...)):
    """Upload a document to knowledge base"""
    if kb_id not in kb_db:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    content = await file.read()
    text_content = content.decode("utf-8", errors="ignore")

    # Simple chunking: split by double newlines or by chunk size
    kb = kb_db[kb_id]
    chunk_size = kb.chunk_size
    chunk_overlap = kb.chunk_overlap

    chunks = []
    lines = text_content.split("\n")
    current_chunk = ""
    chunk_index = 0

    for line in lines:
        if len(current_chunk) + len(line) <= chunk_size:
            current_chunk += line + "\n"
        else:
            if current_chunk:
                chunks.append({
                    "content": current_chunk.strip(),
                    "filename": file.filename,
                    "filepath": f"/tmp/{file.filename}",
                    "chunk_index": chunk_index,
                    "page_number": None,
                })
                chunk_index += 1
            # Start new chunk with overlap
            overlap_chars = current_chunk[-chunk_overlap:] if chunk_overlap > 0 else ""
            current_chunk = overlap_chars + line + "\n"

    if current_chunk.strip():
        chunks.append({
            "content": current_chunk.strip(),
            "filename": file.filename,
            "filepath": f"/tmp/{file.filename}",
            "chunk_index": chunk_index,
            "page_number": None,
        })

    # Store in ChromaDB
    added = await kb_memory.add_documents(kb_id, chunks, kb.embedding_model)

    doc = Document(
        kb_id=kb_id,
        filename=file.filename,
        filepath=f"/tmp/{file.filename}",
        file_size=len(content),
        chunk_count=len(chunks)
    )

    if kb_id not in docs_db:
        docs_db[kb_id] = []
    docs_db[kb_id].append(doc)

    # Update KB stats
    kb_db[kb_id].document_count += 1
    kb_db[kb_id].total_chunks += len(chunks)

    return {"document": doc, "message": "Document uploaded", "chunks_added": added}


@router.delete("/{kb_id}/documents/{doc_id}")
async def delete_document(kb_id: str, doc_id: str):
    """Delete a document from knowledge base"""
    if kb_id not in kb_db:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    if kb_id in docs_db:
        docs_db[kb_id] = [d for d in docs_db[kb_id] if d.id != doc_id]
    return {"message": "Document deleted"}


@router.post("/{kb_id}/reindex")
async def reindex_knowledge_base(kb_id: str):
    """Trigger re-indexing of knowledge base"""
    if kb_id not in kb_db:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return {"message": "Re-indexing started", "estimated_time": "30s"}


@router.post("/{kb_id}/watch")
async def watch_directory(kb_id: str, dir_path: str):
    """Set up directory watching for auto-indexing"""
    if kb_id not in kb_db:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return {"message": f"Watching directory: {dir_path}"}


@router.get("/{kb_id}/stats")
async def get_kb_stats(kb_id: str):
    """Get knowledge base statistics"""
    kb = kb_db.get(kb_id)
    docs = docs_db.get(kb_id, [])
    if kb is None:
        kb = {
            "id": kb_id,
            "name": "Unknown",
            "document_count": 0,
            "total_chunks": 0,
        }
    return {
        "document_count": kb.document_count if isinstance(kb, object) else 0,
        "total_chunks": kb.total_chunks if isinstance(kb, object) else 0,
        "documents": [
            {
                "id": d.id,
                "filename": d.filename,
                "file_size": d.file_size,
                "chunk_count": d.chunk_count,
                "indexed_at": d.indexed_at.isoformat()
            }
            for d in docs
        ]
    }


@router.post("/{kb_id}/search")
async def search_knowledge_base(kb_id: str, request: SearchRequest):
    """Search knowledge base for relevant documents"""
    if kb_id not in kb_db:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    kb = kb_db[kb_id]
    results = await kb_memory.search(kb_id, request.query, top_k=request.top_k, embedding_model=kb.embedding_model)

    return {
        "results": [
            {
                "content": r.content,
                "source_file": r.source_file,
                "page_number": r.page_number,
                "relevance_score": r.relevance_score,
                "doc_id": r.doc_id,
            }
            for r in results
        ],
        "total": len(results)
    }