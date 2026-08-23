import { create } from 'zustand';
import { APP_VERSION, PROTOCOL_VERSION, type ClientEvent, type PrivateState, type PublicRoomState, type RuntimeConfig, type ServerEnvelope } from '@moley/shared';

type Connection = 'connected' | 'reconnecting' | 'offline';
type Session = { code: string; playerId: string; token: string };
type WithoutEnvelope<T> = T extends unknown ? Omit<T, 'v' | 'id' | 'seq'> : never;
type OutgoingEvent = WithoutEnvelope<ClientEvent>;
type GameStore = {
  room: PublicRoomState | null;
  me: PrivateState | null;
  connection: Connection;
  error: string | null;
  notification: string | null;
  runtime: RuntimeConfig | null;
  latencyMs: number | null;
  updateRequired: boolean;
  session: Session | null;
  connect(session: Session): void;
  disconnect(): void;
  send(event: OutgoingEvent): void;
  clearError(): void;
  loadRuntime(): Promise<void>;
};

let socket: WebSocket | null = null;
let clientSeq = 0;
let reconnectAttempt = 0;
let reconnectTimer: number | null = null;
let heartbeat: number | null = null;
let lastServerSeq = -1;
let intentionalClose = false;
let lastHeartbeatAt = 0;

const keyFor = (code: string) => `moley:session:${code}`;

export const useGame = create<GameStore>((set, get) => ({
  room: null, me: null, connection: navigator.onLine ? 'reconnecting' : 'offline', error: null, notification: null, session: null, runtime: null, latencyMs: null, updateRequired: false,
  connect(session) {
    intentionalClose = false;
    lastServerSeq = -1;
    set({ session, connection: navigator.onLine ? 'reconnecting' : 'offline', error: null, updateRequired: false });
    localStorage.setItem(keyFor(session.code), JSON.stringify(session));
    openSocket(session, set, get);
  },
  disconnect() {
    intentionalClose = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    if (heartbeat) window.clearInterval(heartbeat);
    socket?.close(); socket = null;
    set({ room: null, me: null, session: null, connection: 'offline' });
  },
  send(event) {
    if (!socket || socket.readyState !== WebSocket.OPEN) { set({ error: 'Digging a new tunnel back to the room…' }); return; }
    if (event.type === 'heartbeat') lastHeartbeatAt = performance.now();
    socket.send(JSON.stringify({ ...event, v: PROTOCOL_VERSION, id: crypto.randomUUID(), seq: ++clientSeq }));
  },
  clearError() { set({ error: null }); },
  async loadRuntime() {
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (!response.ok) return;
      const runtime = await response.json() as RuntimeConfig;
      set({ runtime, updateRequired: PROTOCOL_VERSION < runtime.protocolRange.min || PROTOCOL_VERSION > runtime.protocolRange.max });
    } catch { /* Offline clients keep checked-in feature defaults. */ }
  }
}));

function openSocket(session: Session, set: (value: Partial<GameStore>) => void, get: () => GameStore): void {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) { socket.onclose = null; socket.close(); }
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const query = new URLSearchParams({ token: session.token, clientVersion: APP_VERSION, protocol: String(PROTOCOL_VERSION) });
  const connection = new WebSocket(`${scheme}//${location.host}/api/rooms/${session.code}/connect?${query}`);
  socket = connection;
  connection.onopen = () => {
    if (socket !== connection) return;
    reconnectAttempt = 0; set({ connection: 'connected', error: null });
    if (heartbeat) window.clearInterval(heartbeat);
    heartbeat = window.setInterval(() => get().send({ type: 'heartbeat' }), 15_000);
  };
  connection.onmessage = (raw) => {
    if (socket !== connection) return;
    const event = JSON.parse(String(raw.data)) as ServerEnvelope;
    if (event.seq <= lastServerSeq) return;
    lastServerSeq = event.seq;
    if (event.type === 'room_snapshot' && event.public && event.private) {
      set({ room: event.public, me: event.private, notification: event.public.message ?? null, latencyMs: lastHeartbeatAt ? Math.round(performance.now() - lastHeartbeatAt) : get().latencyMs });
      lastHeartbeatAt = 0;
    }
    if (event.type === 'error') set({ error: event.message ?? 'Moley lost the tunnel for a second.' });
  };
  connection.onclose = () => {
    if (socket !== connection) return;
    if (heartbeat) window.clearInterval(heartbeat);
    if (intentionalClose) return;
    set({ connection: navigator.onLine ? 'reconnecting' : 'offline' });
    const delay = Math.min(10_000, 500 * (2 ** reconnectAttempt++)) + Math.random() * 400;
    reconnectTimer = window.setTimeout(() => openSocket(session, set, get), delay);
  };
  connection.onerror = () => connection.close();
}

window.addEventListener('online', () => {
  const store = useGame.getState();
  if (store.session) openSocket(store.session, useGame.setState, useGame.getState);
});
window.addEventListener('offline', () => useGame.setState({ connection: 'offline' }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const store = useGame.getState();
    if (store.session && socket?.readyState !== WebSocket.OPEN) openSocket(store.session, useGame.setState, useGame.getState);
  }
});

void useGame.getState().loadRuntime();

export function restoreSession(code: string): Session | null {
  try { return JSON.parse(localStorage.getItem(keyFor(code)) ?? 'null') as Session | null; } catch { return null; }
}
