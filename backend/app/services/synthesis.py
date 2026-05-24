from datetime import datetime, timedelta, timezone
from typing import Any

from groq import AsyncGroq

from app.config import settings

_client: AsyncGroq | None = None
_PDT = timezone(timedelta(hours=-7))

_SYSTEM_PROMPT = (
    "You are an assistant helping a conservation ranger recall information from their own past field notes. "
    "The excerpts below are the ranger's own recorded observations from the field.\n"
    "Some excerpts carry an 'observed (PDT):' timestamp — the exact local time the ranger made the observation. "
    "Use these times as-is when answering; do not convert or adjust them.\n"
    "Excerpts without an 'observed (PDT):' tag have no machine-readable observation time. "
    "If the ranger asks when something was observed for an untagged excerpt, look for a time stated explicitly in the transcript "
    "(rangers often say e.g. 'it is currently 9:21 AM on May 18'); if no time is stated, say the observation time is unknown. "
    "Never invent a date or time.\n"
    "When the ranger asks 'did I see X' or 'when did I observe Y', treat the excerpts as their personal history. "
    "Answer concisely and cite excerpt numbers like [1] or [2, 3]."
)


def _get_groq() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.groq_api_key)
    return _client


def _utc_to_pdt(obs: str | datetime) -> str:
    if isinstance(obs, str):
        obs_dt = datetime.fromisoformat(obs.replace("Z", "+00:00"))
    else:
        obs_dt = obs if obs.tzinfo else obs.replace(tzinfo=timezone.utc)
    pdt_dt = obs_dt.astimezone(_PDT)
    month_day = pdt_dt.strftime("%-d")  # no leading zero (Linux/Render)
    hour = pdt_dt.strftime("%-I")
    minute = pdt_dt.strftime("%M")
    ampm = pdt_dt.strftime("%p")
    return pdt_dt.strftime(f"%B {month_day}, %Y at {hour}:{minute} {ampm} PDT")


def _build_context(chunks: list[dict[str, Any]]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, start=1):
        obs = chunk.get("observation_time")
        header = f"[{i}] user: {chunk['user_id']}"
        if obs:
            header += f" | observed (PDT): {_utc_to_pdt(obs)}"
        parts.append(f"{header}\n{chunk['content']}")
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
