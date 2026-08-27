import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { ArrowRight, Bot, Check, Clock3, Eye, Home, Lock, Monitor, Pause, Play, Plus, RefreshCw, Settings2, ShieldCheck, Smartphone, Trophy, UserRound, Users, WifiOff, X } from 'lucide-react';
import {
  advanceLocalRole, allHumanVotesComplete, beginLocalVoting, buildLocalCatalog, createLocalGame,
  createLocalPlayer, currentRolePlayer, finishLocalRound, localSettingsForPreset, playLocalClue,
  resetLocalMatch, resolveLocalVoting, startLocalRound, submitLocalVote,
  type LocalGameState, type LocalPlayer, type LocalPreset, type LocalSettings
} from '@moley/game-core';
import { words, type WordEntry } from '@moley/word-packs';
import { normalizeName } from '@moley/shared';
import { clearLocalGame, loadLocalGame, recoverLocalNames, saveLocalGame, type LocalRecovery } from './local-storage';
import { WordBoard } from './WordBoard';
import { clearLocalDisplay, publishLocalDisplay } from './local-display';

const BOT_NAMES = ['Milo', 'Dot', 'Biscuit', 'Pepper', 'Noodle', 'Waffles', 'Scout', 'Mochi', 'Pickle', 'Pip', 'Rook', 'Sunny'];
const PRESETS: { id: LocalPreset; label: string; description: string; icon: typeof Smartphone }[] = [
  { id: 'local-classic', label: 'Local Classic', description: 'Shared screen · humans welcome', icon: Users },
  { id: 'local-bots', label: 'Local + Bots', description: 'Smart deterministic opponents', icon: Bot },
  { id: 'pass-the-phone', label: 'Pass the Phone', description: 'Private turns on one device', icon: Smartphone },
  { id: 'big-screen-party', label: 'Big Screen Party', description: 'Condensed board for TV or tablet', icon: Monitor },
  { id: 'offline-cottage', label: 'Offline Cottage', description: 'Fast, quiet, zero-reception play', icon: WifiOff }
];

function cryptoRandom(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0]! / 0x100000000;
}

export function LocalPlay({ go, initialPreset = 'local-classic' }: { go: (path: string) => void; initialPreset?: LocalPreset }) {
  const [recovery, setRecovery] = useState<LocalRecovery | null>(null);
  const [game, setGame] = useState<LocalGameState | null>(null);
  const [names, setNames] = useState(['', '', '', '']);
  const [bots, setBots] = useState<LocalPlayer[]>([]);
  const [settings, setSettings] = useState<LocalSettings>(() => localSettingsForPreset(initialPreset));
  const [customText, setCustomText] = useState(() => localStorage.getItem('moley:local:saved-pack') ?? '');
  const [roleVisible, setRoleVisible] = useState(false);
  const [voteReady, setVoteReady] = useState(false);
  const [guessReady, setGuessReady] = useState(false);
  const [humanClue, setHumanClue] = useState('');
  const [botThinking, setBotThinking] = useState(false);
  const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => { void loadLocalGame().then(setRecovery); }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    addEventListener('online', update); addEventListener('offline', update);
    return () => { removeEventListener('online', update); removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    const hidePrivateState = () => { delete document.documentElement.dataset.localPrivate; flushSync(() => { setRoleVisible(false); setVoteReady(false); setGuessReady(false); }); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') hidePrivateState(); };
    addEventListener('pagehide', hidePrivateState); addEventListener('pageshow', hidePrivateState); addEventListener('popstate', hidePrivateState); document.addEventListener('visibilitychange', onVisibility);
    return () => { delete document.documentElement.dataset.localPrivate; removeEventListener('pagehide', hidePrivateState); removeEventListener('pageshow', hidePrivateState); removeEventListener('popstate', hidePrivateState); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  useEffect(() => { if (game) void saveLocalGame(game); }, [game]);
  useEffect(() => {
    if (game?.stage !== 'match-complete') return;
    const seenKey = `moley:local:stats:${game.sessionId}`;
    if (localStorage.getItem(seenKey)) return;
    const current = JSON.parse(localStorage.getItem('moley:local:stats') ?? '{}') as { matches?: number; rounds?: number };
    localStorage.setItem('moley:local:stats', JSON.stringify({ matches: (current.matches ?? 0) + 1, rounds: (current.rounds ?? 0) + game.roundNumber }));
    localStorage.setItem(seenKey, 'recorded');
  }, [game?.roundNumber, game?.sessionId, game?.stage]);

  const catalog = useMemo(() => buildLocalCatalog(words, game?.settings.customWords ?? settings.customWords), [game?.settings.customWords, settings.customWords]);
  useEffect(() => { if (game) publishLocalDisplay(game, catalog); }, [catalog, game]);
  const update = (next: LocalGameState) => { delete document.documentElement.dataset.localPrivate; setRoleVisible(false); setVoteReady(false); setGuessReady(false); setHumanClue(''); setBotThinking(false); if (next.settings.sound) localTone(); if (next.settings.haptics && navigator.vibrate) navigator.vibrate(12); setNotice('Saved on this device'); setGame(next); setTimeout(() => setNotice(''), 1200); };
  const activePlayers = game?.players.filter((player) => player.active) ?? [];
  const secret = catalog.find((word) => word.id === game?.secretWordId);
  const board = game?.boardIds.map((id) => catalog.find((word) => word.id === id)).filter((word): word is WordEntry => Boolean(word)) ?? [];

  const applyPreset = (preset: LocalPreset) => {
    const next = localSettingsForPreset(preset);
    setSettings({ ...next, customWords: settings.customWords, categories: settings.categories, sound: settings.sound, haptics: settings.haptics });
  };
  const addBot = () => {
    if (names.filter((name) => name.trim()).length + bots.length >= 100) { setNotice('Local games support at most 100 seats.'); return; }
    const used = new Set([...names, ...bots.map((bot) => bot.name)].map(normalizeName));
    const name = BOT_NAMES.find((candidate) => !used.has(normalizeName(candidate))) ?? `Bot ${bots.length + 1}`;
    setBots([...bots, createLocalPlayer(name, 'bot', cryptoRandom)]);
  };
  const start = () => {
    try {
      const humans = names.map((name) => name.trim()).filter(Boolean).map((name) => createLocalPlayer(name, 'human', cryptoRandom));
      const customWords = customText.split(/[\n,]+/).map((word) => word.trim()).filter(Boolean);
      const nextSettings = { ...settings, customWords };
      const created = createLocalGame([...humans, ...bots], nextSettings, cryptoRandom);
      update(startLocalRound(created, words, cryptoRandom));
    }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not start this local game.'); }
  };
  const fresh = async () => { if (game) clearLocalDisplay(game.sessionId); await clearLocalGame(); setRecovery({ status: 'none' }); setGame(null); };
  const recoverNames = async () => {
    if (recovery?.status === 'corrupt') {
      const recovered = recoverLocalNames(recovery.raw);
      if (recovered.length) setNames([...recovered, ...Array(Math.max(0, 4 - recovered.length)).fill('')]);
    }
    await fresh();
    setNotice('Player names recovered. The damaged round was removed.');
  };

  if (recovery === null) return <LocalFrame go={go} online={online}><section className="local-card local-loading"><RefreshCw className="spin" /><h1>Checking this device…</h1><p>Looking for a local game you can resume.</p></section></LocalFrame>;
  if (!game && recovery.status === 'valid') return <LocalFrame go={go} online={online}><section className="local-card local-recovery"><ShieldCheck /><span className="local-kicker">LOCAL GAME FOUND</span><h1>Pick up where you left off.</h1><p>Round {recovery.state.roundNumber} · {recovery.state.players.filter((player) => player.active).length} players · saved on this device</p><button className="button button-lime button-xl" onClick={() => setGame(recovery.state)}><Play /> Resume Local Game</button><button className="button button-light" onClick={() => void fresh()}><RefreshCw /> Start New Game</button></section></LocalFrame>;
  if (!game && recovery.status === 'corrupt') return <LocalFrame go={go} online={online}><section className="local-card local-recovery"><ShieldCheck /><span className="local-kicker">SAVE NEEDS HELP</span><h1>Your local game did not load cleanly.</h1><p>Moley will not crash or guess at private roles. Player names may still be recoverable.</p><button className="button button-lime" onClick={() => void recoverNames()}>Recover What We Can</button><button className="button button-light" onClick={() => void fresh()}>Start Fresh</button></section></LocalFrame>;

  if (!game) {
    const humans = names.map((name) => name.trim()).filter(Boolean);
    const seats = humans.length + bots.length;
    return <LocalFrame go={go} online={online} notice={notice}><section className="local-setup">
      <div className="local-setup-copy"><span className="local-kicker">NO INTERNET · NO BACKEND · FULL GAME</span><h1>Play Moley locally.</h1><p>One device runs the board, private roles, smart bots, voting, scores, recovery, and rematches.</p><div className="local-boundaries"><span><Check /> Works offline</span><span><Check /> Deterministic bots</span><span><Check /> Saved on device</span></div></div>
      <div className="local-card">
        <h2>Choose a local style</h2><div className="local-presets">{PRESETS.map(({ id, label, description, icon: Icon }) => <button key={id} className={settings.preset === id ? 'active' : ''} onClick={() => applyPreset(id)}><Icon /><span><strong>{label}</strong><small>{description}</small></span></button>)}</div>
        <div className="local-setup-grid"><div><h2>Who's playing?</h2><div className="local-name-list">{names.map((name, index) => <label key={index}><span>{index + 1}</span><input value={name} onChange={(event) => setNames(names.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Player ${index + 1}`} maxLength={24} />{names.length > 1 && <button aria-label={`Remove player ${index + 1}`} onClick={() => setNames(names.filter((_, itemIndex) => itemIndex !== index))}><X /></button>}</label>)}</div><div className="local-add-row"><button className="button button-light" disabled={seats >= 100} onClick={() => setNames([...names, ''])}><Plus /> Human</button><button className="button button-light" disabled={seats >= 100} onClick={addBot}><Bot /> Add bot</button></div><div className="local-bot-list">{bots.map((bot) => <span key={bot.id}><Bot /> <strong>{bot.name}</strong><select aria-label={`${bot.name} difficulty`} value={bot.difficulty} onChange={(event) => setBots(bots.map((item) => item.id === bot.id ? { ...item, difficulty: event.target.value as LocalPlayer['difficulty'] } : item))}><option value="easy">Easy</option><option value="normal">Normal</option><option value="sneaky">Sneaky</option></select><button aria-label={`Remove ${bot.name}`} onClick={() => setBots(bots.filter((item) => item.id !== bot.id))}><X /></button></span>)}</div></div>
          <div><h2>Game setup</h2><div className="local-fields"><label><span>Board size</span><select value={settings.boardSize} onChange={(event) => setSettings({ ...settings, boardSize: Number(event.target.value) as LocalSettings['boardSize'] })}>{[5,6,7,8,9,10].map((size) => <option key={size} value={size}>{size} × {size}</option>)}</select></label><label><span>First to</span><select value={settings.targetScore} onChange={(event) => setSettings({ ...settings, targetScore: Number(event.target.value) })}>{[3,5,7,10,15].map((score) => <option key={score} value={score}>{score} points</option>)}</select></label><label><span>Clue timer</span><select value={settings.clueSeconds} onChange={(event) => setSettings({ ...settings, clueSeconds: Number(event.target.value) })}><option value={0}>Off</option><option value={30}>30 seconds</option><option value={45}>45 seconds</option><option value={60}>60 seconds</option></select></label><label className="local-check"><input type="checkbox" checked={settings.fastBots} onChange={(event) => setSettings({ ...settings, fastBots: event.target.checked })} /> Fast Bots</label><label className="local-check"><input type="checkbox" checked={settings.sound} onChange={(event) => setSettings({ ...settings, sound: event.target.checked })} /> Sound</label><label className="local-check"><input type="checkbox" checked={settings.haptics} onChange={(event) => setSettings({ ...settings, haptics: event.target.checked })} /> Haptics</label></div><details className="local-packs"><summary>Custom local pack</summary><p>One word per line or comma-separated. Saved only on this device; humans can use any word, while bot secrets stay inside the curated bot library.</p><textarea value={customText} onChange={(event) => setCustomText(event.target.value)} placeholder={'Campfire\nCanoe\nMarshmallow'} /><button className="button button-light" onClick={() => { localStorage.setItem('moley:local:saved-pack', customText); setNotice('Custom pack saved on this device'); }}>Save pack locally</button></details></div></div>
        <button className="button button-lime button-wide button-xl" aria-label={seats >= 4 && humans.length >= 1 ? 'Start game locally' : undefined} onClick={start} disabled={seats < 4 || humans.length < 1}><Play /> {humans.length < 1 ? 'Add one human' : seats < 4 ? `Add ${4 - seats} more seat${4 - seats === 1 ? '' : 's'}` : 'Start Local Game'}</button>
      </div>
    </section></LocalFrame>;
  }

  const skip = () => {
    if (game.stage === 'clues') {
      const current = game.players.find((player) => player.id === game.turnOrder[game.currentTurn]);
      update(playLocalClue(game, catalog, current?.kind === 'human' ? 'passed' : undefined, cryptoRandom));
    } else if (game.stage === 'discussion') update(beginLocalVoting(game, catalog, cryptoRandom));
  };
  const addBotNextRound = () => {
    const used = new Set(game.players.map((player) => normalizeName(player.name)));
    const name = BOT_NAMES.find((candidate) => !used.has(normalizeName(candidate))) ?? `Bot ${game.players.filter((player) => player.kind === 'bot').length + 1}`;
    update({ ...game, players: [...game.players, { ...createLocalPlayer(name, 'bot', cryptoRandom), active: false, joinsNextRound: true }], updatedAt: Date.now() });
  };
  const openDisplay = () => { publishLocalDisplay(game, catalog); const displayWindow = window.open(`/local-display/${game.sessionId}`, 'moley-local-public-display', 'popup=yes,width=1280,height=720'); setNotice(displayWindow ? 'TV Display opened with public information only' : 'Your browser blocked the TV window. Allow popups and try again.'); };
  const header = <LocalGameHeader game={game} online={online} notice={notice} onOpenDisplay={openDisplay} onPause={() => update({ ...game, paused: !game.paused, updatedAt: Date.now() })} onRestart={() => { if (confirm('Restart this round? Current clues and votes will be cleared.')) update(startLocalRound({ ...game, roundNumber: Math.max(0, game.roundNumber - 1), players: game.players.map((player) => ({ ...player, moleRounds: player.moleRounds.filter((round) => round !== game.roundNumber) })) }, catalog, cryptoRandom)); }} onEnd={() => { if (confirm('End this local match now? The saved match will remain available until you start fresh.')) update({ ...game, stage: 'match-complete', updatedAt: Date.now() }); }} onSkip={skip} onAddBot={addBotNextRound} onRemoveBot={(id) => update({ ...game, players: game.players.map((player) => player.id === id ? { ...player, joinsNextRound: false, leavesNextRound: true } : player), updatedAt: Date.now() })} onTimerChange={(seconds) => update({ ...game, settings: { ...game.settings, clueSeconds: Math.max(0, Math.min(120, game.settings.clueSeconds + seconds)) }, updatedAt: Date.now() })} />;
  if (game.paused) return <div className="local-game">{header}<main className="local-stage"><section className="local-card local-recovery"><Pause /><span className="local-kicker">LOCAL GAME PAUSED</span><h1>Everything is saved.</h1><button className="button button-lime button-xl" onClick={() => update({ ...game, paused: false, updatedAt: Date.now() })}><Play /> Resume</button></section></main></div>;

  if (game.stage === 'roles') {
    const player = currentRolePlayer(game)!; const mole = game.moleIds.includes(player.id);
    return <div className="local-game">{header}<main className="local-stage"><section className="local-card local-private"><Lock /><span className="local-kicker">PRIVATE ROLE {game.roleIndex + 1} / {activePlayers.filter((item) => item.kind === 'human').length}</span><h1>Pass to {player.name}</h1><p>{roleVisible ? 'Memorize this, then hide the screen.' : `Only ${player.name} should look.`}</p><button aria-label="Hold to reveal privately" className={`local-role ${roleVisible ? mole ? 'mole revealed' : 'innocent revealed' : ''}`} onClick={() => { if (!history.state?.moleyPrivateReveal) history.pushState({ ...history.state, moleyPrivateReveal: true }, '', location.href); document.documentElement.dataset.localPrivate = 'revealed'; setRoleVisible(true); }}>{roleVisible ? mole ? <><Eye /><span>YOU ARE THE</span><strong>MOLE</strong><small>{secret?.category ?? 'Watch the clues'}</small></> : <><ShieldCheck /><span>YOUR SECRET WORD</span><strong>{secret?.display}</strong><small>{secret?.category}</small></> : <><Eye /><span>Tap to reveal privately</span></>}</button>{roleVisible && <button className="button button-lime button-xl" onClick={() => { if (history.state?.moleyPrivateReveal) history.back(); update(advanceLocalRole(game)); }}><Lock /> Hide & pass on</button>}</section></main></div>;
  }

  if (game.stage === 'clues') {
    const currentId = game.turnOrder[game.currentTurn]!; const current = activePlayers.find((player) => player.id === currentId)!;
    const submit = (event: FormEvent) => { event.preventDefault(); try { update(playLocalClue(game, catalog, humanClue, cryptoRandom)); } catch (error) { setNotice(error instanceof Error ? error.message : 'Clue could not be saved.'); } };
    const runBot = () => {
      if (botThinking) return;
      setBotThinking(true);
      const base = current.difficulty === 'easy' ? 800 : current.difficulty === 'sneaky' ? 1500 : 1200;
      const spread = current.difficulty === 'easy' ? 1000 : current.difficulty === 'sneaky' ? 1500 : 1300;
      const delay = game.settings.fastBots ? 0 : base + Math.floor(cryptoRandom() * spread);
      window.setTimeout(() => update(playLocalClue(game, catalog, undefined, cryptoRandom)), delay);
    };
    return <div className="local-game">{header}<LocalTurnOrder game={game} /><main className="local-stage local-board-layout"><section className="local-board-panel"><div className="local-phase-head"><span className="local-kicker">ROUND {game.roundNumber} · CLUE {game.currentTurn + 1}/{game.turnOrder.length}</span><h1>{current.name}'s turn</h1><p>{current.kind === 'bot' ? 'This bot reasons locally from permitted game information.' : 'Give a clue that proves you know the word without giving it away.'}</p>{game.settings.clueSeconds > 0 && <LocalClueTimer key={`${game.roundNumber}-${game.currentTurn}`} seconds={game.settings.clueSeconds} onExpire={skip} />}</div><LocalBoard board={board} size={game.settings.boardSize} />{current.kind === 'bot' ? <button className="button button-lime button-xl" disabled={botThinking} onClick={runBot}><Bot /> {botThinking ? `${current.name} is thinking…` : `Let ${current.name} think`}</button> : <form className="local-clue-form" onSubmit={submit}><label><span>Record {current.name}'s clue</span><input autoFocus value={humanClue} onChange={(event) => setHumanClue(event.target.value)} maxLength={80} placeholder="One meaningful clue…" /></label><button className="button button-lime" disabled={!humanClue.trim()}>Lock clue <ArrowRight /></button></form>}</section><aside className="local-public-clues"><h2>Public clues</h2>{game.turnOrder.map((id) => { const player = activePlayers.find((item) => item.id === id)!; return <div key={id} className={id === currentId ? 'current' : ''}><span>{player.kind === 'bot' ? <Bot /> : <UserRound />}</span><strong>{player.name}</strong><em>{game.clues[id] ? `“${game.clues[id]}”` : id === currentId ? 'NOW' : 'WAITING'}</em></div>; })}</aside></main></div>;
  }

  if (game.stage === 'discussion') return <div className="local-game">{header}<main className="local-stage local-board-layout"><section className="local-board-panel"><span className="local-kicker">DISCUSSION</span><h1>Who sounds suspicious?</h1><p>Question broad clues, defend your own, and keep the secret protected.</p><LocalBoard board={board} size={game.settings.boardSize} /><button className="button button-lime button-xl" onClick={() => update(beginLocalVoting(game, catalog, cryptoRandom))}><Lock /> Start secret voting</button></section><aside className="local-public-clues"><h2>Bot discussion</h2>{game.discussion.length ? game.discussion.map((line) => <p key={line}>{line}</p>) : <p>No bots in this round—talk it out around the room.</p>}</aside></main></div>;

  if (game.stage === 'voting') {
    const humans = activePlayers.filter((player) => player.kind === 'human'); const voter = humans[game.voteIndex]; const complete = allHumanVotesComplete(game);
    return <div className="local-game">{header}<main className="local-stage"><section className="local-card local-private local-vote-private"><Lock /><span className="local-kicker">SECRET VOTING · BOT VOTES HIDDEN</span>{complete ? <><h1>All votes are locked.</h1><p>Bring everyone back before the reveal.</p><button className="button button-lime button-xl" onClick={() => update(resolveLocalVoting(game, catalog, cryptoRandom))}><Eye /> Reveal the vote</button></> : !voteReady ? <><h1>Pass to {voter?.name}</h1><p>Previous votes are hidden. Only {voter?.name} should look.</p><button className="button button-lime button-xl" onClick={() => { if (!history.state?.moleyPrivateReveal) history.pushState({ ...history.state, moleyPrivateReveal: true }, '', location.href); document.documentElement.dataset.localPrivate = 'revealed'; setVoteReady(true); }}><Lock /> I'm {voter?.name}</button></> : <><h1>Who is the Mole?</h1><p>Your vote stays hidden until everyone finishes.</p><div className="local-vote-grid">{activePlayers.filter((player) => player.id !== voter?.id).map((player) => <button key={player.id} onClick={() => { if (history.state?.moleyPrivateReveal) history.back(); update(submitLocalVote(game, voter!.id, player.id)); }}><span>{player.kind === 'bot' ? <Bot /> : player.name[0]}</span><strong>{player.name}</strong></button>)}</div></>}</section></main></div>;
  }

  if (game.stage === 'guess') {
    const accused = activePlayers.find((player) => game.accusedIds.includes(player.id));
    return <div className="local-game">{header}<main className="local-stage"><section className="local-card local-private local-guess-private"><Eye /><span className="local-kicker">ONE LAST CHANCE</span>{!guessReady ? <><h1>Pass to {accused?.name}</h1><p>The group caught the Mole. Only {accused?.name} should make the final guess.</p><button className="button button-lime button-xl" onClick={() => { if (!history.state?.moleyPrivateReveal) history.pushState({ ...history.state, moleyPrivateReveal: true }, '', location.href); document.documentElement.dataset.localPrivate = 'revealed'; setGuessReady(true); }}><Lock /> I'm {accused?.name}</button></> : <><h1>Steal the word.</h1><p>Choose privately. The secret stays hidden until this guess is locked.</p><WordBoard words={board} size={game.settings.boardSize} label="Private final word guess" onSelect={(word) => { if (history.state?.moleyPrivateReveal) history.back(); update(finishLocalRound(game, catalog, word.id, cryptoRandom)); }} /></>}</section></main></div>;
  }

  if (game.stage === 'result') return <LocalResult game={game} secret={secret?.display ?? ''} onOpenDisplay={openDisplay} goNext={() => update(startLocalRound(game, catalog, cryptoRandom))} />;

  const ranked = [...activePlayers].sort((a, b) => b.score - a.score); const high = ranked[0]?.score ?? 0; const winners = ranked.filter((player) => player.score === high);
  return <div className="local-game">{header}<main className="local-stage"><section className="local-card local-finish"><Trophy /><span className="local-kicker">MATCH COMPLETE · {game.roundNumber} ROUNDS</span><h1>{winners.map((player) => player.name).join(' & ')} {winners.length === 1 ? 'wins!' : 'win!'}</h1><div className="local-scoreboard">{ranked.map((player, index) => <div key={player.id}><b>{index + 1}</b><span>{player.kind === 'bot' ? <Bot /> : player.name[0]}</span><strong>{player.name}</strong><em>{player.score} pts</em></div>)}</div><div className="local-finish-actions"><button className="button button-lime button-xl" onClick={() => update(startLocalRound(resetLocalMatch(game), catalog, cryptoRandom))}><RefreshCw /> Rematch</button><button className="button button-light" onClick={() => void fresh()}><Settings2 /> New setup</button><button className="button button-light" onClick={() => go('/')}><Home /> Home</button></div></section></main></div>;
}

function LocalFrame({ go, online, notice, children }: { go: (path: string) => void; online: boolean; notice?: string; children: ReactNode }) {
  return <div className="local-page"><nav className="local-nav"><button className="local-brand" onClick={() => go('/')}><Eye /> MOLEY<span>.CA</span></button><div><span className="local-status"><Smartphone /> LOCAL GAME</span>{!online && <span className="local-status offline"><WifiOff /> OFFLINE</span>}<button className="text-button light" onClick={() => go('/')}><X /> Exit</button></div></nav>{notice && <div className="local-notice" role="status">{notice}</div>}<main>{children}</main></div>;
}

function LocalGameHeader({ game, online, notice, onPause, onRestart, onEnd, onOpenDisplay, onSkip, onAddBot, onRemoveBot, onTimerChange }: { game: LocalGameState; online: boolean; notice: string; onPause?: () => void; onRestart?: () => void; onEnd?: () => void; onOpenDisplay?: () => void; onSkip?: () => void; onAddBot?: () => void; onRemoveBot?: (id: string) => void; onTimerChange?: (seconds: number) => void }) {
  const remainingNextRound = game.players.filter((player) => (player.active || player.joinsNextRound) && !player.leavesNextRound).length;
  const removableBots = remainingNextRound > 4 ? game.players.filter((player) => player.kind === 'bot' && (player.active || player.joinsNextRound) && !player.leavesNextRound && player.id !== game.turnOrder[game.currentTurn]) : [];
  const liveRound = !['setup', 'result', 'match-complete'].includes(game.stage);
  return <><header className="local-game-header"><span className="local-brand"><Eye /> MOLEY<span>.CA</span></span><div><span className="local-status"><Smartphone /> LOCAL GAME</span>{!online && <span className="local-status offline"><WifiOff /> OFFLINE</span>}<span>ROUND {game.roundNumber}</span></div><details><summary aria-label="Local host controls"><Settings2 /></summary><div><strong>HOST CONTROLS</strong>{onOpenDisplay && <button onClick={onOpenDisplay}><Monitor /> Open TV Display</button>}{onPause && liveRound && <button onClick={onPause}>{game.paused ? <Play /> : <Pause />} {game.paused ? 'Resume' : 'Pause'}</button>}{onSkip && ['clues', 'discussion'].includes(game.stage) && <button onClick={onSkip}><ArrowRight /> Skip / advance</button>}{onRestart && liveRound && <button onClick={onRestart}><RefreshCw /> Restart round</button>}{onAddBot && liveRound && <button onClick={onAddBot}><Bot /> Add bot next round</button>}{onTimerChange && liveRound && <><button onClick={() => onTimerChange(-15)}><Clock3 /> Timer −15s</button><button onClick={() => onTimerChange(15)}><Clock3 /> Timer +15s</button></>}{onRemoveBot && liveRound && removableBots.map((bot) => <button key={bot.id} onClick={() => onRemoveBot(bot.id)}><X /> Remove {bot.name} next round</button>)}{onEnd && game.stage !== 'match-complete' && <button onClick={onEnd}><Trophy /> End match</button>}</div></details></header>{notice && <div className="local-notice" role="status">{notice}</div>}</>;
}

function LocalClueTimer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    const timer = window.setInterval(() => setRemaining((value) => {
      if (value <= 1) { window.clearInterval(timer); window.setTimeout(onExpire, 0); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [onExpire]);
  return <span className="local-timer" aria-live="polite"><Clock3 /> {remaining}s</span>;
}

function LocalTurnOrder({ game }: { game: LocalGameState }) {
  return <div className="local-turn-order"><span>CLUE ORDER</span><ol>{game.turnOrder.map((id, index) => { const player = game.players.find((item) => item.id === id)!; return <li key={id} className={index === game.currentTurn ? 'current' : index < game.currentTurn ? 'done' : ''}><b>{index + 1}</b><span>{player.kind === 'bot' ? <Bot /> : player.name[0]}</span><strong>{player.name}</strong><small>{index === game.currentTurn ? 'NOW' : index === game.currentTurn + 1 ? 'NEXT' : index < game.currentTurn ? <Check /> : ''}</small></li>; })}</ol></div>;
}

function LocalBoard({ board, size }: { board: ({ id: string; display: string } | undefined)[]; size: number }) {
  return <WordBoard words={board.filter((word): word is { id: string; display: string } => Boolean(word))} size={size} />;
}

function LocalResult({ game, secret, goNext, onOpenDisplay }: { game: LocalGameState; secret: string; goNext: () => void; onOpenDisplay: () => void }) {
  const ranked = [...game.players].filter((player) => player.active).sort((a, b) => b.score - a.score);
  return <div className="local-game"><LocalGameHeader game={game} online={navigator.onLine} notice="" onOpenDisplay={onOpenDisplay} /><main className="local-stage"><section className="local-card local-result"><img src="/moley-mascot.png" alt="Moley mascot" /><span className="local-kicker">ROUND {game.roundNumber} COMPLETE</span><h1>{game.result?.headline}</h1><p>The secret word was <strong>{secret}</strong>. {game.players.filter((player) => game.moleIds.includes(player.id)).map((player) => player.name).join(' & ')} {game.moleIds.length === 1 ? 'was' : 'were'} the Mole.</p><div className="local-scoreboard">{ranked.map((player, index) => <div key={player.id}><b>{index + 1}</b><span>{player.kind === 'bot' ? <Bot /> : player.name[0]}</span><strong>{player.name}</strong><small>{player.roundGain ? `+${player.roundGain}` : '—'}</small><em>{player.score} pts</em></div>)}</div><button className="button button-lime button-xl" onClick={goNext}>Start next round <ArrowRight /></button></section></main></div>;
}

function localTone() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass(); const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.frequency.value = 360; gain.gain.setValueAtTime(.025, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .08);
    oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .09);
  } catch { /* Sound is optional. */ }
}
