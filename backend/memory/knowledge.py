"""
Knowledge Memory - Vector-based RAG using ChromaDB
"""
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import aiosqlite
import httpx
import chromadb
from chromadb.config import Settings as ChromaSettings
import structlog

logger = structlog.get_logger()


OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")


class RetrievalResult:
    """A result from knowledge retrieval."""

    def __init__(
        self,
        content: str,
        source_file: str,
        page_number: int | None = None,
        relevance_score: float = 0.0,
        doc_id: str = "",
    ):
        self.content = content
        self.source_file = source_file
        self.page_number = page_number
        self.relevance_score = relevance_score
        self.doc_id = doc_id

    def model_dump(self) -> dict:
        return {
            "content": self.content,
            "source_file": self.source_file,
            "page_number": self.page_number,
            "relevance_score": self.relevance_score,
            "doc_id": self.doc_id,
        }


class KnowledgeMemory:
    """
    Manages knowledge memories - RAG-based document retrieval.
    """

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.data_dir = db_path.parent / "vectordb"
        self.data_dir.mkdir(parents=True, exist_ok=True)

        # Initialize ChromaDB client
        self.chroma = chromadb.PersistentClient(
            path=str(self.data_dir),
            settings=ChromaSettings(anonymized_telemetry=False),
        )

    def _get_collection_name(self, kb_id: str) -> str:
        """Get ChromaDB collection name for a knowledge base."""
        return f"kb_{kb_id.replace('-', '_')}"

    async def create_knowledge_base(
        self,
        kb_id: str,
        name: str,
        embedding_provider: str = "ollama",
        embedding_model: str = "nomic-embed-text",
    ) -> dict:
        """Create a new knowledge base."""
        collection_name = self._get_collection_name(kb_id)

        # Create ChromaDB collection
        collection = self.chroma.get_or_create_collection(
            name=collection_name,
            metadata={"kb_id": kb_id, "name": name, "embedding_model": embedding_model},
        )

        # Store metadata in SQLite
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO knowledge_bases
                (id, name, embedding_provider, embedding_model, document_count, total_chunks, created_at, updated_at)
                VALUES (?, ?, ?, ?, 0, 0, ?, ?)
                """,
                (kb_id, name, embedding_provider, embedding_model, datetime.utcnow().isoformat(), datetime.utcnow().isoformat()),
            )
            await db.commit()

        logger.info("knowledge_base_created", kb_id=kb_id, name=name)
        return {"kb_id": kb_id, "collection": collection_name}

    async def add_documents(
        self,
        kb_id: str,
        documents: list[dict],
        embedding_model: str = "nomic-embed-text",
    ) -> int:
        """
        Add documents to a knowledge base.

        Each document should have:
        - content: str (text content)
        - filepath: str (source file path)
        - filename: str (source file name)
        - chunk_index: int (which chunk this is)
        - page_number: int | None (page number if applicable)
        """
        collection_name = self._get_collection_name(kb_id)

        try:
            collection = self.chroma.get_collection(name=collection_name)
        except ValueError:
            logger.error("collection_not_found", kb_id=kb_id)
            return 0

        doc_ids = []
        contents = []
        embeddings = []
        metadatas = []

        for doc in documents:
            doc_id = str(uuid.uuid4())
            content = doc.get("content", "")

            doc_ids.append(doc_id)
            contents.append(content)
            metadatas.append({
                "filepath": doc.get("filepath", ""),
                "filename": doc.get("filename", ""),
                "chunk_index": doc.get("chunk_index", 0),
                "page_number": doc.get("page_number") if doc.get("page_number") is not None else "",
                "kb_id": kb_id,
            })

        # Compute embeddings via Ollama API
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/embed",
                    json={"model": embedding_model, "input": contents},
                )
                if response.status_code == 200:
                    result = response.json()
                    embeddings = result.get("embeddings", [])
                    logger.info("embeddings_generated", count=len(embeddings), model=embedding_model)
                else:
                    logger.warning("embedding_api_failed", status=response.status_code)
                    embeddings = []
        except Exception as e:
            logger.warning("embedding_generation_failed", error=str(e))
            embeddings = []

        # Add to ChromaDB with embeddings
        try:
            if embeddings and len(embeddings) == len(doc_ids):
                collection.add(
                    ids=doc_ids,
                    documents=contents,
                    embeddings=embeddings,
                    metadatas=metadatas,
                )
            else:
                # Fallback: add without embeddings (ChromaDB will use its own)
                collection.add(
                    ids=doc_ids,
                    documents=contents,
                    metadatas=metadatas,
                )
        except Exception as e:
            logger.error("add_documents_failed", error=str(e))
            return 0

        # Update KB stats
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                UPDATE knowledge_bases
                SET document_count = document_count + ?,
                    total_chunks = total_chunks + ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (len(set(doc.get("filename", "") for doc in documents)), len(documents), datetime.utcnow().isoformat(), kb_id),
            )
            await db.commit()

        logger.info("documents_added", kb_id=kb_id, count=len(doc_ids))
        return len(doc_ids)

    async def search(
        self,
        kb_id: str,
        query: str,
        top_k: int = 5,
        embedding_model: str = "nomic-embed-text",
    ) -> list[RetrievalResult]:
        """Search knowledge base for relevant documents."""
        collection_name = self._get_collection_name(kb_id)

        try:
            collection = self.chroma.get_collection(name=collection_name)
        except ValueError:
            logger.error("collection_not_found", kb_id=kb_id)
            return []

        # Generate query embedding via Ollama
        query_embedding = None
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/embed",
                    json={"model": embedding_model, "input": query},
                )
                if response.status_code == 200:
                    result = response.json()
                    query_embedding = result.get("embeddings", [[]])[0]
                    logger.info("query_embedding_generated", model=embedding_model)
        except Exception as e:
            logger.warning("query_embedding_failed", error=str(e))

        # Query ChromaDB
        try:
            if query_embedding:
                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=top_k,
                    include=["documents", "metadatas", "distances"],
                )
            else:
                results = collection.query(
                    query_texts=[query],
                    n_results=top_k,
                    include=["documents", "metadatas", "distances"],
                )
        except Exception as e:
            logger.error("knowledge_search_failed", kb_id=kb_id, error=str(e))
            return []

        retrieval_results = []
        if results and results.get("documents"):
            for i, doc_content in enumerate(results["documents"][0]):
                metadata = results["metadatas"][0][i] if results.get("metadatas") else {}
                distance = results["distances"][0][i] if results.get("distances") else 0.0

                # Convert distance to relevance score (ChromaDB uses L2 distance)
                relevance = 1.0 / (1.0 + distance)

                retrieval_results.append(RetrievalResult(
                    content=doc_content,
                    source_file=metadata.get("filename", ""),
                    page_number=metadata.get("page_number"),
                    relevance_score=relevance,
                    doc_id=results["ids"][0][i] if results.get("ids") else "",
                ))

        return retrieval_results

    async def delete_document(self, kb_id: str, doc_id: str) -> bool:
        """Delete a document from knowledge base."""
        collection_name = self._get_collection_name(kb_id)

        try:
            collection = self.chroma.get_collection(name=collection_name)
            collection.delete(ids=[doc_id])

            logger.info("document_deleted", kb_id=kb_id, doc_id=doc_id)
            return True
        except Exception as e:
            logger.error("delete_document_failed", error=str(e))
            return False

    async def reindex(self, kb_id: str) -> int:
        """Re-index all documents in a knowledge base."""
        logger.info("reindex_started", kb_id=kb_id)
        # In production, would re-process all source documents
        return 0

    async def clear_agent_memories(self, agent_id: str) -> int:
        """Clear memories associated with a specific agent."""
        # In a full implementation, would track which agent added which memories
        return 0

    async def get_stats(self, kb_id: str) -> dict:
        """Get statistics for a knowledge base."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row

            cursor = await db.execute(
                "SELECT * FROM knowledge_bases WHERE id = ?",
                (kb_id,),
            )
            row = await cursor.fetchone()

            if not row:
                return {}

            return {
                "kb_id": row["id"],
                "name": row["name"],
                "document_count": row["document_count"],
                "total_chunks": row["total_chunks"],
                "created_at": row["created_at"],
            }
