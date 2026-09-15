import os
import re
import json
import uuid
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Dict, Any, Optional

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

DATA_DIR = Path(__file__).parent / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
DOCS_FILE = DATA_DIR / "documents.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx"}


def _load_docs_db() -> List[Dict[str, Any]]:
    if not DOCS_FILE.exists():
        return []
    try:
        with open(DOCS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save_docs_db(docs: List[Dict[str, Any]]) -> None:
    with open(DOCS_FILE, "w", encoding="utf-8") as f:
        json.dump(docs, f, indent=2, ensure_ascii=False)


def sanitize_text(text: str) -> str:
    """Strip dangerous characters and excessive whitespace."""
    if not text:
        return ""
    # Remove null and non-printable control chars except \n, \t, \r
    sanitized = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", text)
    # Normalize multiple newlines
    sanitized = re.sub(r"\n{3,}", "\n\n", sanitized)
    return sanitized.strip()


def extract_text_from_pdf(filepath: Path) -> str:
    if not PdfReader:
        raise RuntimeError("pypdf library not available")
    reader = PdfReader(str(filepath))
    text_pieces = []
    for page_num, page in enumerate(reader.pages):
        try:
            page_text = page.extract_text()
            if page_text:
                text_pieces.append(page_text)
        except Exception:
            continue
    return "\n\n".join(text_pieces)


def extract_text_from_docx(filepath: Path) -> str:
    """Extracts text from DOCX using standard zipfile and xml parsing."""
    try:
        with zipfile.ZipFile(filepath, "r") as z:
            xml_content = z.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            # Find all w:t tags
            namespaces = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = []
            for p in tree.iterfind(".//w:p", namespaces):
                texts = [node.text for node in p.iterfind(".//w:t", namespaces) if node.text]
                if texts:
                    paragraphs.append("".join(texts))
            return "\n\n".join(paragraphs)
    except Exception as e:
        raise RuntimeError(f"Failed to parse DOCX file: {str(e)}")


def extract_text_from_txt(filepath: Path) -> str:
    for encoding in ["utf-8", "utf-8-sig", "latin-1", "cp1252"]:
        try:
            with open(filepath, "r", encoding=encoding, errors="replace") as f:
                return f.read()
        except Exception:
            continue
    return ""


def chunk_text(text: str, chunk_size_words: int = 250, overlap_words: int = 40) -> List[str]:
    """Splits text into readable semantic chunks with overlap."""
    clean = sanitize_text(text)
    if not clean:
        return []
    
    # Split into paragraphs first
    paragraphs = [p.strip() for p in clean.split("\n\n") if p.strip()]
    words = []
    for p in paragraphs:
        words.extend(p.split())
    
    if not words:
        return []
    
    chunks = []
    step = max(chunk_size_words - overlap_words, 50)
    for i in range(0, len(words), step):
        chunk_slice = words[i:i + chunk_size_words]
        if chunk_slice:
            chunks.append(" ".join(chunk_slice))
            if i + chunk_size_words >= len(words):
                break
    return chunks


def process_uploaded_document(filename: str, file_bytes: bytes) -> Dict[str, Any]:
    """Validates, extracts, sanitizes, and indexes an uploaded file."""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {ext}. Allowed: PDF, TXT, DOCX")
    
    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError(f"File size exceeds limit of {MAX_FILE_SIZE // (1024*1024)} MB")
    
    doc_id = str(uuid.uuid4())[:8]
    safe_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", filename)
    saved_filename = f"{doc_id}_{safe_name}"
    saved_path = UPLOAD_DIR / saved_filename
    
    with open(saved_path, "wb") as f:
        f.write(file_bytes)
    
    raw_text = ""
    if ext == ".pdf":
        raw_text = extract_text_from_pdf(saved_path)
    elif ext == ".docx":
        raw_text = extract_text_from_docx(saved_path)
    elif ext == ".txt":
        raw_text = extract_text_from_txt(saved_path)
    
    sanitized = sanitize_text(raw_text)
    if not sanitized:
        raise ValueError("The uploaded document appears to be empty or contains no extractable text.")
    
    chunks = chunk_text(sanitized)
    
    doc_record = {
        "id": doc_id,
        "filename": filename,
        "saved_path": str(saved_path),
        "file_size": len(file_bytes),
        "extension": ext,
        "chunk_count": len(chunks),
        "preview": sanitized[:300] + ("..." if len(sanitized) > 300 else ""),
        "chunks": chunks,
        "created_at": str(uuid.uuid1())
    }
    
    docs = _load_docs_db()
    docs.append(doc_record)
    _save_docs_db(docs)
    
    return {
        "id": doc_id,
        "filename": filename,
        "file_size": len(file_bytes),
        "extension": ext,
        "chunk_count": len(chunks),
        "preview": doc_record["preview"],
        "status": "Indexed"
    }


def list_documents() -> List[Dict[str, Any]]:
    docs = _load_docs_db()
    return [{
        "id": d["id"],
        "filename": d["filename"],
        "file_size": d.get("file_size", 0),
        "extension": d.get("extension", ""),
        "chunk_count": d.get("chunk_count", 0),
        "preview": d.get("preview", ""),
        "status": "Ready"
    } for d in docs]


def delete_document(doc_id: str) -> bool:
    docs = _load_docs_db()
    found = False
    new_docs = []
    for d in docs:
        if d["id"] == doc_id:
            found = True
            saved_path = Path(d.get("saved_path", ""))
            if saved_path.exists():
                try:
                    os.remove(saved_path)
                except Exception:
                    pass
        else:
            new_docs.append(d)
    if found:
        _save_docs_db(new_docs)
    return found


def retrieve_relevant_chunks(query: str, top_k: int = 3) -> List[str]:
    """Simple term-frequency relevance retrieval across all indexed document chunks."""
    docs = _load_docs_db()
    if not docs:
        return []
    
    # Tokenize query
    stop_words = {"the", "is", "at", "which", "on", "a", "an", "and", "or", "in", "to", "for", "with", "of", "by"}
    q_words = set(re.findall(r"\w+", query.lower())) - stop_words
    if not q_words:
        # Fallback return first available chunks
        return [docs[0]["chunks"][0]] if docs and docs[0].get("chunks") else []
    
    scored_chunks = []
    for doc in docs:
        for chunk in doc.get("chunks", []):
            chunk_words = set(re.findall(r"\w+", chunk.lower()))
            overlap = len(q_words.intersection(chunk_words))
            if overlap > 0:
                scored_chunks.append((overlap, chunk))
    
    # Sort by overlap descending
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    return [c[1] for c in scored_chunks[:top_k]]
