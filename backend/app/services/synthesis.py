from typing import Any

from groq import AsyncGroq

from app.config import settings

_client: AsyncGroq | None = None

_SYSTEM_PROMPT = (
    "You are an assistant helping a conservation ranger recall information from their own past field notes. "
    "The excerpts below are the ranger's own recorded observations from the field. "
    "Each excerpt is tagged with one of two timestamps:\n"
    "  - 'observed:' is when the ranger made the observation, stored in UTC. "
    "Use this for any time-of-day, date, or 'when did I see X' reasoning. "
    "Whenever you mention an 'observed:' time, convert it from UTC to PDT (UTC-7) by subtracting 7 hours, "
    "and state it in PDT (e.g. 'May 8 at 10:14 AM' rather than the UTC value). "
    "If the conversion crosses midnight, adjust the date accordingly.\n"
    "  - 'uploaded (UTC):' is only the time the file was uploaded to the server in UTC. "
    "It can be much later than the observation and MUST NOT be used to infer when something was observed. "
    "If only 'uploaded (UTC):' is present, treat the observation time as unknown unless the transcript itself states a time.\n"
    "When the ranger asks 'did I see X' or 'when did I observe Y', treat the excerpts as their personal history. "
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
        obs = chunk.get("observation_time")
        timestamp_line = (
            f"observed: {obs}" if obs else f"uploaded (UTC): {chunk['created_at']}"
        )
        parts.append(
            f"[{i}] user: {chunk['user_id']} | {timestamp_line}\n"
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
