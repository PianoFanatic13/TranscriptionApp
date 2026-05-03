from typing import Any

from groq import AsyncGroq

from app.config import settings

_client: AsyncGroq | None = None

_SYSTEM_PROMPT = (
    "You are an assistant helping a conservation ranger recall information from their own past field notes. "
    "The excerpts below are the ranger's own recorded observations from the field. "
    "When the ranger asks 'did I see X' or 'when did I observe Y', treat the excerpts as their personal history — "
    "if an excerpt describes X, the answer is yes and the date is in the 'recorded:' timestamp. "
    "Answer concisely and cite excerpt numbers like [1] or [2, 3]."
)


def _get_groq() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.groq_api_key)
    return _client


def _build_context(chunks: list[dict[str, Any]]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, start=1):
        parts.append(
            f"[{i}] user: {chunk['user_id']} | recorded: {chunk['created_at']}\n"
            f"{chunk['content']}"
        )
    return "\n\n".join(parts)


async def synthesise(query: str, chunks: list[dict[str, Any]]) -> str:
    """Send query + retrieved chunks to Groq (Llama 3.1 8B) and return the answer."""
    if not chunks:
        return "No relevant field notes found for your query."

    context = _build_context(chunks)
    user_message = f"Field note excerpts:\n\n{context}\n\nQuestion: {query}"

    response = await _get_groq().chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.2,
        max_tokens=1024,
    )
    return response.choices[0].message.content
