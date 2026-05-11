import AsyncStorage from '@react-native-async-storage/async-storage';
import {embedNote} from './api';

const PENDING_NOTES_KEY = 'pending_notes';

interface PendingNote {
  id: string;
  user_id: string;
  raw_transcript: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function enqueueNote(note: {
  user_id: string;
  raw_transcript: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const raw = await AsyncStorage.getItem(PENDING_NOTES_KEY);
  const queue: PendingNote[] = raw ? JSON.parse(raw) : [];
  queue.push({
    id: generateId(),
    user_id: note.user_id,
    raw_transcript: note.raw_transcript,
    metadata: note.metadata ?? {},
    created_at: new Date().toISOString(),
  });
  await AsyncStorage.setItem(PENDING_NOTES_KEY, JSON.stringify(queue));
}

// Concurrent flushes (e.g. NetInfo "connected" firing twice during wifi reconnect
// while a post-transcribe flush is also running) would both read the same queue
// and POST the same notes, creating duplicates. Coalesce overlapping callers
// onto a single in-flight flush.
let flushInProgress: Promise<{sent: number; failed: number}> | null = null;

export function flushQueue(): Promise<{sent: number; failed: number}> {
  if (flushInProgress) {
    return flushInProgress;
  }
  flushInProgress = doFlush().finally(() => {
    flushInProgress = null;
  });
  return flushInProgress;
}

async function doFlush(): Promise<{sent: number; failed: number}> {
  const raw = await AsyncStorage.getItem(PENDING_NOTES_KEY);
  if (!raw) {
    return {sent: 0, failed: 0};
  }

  const queue: PendingNote[] = JSON.parse(raw);
  if (queue.length === 0) {
    return {sent: 0, failed: 0};
  }

  const remaining: PendingNote[] = [];
  let sent = 0;
  let failed = 0;

  for (const note of queue) {
    try {
      await embedNote({
        user_id: note.user_id,
        raw_transcript: note.raw_transcript,
        metadata: note.metadata,
      });
      sent++;
    } catch {
      remaining.push(note);
      failed++;
    }
  }

  await AsyncStorage.setItem(PENDING_NOTES_KEY, JSON.stringify(remaining));
  return {sent, failed};
}

export async function getPendingCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(PENDING_NOTES_KEY);
  if (!raw) {
    return 0;
  }
  const queue: PendingNote[] = JSON.parse(raw);
  return queue.length;
}
