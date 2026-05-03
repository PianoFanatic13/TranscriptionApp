import tiktoken

from app.config import settings

_enc = tiktoken.get_encoding("cl100k_base")


def chunk_text(text: str) -> list[str]:
    """
    Split text into overlapping token-window chunks.
    Returns the original text as a single chunk if it fits within chunk_size.
    """
    tokens = _enc.encode(text)
    chunk_size = settings.chunk_size
    overlap = settings.chunk_overlap

    if len(tokens) <= chunk_size:
        return [text]

    chunks: list[str] = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunks.append(_enc.decode(tokens[start:end]))
        if end == len(tokens):
            break
        start += chunk_size - overlap

    return chunks
