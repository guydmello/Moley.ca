import { toLocalPublicDisplay, validateLocalPublicDisplay, type LocalGameState, type LocalPublicDisplayState } from '@moley/game-core';
import type { WordEntry } from '@moley/word-packs';

const PREFIX = 'moley:local:public-display:';
const channelName = (sessionId: string) => `moley-local-display-${sessionId}`;
const storageKey = (sessionId: string) => `${PREFIX}${sessionId}`;

export function publishLocalDisplay(state: LocalGameState, catalog: WordEntry[]): void {
  const snapshot = toLocalPublicDisplay(state, catalog);
  try { localStorage.setItem(storageKey(state.sessionId), JSON.stringify(snapshot)); } catch { /* Broadcast still works when storage is full. */ }
  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(channelName(state.sessionId));
    channel.postMessage(snapshot);
    channel.close();
  }
}

export function readLocalDisplay(sessionId: string): LocalPublicDisplayState | null {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(sessionId)) ?? 'null') as unknown;
    return validLocalDisplay(raw, sessionId) ? raw : null;
  } catch { return null; }
}

export function subscribeLocalDisplay(sessionId: string, receive: (snapshot: LocalPublicDisplayState) => void): () => void {
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(channelName(sessionId)) : null;
  if (channel) channel.onmessage = (event) => { if (validLocalDisplay(event.data, sessionId)) receive(event.data); };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey(sessionId) || !event.newValue) return;
    try { const value = JSON.parse(event.newValue) as unknown; if (validLocalDisplay(value, sessionId)) receive(value); } catch { /* Ignore damaged public snapshots. */ }
  };
  addEventListener('storage', onStorage);
  return () => { channel?.close(); removeEventListener('storage', onStorage); };
}

export function clearLocalDisplay(sessionId: string): void {
  localStorage.removeItem(storageKey(sessionId));
}

function validLocalDisplay(value: unknown, sessionId: string): value is LocalPublicDisplayState {
  return validateLocalPublicDisplay(value, sessionId);
}
