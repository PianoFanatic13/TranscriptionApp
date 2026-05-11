import AsyncStorage from '@react-native-async-storage/async-storage';

const ALL_NOTES_KEY = 'all_notes';

export interface LocalNote {
  id: string;
  createdAt: number;
  transcript: string;
  durationMs: number;
  audioPath: string;
}

export async function saveLocalNote(
  note: Omit<LocalNote, 'id'>,
): Promise<LocalNote> {
  const raw = await AsyncStorage.getItem(ALL_NOTES_KEY);
  const notes: LocalNote[] = raw ? JSON.parse(raw) : [];
  const saved: LocalNote = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...note,
  };
  notes.push(saved);
  await AsyncStorage.setItem(ALL_NOTES_KEY, JSON.stringify(notes));
  return saved;
}

export async function getAllNotes(): Promise<LocalNote[]> {
  const raw = await AsyncStorage.getItem(ALL_NOTES_KEY);
  if (!raw) {
    return [];
  }
  return (JSON.parse(raw) as LocalNote[]).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

export async function deleteLocalNote(id: string): Promise<void> {
  const raw = await AsyncStorage.getItem(ALL_NOTES_KEY);
  if (!raw) {
    return;
  }
  const notes: LocalNote[] = JSON.parse(raw);
  await AsyncStorage.setItem(
    ALL_NOTES_KEY,
    JSON.stringify(notes.filter(n => n.id !== id)),
  );
}
