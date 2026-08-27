import type { LocalGameState } from '@moley/game-core';
import { validateLocalState } from '@moley/game-core';
import { words } from '@moley/word-packs';

const DATABASE = 'moley-local';
const STORE = 'sessions';
const ACTIVE_KEY = 'active';
const FALLBACK_KEY = 'moley:local:recovery';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local storage is unavailable.'));
  });
}

async function idbRequest<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = operation(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'));
    transaction.oncomplete = () => database.close();
  });
}

function encodeFallback(value: LocalGameState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeFallback(value: string): unknown {
  const binary = atob(value);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))) as unknown;
}

export async function saveLocalGame(state: LocalGameState): Promise<void> {
  localStorage.setItem(FALLBACK_KEY, encodeFallback(state));
  try {
    await idbRequest('readwrite', (store) => store.put(state, ACTIVE_KEY));
  } catch { /* The encoded write-ahead copy remains available. */ }
}

export type LocalRecovery = { status: 'none' } | { status: 'corrupt'; raw: unknown } | { status: 'valid'; state: LocalGameState };

export async function loadLocalGame(): Promise<LocalRecovery> {
  let idbValue: unknown;
  try { idbValue = await idbRequest('readonly', (store) => store.get(ACTIVE_KEY)); } catch { idbValue = null; }
  const fallback = localStorage.getItem(FALLBACK_KEY);
  let fallbackValue: unknown = null;
  if (fallback) try { fallbackValue = decodeFallback(fallback); } catch { if (!idbValue) return { status: 'corrupt', raw: fallback }; }
  const idbUpdated = idbValue && typeof idbValue === 'object' ? Number((idbValue as { updatedAt?: unknown }).updatedAt ?? 0) : 0;
  const fallbackUpdated = fallbackValue && typeof fallbackValue === 'object' ? Number((fallbackValue as { updatedAt?: unknown }).updatedAt ?? 0) : 0;
  const raw = fallbackUpdated >= idbUpdated ? fallbackValue : idbValue;
  if (!raw) return { status: 'none' };
  if (!validateLocalState(raw, words)) return { status: 'corrupt', raw };
  return { status: 'valid', state: raw };
}

export async function clearLocalGame(): Promise<void> {
  try { await idbRequest('readwrite', (store) => store.delete(ACTIVE_KEY)); } catch { /* fallback below */ }
  localStorage.removeItem(FALLBACK_KEY);
}

export function recoverLocalNames(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return [];
  const players = (raw as { players?: unknown }).players;
  if (!Array.isArray(players)) return [];
  return players.map((player) => player && typeof player === 'object' && typeof (player as { name?: unknown }).name === 'string' ? (player as { name: string }).name : '').filter(Boolean).slice(0, 20);
}
