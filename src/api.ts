import {RENDER_URL} from '@env';

const BASE_URL = RENDER_URL;

export interface EmbedPayload {
  user_id: string;
  raw_transcript: string;
  metadata?: Record<string, unknown>;
}

export interface EmbedResponse {
  note_id: string;
  chunk_count: number;
  status: string;
}

export interface SourceChunk {
  chunk_id: string;
  note_id: string;
  content: string;
  rrf_score: number;
  chunk_index: number;
  user_id: string;
  created_at: string;
}

export interface QueryResponse {
  answer: string;
  sources: SourceChunk[];
  query: string;
}

export function pingHealth(): void {
  fetch(`${BASE_URL}/health`).catch(() => {});
}

export async function embedNote(payload: EmbedPayload): Promise<EmbedResponse> {
  const response = await fetch(`${BASE_URL}/api/embed`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Embed failed: ${response.status}`);
  }
  return response.json() as Promise<EmbedResponse>;
}

export async function queryNotes(
  query: string,
  userId?: string,
): Promise<QueryResponse> {
  const response = await fetch(`${BASE_URL}/api/query`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query, user_id: userId, top_k: 10}),
  });
  if (!response.ok) {
    throw new Error(`Query failed: ${response.status}`);
  }
  return response.json() as Promise<QueryResponse>;
}
