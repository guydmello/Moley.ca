import { Suspense, lazy, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight, Bot, Check, ChevronRight, Clock3, Copy,
  Crown, Eye, Globe2, Lock, MessageCircle, Monitor, Moon, Pause,
  Play, Plus, QrCode, RefreshCw, Send, Settings2, Share2, ShieldCheck, Smartphone,
  Sparkles, Sun, Trophy, UserRound, Users, Volume2, VolumeX, WifiOff, X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { words } from '@moley/word-packs';
import { APP_VERSION, featureEnabled, formatRoomCode, normalizeRoomCode, settingsForPreset, type DrawingPayload, type GameSettings, type PublicPlayer } from '@moley/shared';
import { restoreSession, useGame } from './store';
import { UtilityMenu } from './UtilityMenu';
import { useDialogFocus } from './dialog';
import { decodePackWords } from './pack-codec';

const FeatureSettingsDialog = lazy(() => import('./FeatureSettingsDialog').then((module) => ({ default: module.FeatureSettingsDialog })));
const DrawingPad = lazy(() => import('./DrawingPad').then((module) => ({ default: module.DrawingPad })));
const DrawingReveal = lazy(() => import('./DrawingPad').then((module) => ({ default: module.DrawingReveal })));
function LazyDrawingReveal({ drawing }: { drawing: DrawingPayload }) { return <Suspense fallback={<div className="drawing-loading">Loading drawing…</div>}><DrawingReveal drawing={drawing} /></Suspense>; }

type Route = { page: 'home' | 'how' | 'join' | 'play' | 'display' | 'pass'; code?: string };

function routeFromPath(): Route {
  const [, first, second] = location.pathname.split('/');
  if (first === 'how-to-play') return { page: 'how' };
  if (first === 'join') return { page: 'join', code: normalizeRoomCode(second ?? '') };
  if (first === 'play') return { page: 'play', code: normalizeRoomCode(second ?? '') };
  if (first === 'display') return { page: 'display', code: normalizeRoomCode(second ?? '') };
  if (first === 'pass-the-phone') return { page: 'pass' };
  return { page: 'home' };
}

export function App() {
  const [route, setRoute] = useState(routeFromPath);
  useEffect(() => { const month = new Date().getMonth(); document.documentElement.dataset.season = month === 9 ? 'spooky' : month === 11 ? 'winter' : month === 6 ? 'canada' : 'standard'; document.documentElement.dataset.easter = location.hash === '#tunnel-vision' ? 'true' : ''; }, []);
  useEffect(() => {
    const pop = () => setRoute(routeFromPath());
    addEventListener('popstate', pop); return () => removeEventListener('popstate', pop);
  }, []);
  const go = (path: string) => { history.pushState({}, '', path); setRoute(routeFromPath()); window.scrollTo({ top: 0 }); };
  if (route.page === 'how') return <HowTo go={go} />;
  if (route.page === 'join') return <JoinPage code={route.code ?? ''} go={go} />;
  if (route.page === 'play') return <GamePage code={route.code ?? ''} go={go} />;
  if (route.page === 'display') return <DisplayPage code={route.code ?? ''} go={go} />;
  if (route.page === 'pass') return <PassThePhone go={go} />;
  return <Home go={go} />;
}

function Brand({ go, light = false }: { go: (path: string) => void; light?: boolean }) {
  return <button className={`brand ${light ? 'brand-light' : ''}`} onClick={() => go('/')} aria-label="Moley home">
    <span className="brand-mark"><Eye size={18} strokeWidth={3} /></span><span>MOLEY</span><span className="brand-dot">.CA</span>
  </button>;
}

function Home({ go }: { go: (path: string) => void }) {
  const [panel, setPanel] = useState<'create' | 'join' | null>(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('moley:theme') ?? 'system');
  const [tutorial, setTutorial] = useState(() => !localStorage.getItem('moley:tutorial'));
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('moley:theme', theme); }, [theme]);
  return <div className="site-shell">
    <nav className="site-nav wrap">
      <Brand go={go} />
      <div className="nav-links">
        <button className="text-button" onClick={() => go('/how-to-play')}>How to play</button>
        <button className="icon-button" aria-label="Change theme" onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}>
          {theme === 'dark' ? <Moon size={19} /> : <Sun size={19} />}
        </button>
      </div>
    </nav>

    <main>
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> THE SOCIAL DEDUCTION GAME</div>
          <h1>Find the Mole.<br /><em>Protect the Word.</em></h1>
          <p className="hero-lede">One secret word. One suspicious friend. Give clever clues, catch the bluff, and don’t hand the Mole the answer.</p>
          <div className="hero-actions">
            <button className="button button-primary button-xl" onClick={() => setPanel('create')}><Play size={20} fill="currentColor" /> Create game</button>
            <button className="button button-light button-xl" onClick={() => setPanel('join')}><ArrowRight size={20} /> Join game</button>
          </div>
          <button className="pass-link" onClick={() => go('/pass-the-phone')}><Smartphone size={18} /> One phone or want to practise? <strong>Pass it around offline</strong> <ChevronRight size={16} /></button>
          <div className="trust-row"><span><Check size={15} /> No accounts</span><span><Check size={15} /> Free to play</span><span><Check size={15} /> Works anywhere</span></div>
        </div>
        <div className="hero-art" aria-label="Moley secret agent mascot peeking from an underground tunnel">
          <div className="secret-stamp"><ShieldCheck size={17} /> TOP SECRET</div>
          <img src="/moley-mascot.png" alt="Moley, a clever mole wearing tiny spy glasses" />
          <div className="clue-card clue-one"><span>YOUR CLUE</span><strong>ORCHARD</strong></div>
          <div className="clue-card clue-two"><span>SUSPICION</span><strong>87%</strong></div>
          <div className="dirt-layer" />
        </div>
      </section>

      <section className="ticker" aria-label="Game features"><div>NO DOWNLOADS <span>✦</span> SECRET ROLES <span>✦</span> SMART BOTS <span>✦</span> 4–100 PLAYERS <span>✦</span> PHONES + TV <span>✦</span> NO ACCOUNTS</div></section>

      <section className="how-section wrap" id="how">
        <div className="section-kicker">HOW IT WORKS</div><h2>Suspicion in three simple steps.</h2>
        <div className="steps-grid">
          <Step number="01" icon={<Eye />} title="See your role" text="Everyone sees the secret word—except the Mole. Keep your screen private." accent="lime" />
          <Step number="02" icon={<MessageCircle />} title="Give a clue" text="Prove you know the word without making it obvious enough for the Mole." accent="orange" />
          <Step number="03" icon={<UserRound />} title="Vote in secret" text="Discuss the clues, lock in your suspect, and reveal who was bluffing." accent="blue" />
        </div>
      </section>

      <section className="feature-section">
        <div className="wrap feature-grid">
          <div className="feature-copy"><div className="section-kicker light">ONE GAME. ANY ROOM.</div><h2>From the cottage<br />to the group chat.</h2><p>Play aloud around a table, type clues from across the world, put the scoreboard on a TV, or pass one phone around. Moley adapts without getting in the way.</p><button className="button button-lime" onClick={() => setPanel('create')}>Start a room <ArrowRight size={18} /></button></div>
          <div className="mode-stack">
            <Mode icon={<Users />} title="Around the table" text="Everyone joins on their own phone." tag="CLASSIC" />
            <Mode icon={<Globe2 />} title="Friends anywhere" text="Typed clues and live discussion." tag="ONLINE" />
            <Mode icon={<Monitor />} title="Big-screen mode" text="Public action on the TV. Secrets stay private." tag="DISPLAY" />
            <Mode icon={<Bot />} title="Smart bots" text="Fill empty seats—no paid AI required." tag="ANY SIZE" />
          </div>
        </div>
      </section>

      <section className="score-section wrap">
        <div><div className="section-kicker">SCORING</div><h2>Catch them.<br />Or watch them dig away.</h2><p>First to 5 points wins by default. Every round finishes before the winner is crowned.</p><button className="text-link" onClick={() => go('/how-to-play')}>Read the full rules <ArrowRight size={17} /></button></div>
        <div className="score-cards"><ScoreCard result="MOLE ESCAPES" mole="+2" team="0" tone="dark" /><ScoreCard result="CAUGHT + GUESSES WORD" mole="+1" team="0" tone="orange" /><ScoreCard result="CAUGHT + WRONG GUESS" mole="0" team="+2 each" tone="lime" /></div>
      </section>

      <section className="privacy-strip wrap"><ShieldCheck size={32} /><div><strong>Secrets stay secret.</strong><span>Private roles, votes, and scores are decided by the game server—not your browser.</span></div><div className="privacy-pills"><span>No email</span><span>No tracking profile</span><span>Rooms expire</span></div></section>

      <section className="faq wrap"><div className="section-kicker">QUESTIONS, ANSWERED</div><h2>Before you start digging.</h2><div className="faq-list">
        <details><summary>How many people do we need?<Plus /></summary><p>Four seats is ideal, and any mix of humans and bots works. Large rooms are welcome; Moley recommends rapid typed clues when the roster grows.</p></details>
        <details><summary>Can we play remotely?<Plus /></summary><p>Yes. Use typed clues and the built-in discussion chat, or keep Moley open beside any voice or video call.</p></details>
        <details><summary>Do players need an account?<Plus /></summary><p>No. Pick a room-only display name and join with the three-word code, link, or QR.</p></details>
        <details><summary>Are the bots actually useful?<Plus /></summary><p>Yes. Bots reason from the category and revealed clues, vote with believable uncertainty, and never receive secret information they should not know.</p></details>
      </div></section>
    </main>

    <footer><div className="wrap footer-inner"><Brand go={go} light /><p>Built for suspicious friends everywhere. <small>v{APP_VERSION}</small></p><div><button onClick={() => go('/how-to-play')}>How to play</button><a href="mailto:hello@moley.ca">Contact</a></div></div></footer>
    <AnimatePresence>{panel && <CreateJoinDialog mode={panel} onClose={() => setPanel(null)} go={go} />}</AnimatePresence>
    <AnimatePresence>{tutorial && <Tutorial onClose={() => { localStorage.setItem('moley:tutorial', 'done'); setTutorial(false); }} />}</AnimatePresence>
    <UtilityMenu onTutorial={() => setTutorial(true)} />
  </div>;
}

function Step({ number, icon, title, text, accent }: { number: string; icon: ReactNode; title: string; text: string; accent: string }) {
  return <article className={`step-card ${accent}`}><div className="step-top"><span>{number}</span><div>{icon}</div></div><h3>{title}</h3><p>{text}</p></article>;
}
function Mode({ icon, title, text, tag }: { icon: ReactNode; title: string; text: string; tag: string }) { return <article className="mode-card"><div className="mode-icon">{icon}</div><div><h3>{title}</h3><p>{text}</p></div><span>{tag}</span></article>; }
function ScoreCard({ result, mole, team, tone }: { result: string; mole: string; team: string; tone: string }) { return <article className={`score-card ${tone}`}><span>{result}</span><div><label>MOLE</label><strong>{mole}</strong></div><div><label>INNOCENTS</label><strong>{team}</strong></div></article>; }

function Tutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const pages = [
    { icon: <Eye />, label: 'ONE SECRET', title: 'Everyone except the Mole sees the word.', demo: <div className="tutorial-secret"><span>YOUR SECRET WORD</span><strong>APPLE</strong></div> },
    { icon: <MessageCircle />, label: 'ONE CLUE', title: 'Give a clue without making it too obvious.', demo: <div className="tutorial-secret lime"><span>A GOOD CLUE</span><strong>ORCHARD</strong></div> },
    { icon: <UserRound />, label: 'ONE SUSPECT', title: 'The Mole fakes it. Talk, then vote in secret.', demo: <div className="suspect-demo"><span>Alex</span><span className="selected">Sam ✓</span><span>Maya</span></div> }
  ];
  const page = pages[step]!;
  return <motion.div className="dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="tutorial-card" initial={{ y: 30, scale: .97 }} animate={{ y: 0, scale: 1 }}>
    <button className="dialog-close" onClick={onClose} aria-label="Skip tutorial"><X /></button>
    <div className="tutorial-icon">{page.icon}</div><span className="section-kicker">{page.label}</span><h2>{page.title}</h2>{page.demo}
    <div className="tutorial-dots">{pages.map((_, index) => <span className={index === step ? 'active' : ''} key={index} />)}</div>
    <button className="button button-primary button-wide" onClick={() => step === pages.length - 1 ? onClose() : setStep(step + 1)}>{step === pages.length - 1 ? 'Let’s play' : 'Next'} <ArrowRight size={18} /></button>
  </motion.div></motion.div>;
}

function CreateJoinDialog({ mode, onClose, go }: { mode: 'create' | 'join'; onClose: () => void; go: (path: string) => void }) {
  const [name, setName] = useState(() => localStorage.getItem('moley:name') ?? '');
  const [code, setCode] = useState(''); const [preset, setPreset] = useState<GameSettings['preset']>('classic');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const connect = useGame((state) => state.connect);
  const linkedPack = sharedPackFromUrl();
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const creating = mode === 'create';
      const normalized = normalizeRoomCode(code);
      const response = await fetch(creating ? '/api/rooms' : `/api/rooms/${normalized}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, settings: creating ? { ...presetSettings(preset), ...(linkedPack.length ? { preset: 'custom', customWords: linkedPack } : {}) } : undefined }) });
      const data = await response.json() as { error?: string; code?: string; playerId?: string; sessionToken?: string };
      if (!response.ok || !data.code || !data.playerId || !data.sessionToken) throw new Error(data.error ?? 'Moley could not open that room.');
      localStorage.setItem('moley:name', name.trim()); connect({ code: data.code, playerId: data.playerId, token: data.sessionToken }); onClose(); go(`/play/${data.code}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Try that again.'); } finally { setBusy(false); }
  };
  return <motion.div className="dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><motion.div className="game-dialog" initial={{ y: 35, scale: .98 }} animate={{ y: 0, scale: 1 }}>
    <button className="dialog-close" onClick={onClose} aria-label="Close"><X /></button><div className="dialog-icon">{mode === 'create' ? <Sparkles /> : <ArrowRight />}</div>
    <span className="section-kicker">{mode === 'create' ? 'NEW TUNNEL' : 'FIND YOUR FRIENDS'}</span><h2>{mode === 'create' ? 'Create a game' : 'Join a game'}</h2>
    <form onSubmit={submit}>
      <label className="field"><span>Your display name</span><input autoFocus value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="e.g. Guy" required /></label>
      {mode === 'join' && <label className="field"><span>Three-word room code</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PEACH FROG STAR" autoCapitalize="characters" required /></label>}
      {mode === 'create' && <fieldset className="preset-choices"><legend>Choose a vibe</legend>{(['classic', 'online', 'party', 'quick', 'big-group', 'family', 'chaos', 'sweaty'] as const).map((value) => <button type="button" className={preset === value ? 'active' : ''} onClick={() => setPreset(value)} key={value}><strong>{value === 'big-group' ? 'Big Group' : cap(value)}</strong><span>{value === 'classic' ? 'Spoken · relaxed' : value === 'online' ? 'Typed · chat' : value === 'quick' ? 'Short · snappy' : value === 'family' ? 'Easy · friendly' : value === 'chaos' ? 'Wild · surprising' : value === 'sweaty' ? 'Hard · strategic' : value === 'party' ? 'Social · lively' : 'Large · streamlined'}</span></button>)}</fieldset>}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="button button-primary button-wide" disabled={busy}>{busy ? <RefreshCw className="spin" /> : mode === 'create' ? <Play fill="currentColor" /> : <ArrowRight />}{busy ? 'Digging…' : mode === 'create' ? 'Create my room' : 'Join room'}</button>
    </form><p className="dialog-fine"><Lock size={14} /> Private and unlisted. No account required.</p>
  </motion.div></motion.div>;
}

function presetSettings(preset: GameSettings['preset']): Partial<GameSettings> {
  return settingsForPreset(preset);
}

function JoinPage({ code, go }: { code: string; go: (path: string) => void }) {
  const [name, setName] = useState(() => localStorage.getItem('moley:name') ?? ''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const connect = useGame((state) => state.connect);
  const join = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { const response = await fetch(`/api/rooms/${code}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); const data = await response.json() as any; if (!response.ok) throw new Error(data.error); localStorage.setItem('moley:name', name); connect({ code: data.code, playerId: data.playerId, token: data.sessionToken }); go(`/play/${data.code}`); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not join.'); } finally { setBusy(false); } };
  return <CenteredPage go={go}><div className="standalone-card"><div className="dialog-icon"><ArrowRight /></div><span className="section-kicker">YOU’RE INVITED</span><h1>Join the tunnel</h1><div className="room-code-display">{formatCode(code)}</div><form onSubmit={join}><label className="field"><span>Your display name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoFocus required placeholder="e.g. Guy" /></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary button-wide" disabled={busy}>{busy ? 'Joining…' : 'Join game'} <ArrowRight /></button></form></div></CenteredPage>;
}

function CenteredPage({ children, go }: { children: ReactNode; go: (path: string) => void }) { return <div className="centered-page"><nav className="site-nav wrap"><Brand go={go} /></nav><main>{children}</main></div>; }

function GamePage({ code, go }: { code: string; go: (path: string) => void }) {
  const connect = useGame((state) => state.connect); const session = useGame((state) => state.session); const room = useGame((state) => state.room); const updateRequired = useGame((state) => state.updateRequired);
  useEffect(() => { if (!session || session.code !== code) { const saved = restoreSession(code); if (saved) connect(saved); } }, [code, connect, session]);
  if ((!session || session.code !== code) && !restoreSession(code)) return <JoinPage code={code} go={go} />;
  if (updateRequired) return <CenteredPage go={go}><div className="standalone-card"><RefreshCw /><span className="section-kicker">UPDATE READY</span><h1>Refresh to rejoin</h1><p>Your private seat token is saved on this device.</p><button className="button button-primary" onClick={() => location.reload()}>Refresh Moley</button></div></CenteredPage>;
  if (!room) return <LoadingRoom go={go} />;
  return <Suspense fallback={<LoadingRoom go={go} />}><GameShell go={go} /></Suspense>;
}

function LoadingRoom({ go }: { go: (path: string) => void }) { return <CenteredPage go={go}><div className="loading-mole"><div className="mole-loader"><Eye /></div><h1>Digging a tunnel back to the room…</h1><p>Your seat and score are safe.</p></div></CenteredPage>; }

function GameShell({ go, display = false }: { go: (path: string) => void; display?: boolean }) {
  const { room, me, connection, error, notification, clearError, disconnect, latencyMs } = useGame();
  const [settingsOpen, setSettingsOpen] = useState(false); const [shareOpen, setShareOpen] = useState(false); const [roleVisible, setRoleVisible] = useState(false); const [muted, setMuted] = useState(() => localStorage.getItem('moley:muted') === 'true');
  const previousStage = useRef(room?.stage); const reduce = useReducedMotion();
  useEffect(() => { if (previousStage.current !== room?.stage) { setRoleVisible(false); if (!muted) tone(room?.stage === 'ROUND_REVEAL' ? 'win' : 'tick'); if (navigator.vibrate && room?.settings.haptics) navigator.vibrate(room?.stage === 'ROLE_REVEAL' ? [25, 40, 25] : 18); previousStage.current = room?.stage; } }, [room?.stage, room?.settings.haptics, muted]);
  useEffect(() => { let lock: WakeLockSentinel | null = null; if (room && !['ROOM_LOBBY', 'MATCH_COMPLETE'].includes(room.stage) && 'wakeLock' in navigator) void navigator.wakeLock.request('screen').then((value) => { lock = value; }).catch(() => undefined); return () => { void lock?.release(); }; }, [room]);
  if (!room || !me) return null;
  const current = room.players.find((player) => player.id === room.turnOrder[room.currentTurn]);
  const isHost = me.canHost && !display;
  return <div className={`game-app theme-${room.settings.roomTheme} ${display ? 'display-mode' : ''}`}>
    {connection !== 'connected' && <div className={`connection-banner ${connection}`}><WifiOff size={16} />{connection === 'offline' ? 'Offline — your seat is safe' : 'Digging a new tunnel back to the room…'}</div>}
    <div className="mascot-mood" role="img" aria-label={`Moley reacts to ${room.stage.toLocaleLowerCase().replaceAll('_', ' ')}`}>{room.stage === 'VOTING' || room.stage === 'REVOTE' ? '🤨' : room.stage === 'MOLE_GUESS' ? '😱' : ['ROUND_REVEAL','ROUND_RECAP','MATCH_COMPLETE'].includes(room.stage) ? '🎉' : room.stage === 'DEFENCE' ? '🫣' : '🕵️'}</div>
    <header className="game-header"><Brand go={go} light /><div className="game-header-center"><span>ROOM · {connection === 'connected' ? latencyMs === null ? 'LIVE' : latencyMs < 180 ? 'GOOD' : latencyMs < 450 ? 'FAIR' : 'SLOW' : 'RECONNECTING'}</span><button onClick={() => setShareOpen(true)}>{formatCode(room.code)} <Copy size={14} /></button></div><div className="header-actions">{!display && <button className="icon-button dark" onClick={() => { setMuted(!muted); localStorage.setItem('moley:muted', String(!muted)); }} aria-label="Mute game">{muted ? <VolumeX /> : <Volume2 />}</button>}{isHost && <button className="icon-button dark" onClick={() => setSettingsOpen(true)} aria-label="Game settings"><Settings2 /></button>}{!display && <button className="icon-button dark desktop-hide" onClick={() => setShareOpen(true)} aria-label="Share"><Share2 /></button>}</div></header>
    {notification && <div className="room-notice" role="status">{notification}</div>}
    {room.stage === 'ROOM_LOBBY' && room.settings.crowdPack && !display && <CrowdSubmit />}
    {room.stage !== 'ROOM_LOBBY' && room.turnOrder.length > 0 && !['MATCH_COMPLETE', 'ROUND_REVEAL', 'ROUND_RECAP', 'SCOREBOARD'].includes(room.stage) && <TurnRail room={room} current={current} />}
    <main className="game-main"><AnimatePresence mode="wait"><motion.div key={room.stage} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -10 }} transition={{ duration: .22 }}>
      {room.stage === 'ROOM_LOBBY' && <Lobby display={display} onShare={() => setShareOpen(true)} onSettings={() => setSettingsOpen(true)} />}
      {room.stage === 'ROLE_REVEAL' && (display ? <PublicWaiting title="Roles are being checked" text={`${room.readyCount} / ${room.eligibleReadyCount} ready`} icon={<Eye />} /> : <RoleReveal visible={roleVisible} setVisible={setRoleVisible} />)}
      {['ROUND_SETUP', 'CLUE_PREPARATION'].includes(room.stage) && <PublicWaiting title="Shuffling the clues…" text="Moley is setting the tunnel." icon={<RefreshCw className="spin" />} />}
      {room.stage === 'CLUE_TURN' && <ClueTurn display={display} current={current} />}
      {room.stage === 'DISCUSSION' && <Discussion display={display} />}
      {['VOTING', 'REVOTE'].includes(room.stage) && (display ? <PublicWaiting title={room.stage === 'REVOTE' ? 'Revote in secret' : 'Vote in secret'} text={`${room.voteCount} / ${room.eligibleVoteCount} votes locked`} icon={<Lock />} /> : <Voting />)}
      {['VOTE_REVEAL', 'TIE_RESOLUTION', 'ACCUSATION'].includes(room.stage) && <Accusation />}
      {room.stage === 'DEFENCE' && <Defence />}
      {room.stage === 'MOLE_GUESS' && (me.mustGuess && room.settings.guessMode === 'typed' && !display ? <MoleGuess /> : me.canHost && room.settings.guessMode === 'spoken' && me.judgeMoleIds.length ? <SpokenGuessJudge /> : <PublicWaiting title="One last chance…" text="A caught Mole is guessing the secret word." icon={<Eye />} />)}
      {room.stage === 'ROUND_REVEAL' && <RoundReveal />}
      {room.stage === 'ROUND_RECAP' && <RoundRecap />}
      {room.stage === 'SCOREBOARD' && <Scoreboard />}
      {room.stage === 'MATCH_COMPLETE' && <MatchComplete />}
    </motion.div></AnimatePresence></main>
    {isHost && !['ROOM_LOBBY', 'ROLE_REVEAL', 'ROUND_REVEAL', 'ROUND_RECAP', 'SCOREBOARD', 'MATCH_COMPLETE'].includes(room.stage) && <HostDock />}
    {error && <div className="toast" role="alert"><span>{error}</span><button onClick={clearError}><X /></button></div>}
    <AnimatePresence>{settingsOpen && <Suspense fallback={null}><FeatureSettingsDialog onClose={() => setSettingsOpen(false)} /></Suspense>}{shareOpen && <ShareDialog onClose={() => setShareOpen(false)} />}</AnimatePresence>
    {!display && <button className="leave-link" onClick={() => { disconnect(); go('/'); }}>Leave room</button>}
    {!display && <UtilityMenu onTutorial={() => go('/how-to-play')} />}
  </div>;
}

function Lobby({ display, onShare, onSettings }: { display: boolean; onShare: () => void; onSettings: () => void }) {
  const { room, me, send } = useGame(); if (!room || !me) return null; const seats = room.players.filter((player) => player.kind !== 'spectator'); const humans = seats.filter((player) => player.kind === 'human'); const bots = seats.filter((player) => player.kind === 'bot'); const large = seats.length >= 20;
  return <div className="lobby-layout"><section className="lobby-primary"><span className="game-kicker">THE TUNNEL IS OPEN · {room.settings.preset.toUpperCase()}</span><h1>{display ? 'Scan to join' : 'Waiting for suspicious people…'}</h1><p>{display ? 'Open your camera and point it here.' : 'Share the code. No account, no download, straight into the game.'}</p>{room.settings.showIcebreakers && <div className="icebreaker"><Sparkles /><span>LOBBY ICEBREAKER</span><strong>What harmless thing are you irrationally suspicious of?</strong></div>}<div className="room-share-card"><QRCodeSVG value={`${location.origin}/join/${room.code}`} size={display ? 240 : 142} bgColor="transparent" fgColor="currentColor" level="M" /><div><span>ROOM CODE</span><strong>{formatCode(room.code)}</strong><button className="button button-dark" onClick={onShare}><Share2 /> Share room</button></div></div><p className="config-summary">{room.settings.clueMode} clues · {room.settings.moleCount ?? 'Auto'} Mole{room.settings.moleCount === 1 ? '' : 's'} · {room.settings.targetScore ? `First to ${room.settings.targetScore}` : 'Endless'}{room.settings.chaosMode ? ' · Chaos on' : ''}</p>{large && <div className="large-warning"><Clock3 /> Spoken turns can take a while with {seats.length} players. Try Big Group mode.</div>}</section>
    <aside className="roster-card"><div className="roster-head"><div><span>PLAYERS</span><strong>{seats.length}</strong></div>{me.canHost && !display && <button className="icon-button" onClick={onSettings}><Settings2 /></button>}</div><div className={`roster-list ${large ? 'dense' : ''}`}>{seats.map((player) => <PlayerRow player={player} key={player.id} />)}</div>{!display && me.canHost && <div className="bot-controls"><button className="button button-light" onClick={() => send({ type: 'host_add_bot' })}><Bot /> Add bot</button>{seats.length < 4 && <button className="button button-lime" onClick={() => send({ type: 'host_quick_fill', targetSeats: 4 })}><Sparkles /> Fill to 4</button>}</div>}<div className="roster-summary"><span><UserRound /> {humans.length} human{humans.length !== 1 ? 's' : ''}</span><span><Bot /> {bots.length} bot{bots.length !== 1 ? 's' : ''}</span></div>{!display && me.canHost && <button className="button button-primary button-wide button-xl" onClick={() => send({ type: 'host_start' })} disabled={seats.length < 4}><Play fill="currentColor" /> {seats.length < 4 ? `Add ${4 - seats.length} more to start` : 'Start game'}</button>}{!display && !me.canHost && <div className="waiting-host"><span className="live-dot" /> Waiting for the host to start</div>}</aside></div>;
}

function CrowdSubmit() { const { room, send } = useGame(); const [word, setWord] = useState(''); if (!room) return null; return <form className="crowd-submit" onSubmit={(event) => { event.preventDefault(); if (word.trim()) { send({ type: 'submit_crowd_word', word }); setWord(''); } }}><span>CROWD PACK · {room.crowdWordCount} READY</span><input value={word} onChange={(event) => setWord(event.target.value)} maxLength={80} placeholder="Secretly add one word…" /><button disabled={!word.trim()}><Send /></button></form>; }

function PlayerRow({ player }: { player: PublicPlayer }) { const { me, send, room } = useGame(); const initials = player.name.split(' ').map((part) => part[0]).join('').slice(0, 2); const rename = () => { const name = prompt('Rename this bot', player.name); if (name?.trim()) send({ type: 'host_rename_bot', playerId: player.id, name }); }; return <div className={`player-row ${!player.connected ? 'disconnected' : ''}`}><span className={`avatar avatar-${hash(player.name) % 5}`}>{player.kind === 'bot' ? <Bot /> : initials}<small className="player-symbol">{player.symbol}</small></span><div><strong>{player.name}{player.id === me?.playerId ? ' (you)' : ''}</strong><span>{player.kind === 'bot' ? `BOT · ${cap(player.personality ?? 'creative')}` : player.autopilot ? 'Bot autopilot' : !player.connected ? 'Disconnected' : player.host ? 'Host' : 'Ready to dig'}</span></div>{player.host && <Crown className="crown" />}{me?.canHost && player.kind === 'bot' && room?.stage === 'ROOM_LOBBY' && <div className="row-actions"><button aria-label={`Rename ${player.name}`} onClick={rename}><Settings2 /></button><button aria-label={`Remove ${player.name}`} onClick={() => confirm(`Remove ${player.name} from this room?`) && send({ type: 'host_remove_bot', playerId: player.id })}><X /></button></div>}</div>; }

function RoleReveal({ visible, setVisible }: { visible: boolean; setVisible: (value: boolean) => void }) { const { me, room, send } = useGame(); if (!me || !room) return null; const fellow = room.players.filter((player) => me.fellowMoleIds.includes(player.id)).map((player) => player.name); return <div className="role-screen"><span className="game-kicker">ROUND {room.roundNumber} · PRIVATE</span><h1>{visible ? me.role === 'mole' ? 'You are the Mole.' : 'Protect this word.' : 'Your secret is ready.'}</h1><p>{visible ? me.role === 'mole' ? 'Listen carefully. Blend in. Work out the word.' : 'Give a clue that proves you know it—without giving it away.' : 'Make sure nobody is looking over your shoulder.'}</p><button className={`role-card ${visible ? `revealed ${me.role}` : ''}`} onClick={() => setVisible(true)} aria-pressed={visible}>{visible ? me.role === 'mole' ? <><img src="/moley-mascot.png" alt="Moley mascot" /><span>YOU ARE THE</span><strong>MOLE</strong>{fellow.length > 0 && <small>Fellow Moles: {fellow.join(', ')}</small>}</> : <><span>YOUR SECRET WORD</span><strong>{me.secretWord}</strong><small>Category · {room.category}</small></> : <><Eye /><span>HOLD TO REVEAL</span><small>Keep your role private</small></>}</button>{visible && !room.players.find((player) => player.id === me.playerId)?.ready && <button className="button button-primary button-xl" onClick={() => send({ type: 'player_ready', ready: true })}><Check /> I’ve seen my role</button>}<div className="ready-progress"><span style={{ width: `${(room.readyCount / Math.max(1, room.eligibleReadyCount)) * 100}%` }} /><label>{room.readyCount} / {room.eligibleReadyCount} ready</label></div>{me.canHost && room.readyCount < room.eligibleReadyCount && <button className="text-link" onClick={() => send({ type: 'host_advance' })}>Continue anyway</button>}</div>; }

function TurnRail({ room, current }: { room: NonNullable<ReturnType<typeof useGame.getState>['room']>; current?: PublicPlayer }) { const ids = room.turnOrder; const around = [-1, 0, 1, 2].map((offset) => room.players.find((player) => player.id === ids[room.currentTurn + offset])).filter(Boolean) as PublicPlayer[]; return <div className="turn-rail"><div className="turn-label"><span>CLUE ORDER</span><strong>{room.currentTurn + 1}<small>/{ids.length}</small></strong></div>{around.map((player) => <div key={player.id} className={`turn-person ${player.id === current?.id ? 'current' : ''}`}><span className={`avatar avatar-${hash(player.name) % 5}`}>{player.kind === 'bot' ? <Bot /> : player.name[0]}</span><div><small>{player.id === current?.id ? 'NOW' : 'NEXT'}</small><strong>{player.name}</strong></div></div>)}</div>; }

function ClueTurn({ current, display }: { current?: PublicPlayer; display: boolean }) {
  const { room, me, send } = useGame(); const [clue, setClue] = useState('');
  if (!room || !me || !current) return null;
  const mine = current.id === me.playerId; const locked = Boolean(me.submittedClue);
  const reveal = current.clueDrawing ? <LazyDrawingReveal drawing={current.clueDrawing} /> : current.clue ? <div className="revealed-clue">“{current.clue}”</div> : null;
  return <div className="phase-screen"><span className="game-kicker">CLUE {room.currentTurn + 1} OF {room.turnOrder.length}{room.settings.anonymousClues ? ' · ANONYMOUS' : ''}</span>{room.chaosModifier && <div className="chaos-banner"><Sparkles /> {room.chaosModifier}</div>}{me.role === 'innocent' && me.forbiddenClueWords.length > 0 && <div className="forbidden-clues" role="note"><Lock /><span><strong>Forbidden clues</strong>{me.forbiddenClueWords.join(' · ')}</span></div>}<div className={`big-avatar avatar-${hash(current.name) % 5}`}>{current.kind === 'bot' ? <Bot /> : current.name[0]}</div><h1>{mine ? 'Your turn.' : `${current.name}’s turn.`}</h1>
    {room.settings.clueMode === 'spoken' ? <><p>{current.kind === 'bot' && current.clue ? 'Moley’s clue is:' : mine ? 'Say one clever clue aloud.' : 'Listen closely. Every word matters.'}</p>{reveal}{mine && !display && <button className="button button-primary button-xl" onClick={() => send({ type: 'finish_spoken_clue' })}>Done <ArrowRight /></button>}</> : room.settings.clueMode === 'drawing' && mine && !display ? <><DrawingPad locked={locked} />{locked && <button className="button button-primary" onClick={() => send({ type: 'finish_spoken_clue' })}>Reveal & finish turn <ArrowRight /></button>}</> : mine && !display ? <div className="clue-entry"><label>{room.settings.clueMode === 'emoji' ? 'Your emoji clue' : 'Your private clue'}</label><div><input value={locked ? me.submittedClue ?? '' : clue} disabled={locked} maxLength={room.settings.clueMaxLength} placeholder={room.settings.clueMode === 'emoji' ? '🌲🏕️' : 'Short and subtle…'} onChange={(event) => setClue(event.target.value)} /><button disabled={locked || !clue.trim()} onClick={() => send({ type: 'submit_clue', clue })}>{locked ? <Check /> : <Send />}</button></div><small>{locked ? 'Clue locked. It appears only on your turn.' : `${clue.length} / ${room.settings.clueMaxLength}`}</small>{locked && <button className="button button-primary" onClick={() => send({ type: 'finish_spoken_clue' })}>Reveal & finish turn <ArrowRight /></button>}</div> : <><p>{current.clue || current.clueDrawing ? `${room.settings.anonymousClues ? 'A player' : current.name} submitted:` : `${current.name} is choosing a clue…`}</p>{reveal}</>}
  </div>;
}

function Discussion({ display }: { display: boolean }) {
  const { room, me, send } = useGame(); const [message, setMessage] = useState('');
  if (!room || !me) return null;
  const clues = room.turnOrder.map((id) => room.players.find((player) => player.id === id)).filter(Boolean) as PublicPlayer[];
  return <><div className="discussion-layout"><section><span className="game-kicker">DISCUSSION</span><h1>Who’s digging a hole?</h1><p>Question broad clues. Defend your own. Don’t say the secret word.</p><Timer />{room.settings.privateNotebook && !display && <Notebook />}{room.settings.spectatorPredictions && me.role === 'spectator' && <PredictionPanel />}</section><section className="clue-board">{room.settings.anonymousClues ? room.anonymousClues.map((item, index) => <div key={item.id}><span className="avatar">{index + 1}</span><strong>Anonymous clue {index + 1}</strong>{item.drawing ? <DrawingReveal drawing={item.drawing} /> : <p>{item.clue ?? 'Spoken aloud'}</p>}</div>) : clues.map((player) => <div key={player.id}><span className={`avatar avatar-${hash(player.name) % 5}`}>{player.kind === 'bot' ? <Bot /> : player.name[0]}</span><strong>{player.name}</strong>{player.clueDrawing ? <DrawingReveal drawing={player.clueDrawing} /> : <p>{player.clueStatus === 'skipped' ? 'Skipped' : player.clue ?? 'Spoken aloud'}</p>}</div>)}</section>{room.settings.discussionChat && featureEnabled(room.featureFlags, 'chat') && <aside className="chat-panel"><div className="chat-title"><MessageCircle /> Tunnel chat</div><div className="chat-messages">{room.chat.length ? room.chat.map((item) => <div key={item.id}><strong>{item.playerName}</strong><p>{item.text}</p></div>) : <p className="empty-chat">No accusations yet. Suspicious.</p>}</div>{!display && <form onSubmit={(event) => { event.preventDefault(); if (message.trim()) { send({ type: 'send_chat', text: message }); setMessage(''); } }}><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={280} placeholder="Say something…" aria-label="Chat message" /><button aria-label="Send"><Send /></button></form>}</aside>}</div>{(room.settings.secretReactions || (room.settings.audienceReactions && me.role === 'spectator')) && !display && <ReactionBar />}</>;
}

function Notebook() { const { me, send } = useGame(); const [note, setNote] = useState(me?.note ?? ''); return <label className="notebook"><span>PRIVATE NOTEBOOK</span><textarea value={note} maxLength={800} onChange={(event) => setNote(event.target.value)} onBlur={() => send({ type: 'update_note', note })} placeholder="Suspicions only you can see…" /><small>{note.length}/800 · saves privately</small></label>; }
function ReactionBar() { const send = useGame((state) => state.send); return <div className="reaction-bar" aria-label="Secret reactions">{(['👍','🤔','😂','😮','🔥','🕳️'] as const).map((emoji) => <button key={emoji} onClick={() => send({ type: 'send_reaction', emoji })}>{emoji}</button>)}</div>; }
function PredictionPanel() { const { room, me, send } = useGame(); if (!room || !me) return null; return <div className="prediction-panel"><strong>AUDIENCE PREDICTION</strong><span>Hidden until the round ends.</span><select value={me.prediction ?? ''} onChange={(event) => event.target.value && send({ type: 'submit_prediction', playerId: event.target.value })}><option value="">Pick the Mole…</option>{room.players.filter((player) => player.kind !== 'spectator').map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div>; }

function Voting() { const { room, me, send } = useGame(); const [selected, setSelected] = useState<string | null>(null); const [confidence, setConfidence] = useState<1|2|3>(2); if (!room || !me) return null; if (me.submittedVote) return <PublicWaiting title="Vote locked." text={`${room.voteCount} / ${room.eligibleVoteCount} votes are in. Nobody can see your choice yet.`} icon={<Lock />} />; return <div className="vote-screen"><span className="game-kicker">{room.stage === 'REVOTE' ? 'SECRET REVOTE' : 'SECRET VOTE'}</span><h1>Who is the Mole?</h1><p>Choose carefully. You cannot vote for yourself.</p><div className="vote-grid">{room.players.filter((player) => player.kind !== 'spectator' && player.id !== me.playerId).map((player) => <button className={selected === player.id ? 'selected' : ''} onClick={() => setSelected(player.id)} key={player.id}><span className={`avatar avatar-${hash(player.name) % 5}`}>{player.kind === 'bot' ? <Bot /> : player.name[0]}</span><strong>{player.name}</strong><small>{player.symbol}</small>{selected === player.id && <Check />}</button>)}</div>{room.settings.confidenceVoting && <fieldset className="confidence"><legend>How confident are you?</legend>{([1,2,3] as const).map((level) => <button key={level} className={confidence === level ? 'active' : ''} onClick={() => setConfidence(level)}>{level === 1 ? 'Unsure' : level === 2 ? 'Confident' : 'Certain'}</button>)}</fieldset>}<button className="button button-primary button-xl" disabled={!selected} onClick={() => selected && send({ type: 'submit_vote', playerId: selected, confidence })}><Lock /> Lock vote</button><span className="vote-progress">{room.voteCount} / {room.eligibleVoteCount} submitted</span><Timer /></div>; }

function Accusation() { const { room } = useGame(); if (!room) return null; const accused = room.players.filter((player) => room.accusedIds.includes(player.id)); return <div className="phase-screen accusation"><span className="game-kicker">THE VOTES ARE IN · {room.settings.voteReveal.replaceAll('-', ' ').toUpperCase()}</span><h1>{room.message ?? 'The group has spoken.'}</h1>{room.voteRevealItems.length > 0 && <div className="vote-reveal-list">{room.voteRevealItems.map((vote, index) => { const voter = room.players.find((player) => player.id === vote.voterId); const target = room.players.find((player) => player.id === vote.targetId); return <span key={index}>{voter?.name ?? 'A voter'} → <strong>{target?.name}</strong>{room.settings.confidenceVoting ? ` · ${['','unsure','confident','certain'][vote.confidence]}` : ''}</span>; })}</div>}<div className="accused-cards">{accused.map((player) => <div key={player.id}><span className={`big-avatar avatar-${hash(player.name) % 5}`}>{player.name[0]}</span><strong>{player.name}</strong><small>ACCUSED</small></div>)}</div><p>Now for the truth…</p></div>; }

function Defence() { const { room } = useGame(); if (!room) return null; const accused = room.players.filter((player) => room.accusedIds.includes(player.id)); return <div className="phase-screen defence-screen"><ShieldCheck size={48} /><span className="game-kicker">DEFENCE PHASE</span><h1>Make your case.</h1><p>{accused.map((player) => player.name).join(' & ')}, this is your chance to explain the clues before {room.settings.allowRevote ? 'one final vote' : 'the reveal'}.</p><div className="accused-cards">{accused.map((player) => <div key={player.id}><span className={`big-avatar avatar-${hash(player.name) % 5}`}>{player.name[0]}</span><strong>{player.name}</strong></div>)}</div><Timer /></div>; }

function MoleGuess() { const { send } = useGame(); const [guess, setGuess] = useState(''); return <div className="phase-screen mole-guess"><Eye size={46} /><span className="game-kicker">FINAL CHANCE</span><h1>Steal the word.</h1><p>You were caught—but one correct guess earns you a point.</p><div className="guess-box"><input autoFocus value={guess} onChange={(e) => setGuess(e.target.value)} maxLength={80} placeholder="What was the secret word?" /><button className="button button-orange" disabled={!guess.trim()} onClick={() => send({ type: 'submit_mole_guess', guess })}>Lock guess <Lock /></button></div></div>; }
function SpokenGuessJudge() { const { room, me, send } = useGame(); if (!room || !me) return null; return <div className="phase-screen mole-guess"><Eye size={46} /><span className="game-kicker">HOST JUDGMENT · PRIVATE</span><h1>Did they get it?</h1><p>The Mole says their guess aloud. Only the host records whether it matches.</p><div className="spoken-judges">{me.judgeMoleIds.map((id) => { const player = room.players.find((item) => item.id === id); return <div key={id}><strong>{player?.name}</strong><button className="button button-lime" onClick={() => send({ type: 'host_judge_guess', playerId: id, correct: true })}><Check /> Correct</button><button className="button button-orange" onClick={() => send({ type: 'host_judge_guess', playerId: id, correct: false })}><X /> Incorrect</button></div>; })}</div></div>; }

function RoundReveal() { const { room, me, send } = useGame(); if (!room?.result || !me) return null; return <div className="reveal-screen"><span className="game-kicker">ROUND {room.roundNumber} COMPLETE</span><div className="reveal-mascot"><img src="/moley-mascot.png" alt="Moley mascot" /></div><h1>{room.result.headline}</h1><p>The secret word was</p><div className="secret-word-reveal">{room.result.secretWord}</div><div className="result-players">{room.result.moleIds.map((id) => { const player = room.players.find((item) => item.id === id); return <span key={id}><Eye /> {player?.name} was a Mole · +{room.result!.gains[id] ?? 0}</span>; })}</div>{me.canHost ? <button className="button button-primary button-xl" onClick={() => send({ type: 'host_advance' })}>See round recap <ArrowRight /></button> : <div className="waiting-host"><span className="live-dot" /> Waiting for host</div>}</div>; }

function RoundRecap() { const { room, me, send } = useGame(); if (!room || !me) return null; const recap = room.history.at(-1); if (!recap) return null; const topGain = [...room.players].filter((player) => player.kind !== 'spectator').sort((a,b) => b.roundGain - a.roundGain)[0]; return <div className="scoreboard-screen recap-screen"><span className="game-kicker">ROUND RECAP</span><h1>How the tunnel turned</h1><div className="recap-grid"><article><strong>Secret word</strong><b>{recap.word}</b><span>{recap.category}</span></article><article><strong>Round award</strong><b>{topGain?.roundGain ? 'Sharpest shovel' : 'Best poker face'}</b><span>{topGain?.name ?? 'The whole room'}</span></article><article><strong>Audience</strong><b>{Object.values(room.predictionTotals).reduce((sum, value) => sum + value, 0)} predictions</b><span>{Object.values(room.reactions).reduce((sum, value) => sum + value, 0)} reactions</span></article></div><div className="timeline">{room.history.map((round) => <span key={round.roundNumber}><b>{round.roundNumber}</b>{round.word}<small>{round.result.headline}</small></span>)}</div><ShareResultCard />{me.canHost ? <button className="button button-primary button-xl" onClick={() => send({ type: 'host_advance' })}>See scoreboard <ArrowRight /></button> : <div className="waiting-host"><span className="live-dot" /> Waiting for host</div>}</div>; }

function ShareResultCard() { const room = useGame((state) => state.room); if (!room || !featureEnabled(room.featureFlags, 'externalSharing')) return null; const share = async () => { const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350; const context = canvas.getContext('2d')!; context.fillStyle = '#17140f'; context.fillRect(0,0,1080,1350); context.fillStyle = '#c7f04b'; context.font = '900 72px system-ui'; context.fillText('MOLEY.CA', 80, 130); context.fillStyle = '#fffaf1'; context.font = '900 88px system-ui'; context.fillText(room.result?.headline ?? 'ROUND COMPLETE', 80, 330, 920); context.font = '700 48px system-ui'; context.fillText(`Secret word: ${room.revealedWord}`, 80, 470); context.fillText(`Round ${room.roundNumber} · ${room.players.length} players`, 80, 560); context.fillStyle = '#f06b45'; context.fillRect(80, 680, 920, 390); context.fillStyle = '#17140f'; context.font = '900 54px system-ui'; context.fillText('Find the Mole.', 140, 840); context.fillText('Protect the Word.', 140, 920); const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png')); if (!blob) return; const file = new File([blob], 'moley-result.png', { type: 'image/png' }); if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: 'My Moley result', files: [file] }); else { const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = file.name; link.click(); URL.revokeObjectURL(link.href); } }; return <button className="button button-light" onClick={share}><Share2 /> Share result card</button>; }

function Scoreboard() { const { room, me, send } = useGame(); if (!room || !me) return null; const ranked = [...room.players].filter((player) => player.kind !== 'spectator').sort((a, b) => b.score - a.score); return <div className="scoreboard-screen"><span className="game-kicker">AFTER ROUND {room.roundNumber}</span><h1>The leaderboard</h1><div className="leaderboard">{ranked.map((player, index) => <div key={player.id} className={index < 3 ? `rank-${index + 1}` : ''}><span className="rank">{index + 1}</span><span className={`avatar avatar-${hash(player.name) % 5}`}>{player.kind === 'bot' ? <Bot /> : player.name[0]}</span><strong>{player.name}</strong><span className="gain">{player.roundGain > 0 ? `+${player.roundGain}` : '—'}</span><b>{player.score}<small> PTS</small></b></div>)}</div>{me.canHost ? <button className="button button-primary button-xl" onClick={() => send({ type: 'host_advance' })}>Start next round <ArrowRight /></button> : <button className="button button-light" onClick={() => send({ type: 'player_ready', ready: true })}><Check /> Ready for next round</button>}</div>; }

function MatchComplete() {
  const { room, me, send } = useGame();
  const human = room?.players.find((player) => player.id === me?.playerId);
  const completedAt = room?.history.at(-1)?.createdAt ?? null;
  useEffect(() => {
    if (!room || !human || human.kind === 'spectator' || !featureEnabled(room.featureFlags, 'careerStats')) return;
    const matchId = `${room.code}:${human.id}:${completedAt ?? room.roundNumber}`;
    try {
      const seenKey = 'moley:career:seen';
      const seen = JSON.parse(localStorage.getItem(seenKey) ?? '[]') as string[];
      if (seen.includes(matchId)) return;
      const key = 'moley:career';
      const current = JSON.parse(localStorage.getItem(key) ?? '{}') as { matches?: number; rounds?: number; points?: number };
      localStorage.setItem(key, JSON.stringify({ matches: (current.matches ?? 0) + 1, rounds: (current.rounds ?? 0) + room.roundNumber, points: (current.points ?? 0) + human.score }));
      localStorage.setItem(seenKey, JSON.stringify([...seen.slice(-19), matchId]));
    } catch { /* Device-only stats are optional. */ }
  }, [completedAt, human, room]);
  if (!room || !me) return null;
  const winners = room.players.filter((player) => room.winners.includes(player.id));
  return <div className="winner-screen"><Trophy /><span className="game-kicker">MATCH COMPLETE · {room.roundNumber} ROUNDS</span><h1>{winners.length > 1 ? 'Co-winners!' : `${winners[0]?.name ?? 'Moley'} wins!`}</h1><p>{winners.map((player) => player.name).join(' & ')} finished on top with {winners[0]?.score ?? 0} points.</p><div className="winner-podium">{winners.map((player) => <div key={player.id}><span className={`big-avatar avatar-${hash(player.name) % 5}`}>{player.name[0]}</span><Crown /><strong>{player.name}</strong></div>)}</div>{me.canHost ? <div className="rematch-actions"><button className="button button-lime" onClick={() => send({ type: 'host_rematch', mode: 'same' })}><RefreshCw /> Same scores</button><button className="button button-light" onClick={() => send({ type: 'host_rematch', mode: 'reset' })}>Reset scores</button><button className="button button-light" onClick={() => send({ type: 'host_rematch', mode: 'settings' })}><Settings2 /> Change setup</button></div> : <div className="waiting-host"><span className="live-dot" /> Waiting for host</div>}</div>;
}

function PublicWaiting({ title, text, icon }: { title: string; text: string; icon: ReactNode }) { return <div className="phase-screen public-wait"><div className="waiting-icon">{icon}</div><h1>{title}</h1><p>{text}</p><Timer /></div>; }
function Timer() { const room = useGame((state) => state.room); const [now, setNow] = useState(0); useEffect(() => { const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, []); if (!room || now === 0) return null; if (!room.timerEndsAt && room.timerPausedRemaining === null) return null; const ms = room.timerPausedRemaining ?? Math.max(0, (room.timerEndsAt ?? now) - now); return <div className="timer"><Clock3 /> {Math.ceil(ms / 1000)}<small>s</small>{room.timerPausedRemaining !== null && <span>PAUSED</span>}</div>; }
function HostDock() { const { room, send } = useGame(); if (!room) return null; return <div className="host-dock"><span><Crown /> HOST CONTROLS</span>{room.timerEndsAt && <button onClick={() => send({ type: 'host_pause' })}><Pause /> Pause</button>}{room.timerPausedRemaining !== null && <button onClick={() => send({ type: 'host_resume' })}><Play /> Resume</button>}{(room.timerEndsAt || room.timerPausedRemaining !== null) && <button onClick={() => send({ type: 'host_add_time', seconds: 30 })}><Plus /> 30s</button>}<button className="host-next" onClick={() => send({ type: 'host_advance' })}>Advance <ArrowRight /></button></div>; }

function ShareDialog({ onClose }: { onClose: () => void }) { const room = useGame((state) => state.room); if (!room) return null; const url = `${location.origin}/join/${room.code}`; const sharing = featureEnabled(room.featureFlags, 'externalSharing'); const share = async () => { if (!sharing) return; if (navigator.share) await navigator.share({ title: 'Join my Moley game', text: `Room ${formatCode(room.code)}`, url }); else await navigator.clipboard.writeText(url); }; return <Modal onClose={onClose}><div className="dialog-icon"><QrCode /></div><span className="section-kicker">BRING IN THE SUSPECTS</span><h2>Join my room</h2><div className="share-qr"><QRCodeSVG value={url} size={210} level="M" /></div><div className="room-code-display">{formatCode(room.code)}</div>{sharing ? <><button className="button button-primary button-wide" onClick={share}><Share2 /> Share room</button><button className="button button-light button-wide" onClick={async () => { await navigator.clipboard.writeText(url); }}><Copy /> Copy link</button></> : <p className="form-error">External sharing is temporarily unavailable. Players can still type the room code.</p>}<a className="display-link" href={`/display/${room.code}`} target="_blank"><Monitor /> Open TV display</a></Modal>; }

function Modal({ onClose, children, wide = false }: { onClose: () => void; children: ReactNode; wide?: boolean }) {
  const [dialogRef, onDialogKeyDown] = useDialogFocus<HTMLDivElement>(onClose);
  return <motion.div className="dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><motion.div ref={dialogRef} onKeyDown={onDialogKeyDown} role="dialog" aria-modal="true" className={`game-dialog ${wide ? 'dialog-wide' : ''}`} initial={{ y: 30, scale: .98 }} animate={{ y: 0, scale: 1 }}><button className="dialog-close" onClick={onClose} aria-label="Close dialog"><X /></button>{children}</motion.div></motion.div>;
}

function DisplayPage({ code, go }: { code: string; go: (path: string) => void }) { const connect = useGame((state) => state.connect); const room = useGame((state) => state.room); const [error, setError] = useState(''); useEffect(() => { const open = async () => { const stored = restoreSession(`display-${code}`); if (stored) { connect(stored); return; } try { const response = await fetch(`/api/rooms/${code}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `Display ${crypto.randomUUID().slice(0, 6)}`, spectator: true }) }); const data = await response.json() as any; if (!response.ok) throw new Error(data.error); const session = { code: data.code, playerId: data.playerId, token: data.sessionToken }; localStorage.setItem(`moley:session:display-${code}`, JSON.stringify(session)); connect(session); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Display unavailable.'); } }; void open(); }, [code, connect]); if (error) return <CenteredPage go={go}><div className="standalone-card"><h1>{error}</h1><button className="button button-primary" onClick={() => go('/')}>Back home</button></div></CenteredPage>; if (!room) return <LoadingRoom go={go} />; return <Suspense fallback={<LoadingRoom go={go} />}><GameShell go={go} display /></Suspense>; }

function HowTo({ go }: { go: (path: string) => void }) { return <div className="rules-page"><nav className="site-nav wrap"><Brand go={go} /><button className="button button-primary" onClick={() => go('/')}><Play /> Play now</button></nav><main className="rules-wrap"><div className="rules-hero"><span className="section-kicker">THE TWO-MINUTE GUIDE</span><h1>How to play Moley</h1><p>Find the Mole without revealing the word they’re trying to steal.</p></div><section className="rules-roles"><article><div className="rules-icon innocent"><ShieldCheck /></div><h2>If you know the word</h2><p>Give a clue that proves you know it, but stays subtle enough that the Mole cannot figure it out.</p><div className="example"><span>SECRET WORD · APPLE</span><strong>Good clue: “orchard”</strong><small>Risky clue: “red fruit”</small></div></article><article><div className="rules-icon mole"><Eye /></div><h2>If you’re the Mole</h2><p>Listen to every clue, act like you belong, and infer the secret before the group catches you.</p><div className="example dark"><span>YOU SEE · THE CATEGORY</span><strong>Blend in. Stay broad.</strong><small>If caught, guess the word for +1.</small></div></article></section><section className="round-flow"><span className="section-kicker">ONE ROUND</span><h2>Clue. Discuss. Vote. Reveal.</h2><ol><li><b>1</b><div><strong>Reveal privately</strong><p>Only look at your own screen.</p></div></li><li><b>2</b><div><strong>Give one clue</strong><p>Spoken or typed, in random order.</p></div></li><li><b>3</b><div><strong>Talk it out</strong><p>Question clues that felt too broad.</p></div></li><li><b>4</b><div><strong>Vote secretly</strong><p>Pick one suspect. No self-votes.</p></div></li><li><b>5</b><div><strong>Reveal and score</strong><p>A caught Mole gets one final guess.</p></div></li></ol></section><section className="rules-scoring"><span className="section-kicker light">SCORING</span><h2>First to 5 wins.</h2><div><ScoreCard result="MOLE ESCAPES" mole="+2" team="0" tone="dark" /><ScoreCard result="CAUGHT + RIGHT GUESS" mole="+1" team="0" tone="orange" /><ScoreCard result="CAUGHT + WRONG GUESS" mole="0" team="+2 each" tone="lime" /></div><p>With multiple Moles, each one scores individually. Innocents earn points only if every Mole is caught and none guesses the word.</p></section><section className="rules-cta"><img src="/moley-mascot.png" alt="Moley mascot" /><div><h2>Ready to look suspicious?</h2><p>No account. No download. One minute to start.</p></div><button className="button button-lime button-xl" onClick={() => go('/')}><Play /> Start digging</button></section></main></div>; }

type PassStage = 'setup' | 'roles' | 'clues' | 'votes' | 'result';
function PassThePhone({ go }: { go: (path: string) => void }) {
  const [names, setNames] = useState(['', '', '', '']);
  const [bots, setBots] = useState<string[]>([]);
  const [stage, setStage] = useState<PassStage>('setup');
  const [index, setIndex] = useState(0);
  const [mole, setMole] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [word, setWord] = useState('APPLE');
  const [votes, setVotes] = useState<number[]>([]);
  const [accused, setAccused] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const humans = names.map((name) => name.trim()).filter(Boolean);
  const players = [...humans, ...bots];
  const isBot = (playerIndex: number) => playerIndex >= humans.length;
  const options = words.filter((entry) => entry.familySafe).map((entry) => entry.display.toLocaleUpperCase('en-CA'));
  const botNames = ['Milo', 'Dot', 'Biscuit', 'Pepper', 'Noodle', 'Waffles'];
  const randomIndex = (length: number) => { const data = new Uint32Array(1); crypto.getRandomValues(data); return data[0]! % length; };
  const deal = () => { setMole(randomIndex(players.length)); setWord(options[randomIndex(options.length)]!); setIndex(0); setVotes([]); setRevealed(false); setStage(humans.length ? 'roles' : 'clues'); };
  const start = () => { if (players.length < 4 || humans.length < 1) return; setNames(humans); setScores(Object.fromEntries(players.map((player) => [player, scores[player] ?? 0]))); deal(); };
  const nextRole = () => { setRevealed(false); if (index + 1 >= humans.length) { setIndex(0); setStage('clues'); } else setIndex(index + 1); };
  const beginVotes = () => {
    const botVotes = players.flatMap((_, playerIndex) => { if (!isBot(playerIndex)) return []; const choice = randomIndex(players.length - 1); return [choice >= playerIndex ? choice + 1 : choice]; });
    setVotes(botVotes); setIndex(0); setStage('votes');
  };
  const finishVoting = (allVotes: number[]) => {
    const totals = players.map((_, target) => allVotes.filter((vote) => vote === target).length);
    const selected = totals.indexOf(Math.max(...totals)); setAccused(selected);
    const caught = selected === mole;
    setScores(Object.fromEntries(players.map((player, playerIndex) => [player, (scores[player] ?? 0) + (caught ? playerIndex === mole ? 0 : 2 : playerIndex === mole ? 2 : 0)])));
    setStage('result');
  };
  const vote = (target: number) => { const next = [...votes, target]; setVotes(next); if (index + 1 >= humans.length) finishVoting(next); else setIndex(index + 1); };
  const reset = () => deal();
  const addBot = () => { const available = botNames.find((name) => !players.includes(name)) ?? `Bot ${bots.length + 1}`; setBots([...bots, available]); };
  return <div className="pass-page"><nav className="site-nav wrap"><Brand go={go} light /><button className="text-button light" onClick={() => go('/')}><X /> Exit</button></nav><main>
    {stage === 'setup' && <div className="pass-card"><Smartphone className="pass-icon" /><span className="game-kicker">ONE PHONE · FULL GAME</span><h1>Pass the phone</h1><p>Enter human names and add optional bots. One human plus three bots works.</p><div className="name-list">{names.map((name, i) => <div key={i}><span>{i + 1}</span><input value={name} onChange={(e) => { const copy = [...names]; copy[i] = e.target.value; setNames(copy); }} placeholder={`Player ${i + 1}`} maxLength={24} />{names.length > 1 && <button aria-label={`Remove player ${i + 1}`} onClick={() => setNames(names.filter((_, item) => item !== i))}><X /></button>}</div>)}</div><div className="pass-bots">{bots.map((bot) => <span key={bot}><Bot /> {bot}<button aria-label={`Remove ${bot}`} onClick={() => setBots(bots.filter((name) => name !== bot))}><X /></button></span>)}</div><div className="pass-setup-actions"><button className="button button-light" onClick={() => setNames([...names, ''])}><Plus /> Add player</button><button className="button button-light" onClick={addBot}><Bot /> Add bot</button></div><button className="button button-lime button-wide button-xl" onClick={start} disabled={players.length < 4 || humans.length < 1}><Play /> {humans.length < 1 ? 'Add one human' : players.length < 4 ? `${4 - players.length} more needed` : 'Start game'}</button></div>}
    {stage === 'roles' && <div className="pass-card secret-pass"><span className="game-kicker">PRIVATE ROLE {index + 1} / {humans.length}</span><h1>Pass to {players[index]}</h1><p>{revealed ? 'Memorize it, then hide the screen.' : `Only ${players[index]} should look.`}</p><button className={`role-card ${revealed ? `revealed ${index === mole ? 'mole' : 'innocent'}` : ''}`} onClick={() => setRevealed(true)}>{revealed ? index === mole ? <><Eye /><span>YOU ARE THE</span><strong>MOLE</strong></> : <><span>YOUR SECRET WORD</span><strong>{word}</strong></> : <><Eye /><span>HOLD TO REVEAL</span></>}</button>{revealed && <button className="button button-lime button-xl" onClick={nextRole}><Lock /> Hide & pass on</button>}</div>}
    {stage === 'clues' && <div className="pass-card"><MessageCircle className="pass-icon" /><span className="game-kicker">CLUE ROUND</span><h1>Say one clue each.</h1><p>Go in this order. Bots show their clue automatically.</p><ol className="pass-order">{players.map((name, playerIndex) => <li key={name}><span>{playerIndex + 1}</span><strong>{name}{isBot(playerIndex) ? ' · BOT' : ''}</strong>{isBot(playerIndex) && <small>“{playerIndex === mole ? 'familiar' : word === 'APPLE' ? 'orchard' : word === 'HOCKEY' ? 'rink' : 'popular'}”</small>}</li>)}</ol><button className="button button-lime button-wide button-xl" onClick={beginVotes}><Lock /> Start secret voting</button></div>}
    {stage === 'votes' && <div className="pass-card"><Lock className="pass-icon" /><span className="game-kicker">PRIVATE VOTE {index + 1} / {humans.length}</span><h1>Pass to {players[index]}</h1><p>Who do you think is the Mole?</p><div className="vote-grid">{players.map((name, target) => target !== index && <button onClick={() => vote(target)} key={name}><span className={`avatar avatar-${hash(name) % 5}`}>{isBot(target) ? <Bot /> : name[0]}</span><strong>{name}</strong></button>)}</div></div>}
    {stage === 'result' && (() => { const caught = accused === mole; const ranked = [...players].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0)); return <div className="pass-card result"><img src="/moley-mascot.png" alt="Moley mascot" /><span className="game-kicker">ROUND COMPLETE</span><h1>{caught ? 'YOU CAUGHT THE MOLE!' : 'THE MOLE ESCAPED!'}</h1><p><strong>{players[mole]}</strong> was the Mole. The secret word was <strong>{word}</strong>.</p><div className="pass-scoreboard">{ranked.map((player, rank) => <span key={player}><b>{rank + 1}</b><strong>{player}</strong><em>{scores[player] ?? 0} pts</em></span>)}</div><button className="button button-lime button-xl" onClick={reset}><RefreshCw /> Play another round</button></div>; })()}
  </main></div>;
}

function formatCode(code: string): string { return formatRoomCode(code); }
function cap(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
function hash(value: string): number { return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0); }
function sharedPackFromUrl(): string[] { return decodePackWords(new URLSearchParams(location.search).get('pack') ?? ''); }
function tone(kind: 'tick' | 'win') { try { const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext; const context = new AudioContextClass(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = kind === 'win' ? 660 : 320; oscillator.type = 'sine'; gain.gain.setValueAtTime(.05, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .15); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .16); } catch { /* optional enhancement */ } }
