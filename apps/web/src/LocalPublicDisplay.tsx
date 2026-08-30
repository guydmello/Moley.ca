import { useEffect, useState } from 'react';
import { Bot, Check, Eye, Lock, Monitor, RefreshCw, Trophy, UserRound } from 'lucide-react';
import type { LocalPublicDisplayState } from '@moley/game-core';
import { readLocalDisplay, subscribeLocalDisplay } from './local-display';
import { WordBoard } from './WordBoard';

export function LocalPublicDisplay({ sessionId, go }: { sessionId: string; go: (path: string) => void }) {
  const [snapshot, setSnapshot] = useState<LocalPublicDisplayState | null>(() => readLocalDisplay(sessionId));
  const [now, setNow] = useState(0);
  useEffect(() => subscribeLocalDisplay(sessionId, setSnapshot), [sessionId]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 2_000); return () => window.clearInterval(timer); }, []);

  if (!snapshot) return <div className="local-display-page"><DisplayHeader go={go} /><main className="local-display-wait"><RefreshCw className="spin" /><span>LOCAL PUBLIC DISPLAY</span><h1>Waiting for the host device…</h1><p>Open Host Controls in the local game and choose Open TV Display.</p></main></div>;

  const players = snapshot.players;
  const player = (id: string) => players.find((candidate) => candidate.id === id);
  const current = player(snapshot.turnOrder[snapshot.currentTurn] ?? '');
  const stale = now - snapshot.updatedAt > 15_000;
  const ranked = [...players].sort((a, b) => b.score - a.score);

  let content;
  if (snapshot.paused) content = <PublicNotice icon={<Lock />} kicker="LOCAL GAME PAUSED" title="Everything is safely saved." text="The host will resume when the room is ready." />;
  else if (snapshot.stage === 'roles') content = <PublicNotice icon={<Eye />} kicker="PRIVATE" title="Roles are being checked." text="Look only at the host device when it is passed to you." />;
  else if (snapshot.stage === 'clues') content = <div className="local-display-grid"><section><span className="local-kicker">GAME ROUND {snapshot.roundNumber} · CLUE ROUND {snapshot.currentClueRound} OF {snapshot.requiredClueRoundsBeforeVoting}</span><h1>{current?.name ?? 'Next player'} is up.</h1><p>Turn {snapshot.currentTurn + 1} of {snapshot.turnOrder.length}. Listen closely—every clue matters.</p><WordBoard words={snapshot.board} size={snapshot.boardSize} /></section><PublicClues snapshot={snapshot} /></div>;
  else if (snapshot.stage === 'discussion') content = <div className="local-display-grid"><section><span className="local-kicker">DISCUSSION</span><h1>Who sounds suspicious?</h1><p>Question broad clues. Protect the secret.</p><WordBoard words={snapshot.board} size={snapshot.boardSize} /></section><PublicClues snapshot={snapshot} discussion /></div>;
  else if (snapshot.stage === 'voting') content = <PublicNotice icon={<Lock />} kicker="PRIVATE VOTING" title="Pass the host device." text={`${snapshot.voteCount} of ${players.length} votes are locked. Choices stay off this screen.`} />;
  else if (snapshot.stage === 'guess') {
    const accused = snapshot.accusedIds.map((id) => player(id)?.name).filter(Boolean).join(' & ');
    content = <PublicNotice icon={<Eye />} kicker="ONE LAST CHANCE" title="The Mole is making a final guess." text={`${accused || 'The accused player'} gets one private chance before the word is revealed.`} />;
  } else if (snapshot.stage === 'result' && snapshot.result) content = <section className="local-display-result"><img src="/moley-mascot.png" alt="Moley mascot" /><span className="local-kicker">GAME ROUND {snapshot.roundNumber} COMPLETE</span><h1>{snapshot.result.headline}</h1>{Object.entries(snapshot.result.moleGuesses).map(([id, guess]) => <p key={id}><strong>{player(id)?.name}'s Final Guess:</strong> {guess}</p>)}<p>The secret word was</p><strong className="local-display-secret">{snapshot.result.secretWord}</strong><DisplayScores players={ranked} /></section>;
  else if (snapshot.stage === 'match-complete') {
    const high = ranked[0]?.score ?? 0; const winners = ranked.filter((entry) => entry.score === high);
    content = <section className="local-display-result"><Trophy /><span className="local-kicker">MATCH COMPLETE · {snapshot.roundNumber} ROUNDS</span><h1>{winners.map((entry) => entry.name).join(' & ')} {winners.length === 1 ? 'wins!' : 'win!'}</h1><DisplayScores players={ranked} /></section>;
  } else content = <PublicNotice icon={<Monitor />} kicker="LOCAL PUBLIC DISPLAY" title="Ready for the next round." text="The host device controls setup and all private actions." />;

  return <div className="local-display-page"><DisplayHeader go={go} /><div className={`local-display-sync ${stale ? 'stale' : ''}`} role="status"><span /> {stale ? 'Waiting for host updates' : 'LIVE FROM HOST DEVICE'}</div><main>{content}</main></div>;
}

function DisplayHeader({ go }: { go: (path: string) => void }) { return <header className="local-display-header"><button onClick={() => go('/')} aria-label="Moley home"><Eye /> MOLEY<span>.CA</span></button><strong><Monitor /> TV DISPLAY · PUBLIC ONLY</strong></header>; }

function PublicNotice({ icon, kicker, title, text }: { icon: React.ReactNode; kicker: string; title: string; text: string }) { return <section className="local-display-wait">{icon}<span>{kicker}</span><h1>{title}</h1><p>{text}</p></section>; }

function PublicClues({ snapshot, discussion = false }: { snapshot: LocalPublicDisplayState; discussion?: boolean }) { return <aside className="local-display-clues"><h2>{discussion ? 'Clues & bot discussion' : 'Public clues'}</h2>{snapshot.turnOrder.map((id, index) => { const player = snapshot.players.find((entry) => entry.id === id); return player ? <div key={id} className={index === snapshot.currentTurn && !discussion ? 'current' : ''}><span>{player.kind === 'bot' ? <Bot /> : <UserRound />}</span><strong>{player.name}</strong><em>{snapshot.clues[id] ? `“${snapshot.clues[id]}”` : index === snapshot.currentTurn ? 'NOW' : 'WAITING'}</em>{snapshot.clues[id] && <Check />}</div> : null; })}{discussion && snapshot.discussion.map((line) => <p key={line}>{line}</p>)}</aside>; }

function DisplayScores({ players }: { players: LocalPublicDisplayState['players'] }) { return <div className="local-scoreboard local-display-scores">{players.map((player, index) => <div key={player.id}><b>{index + 1}</b><span>{player.kind === 'bot' ? <Bot /> : player.name[0]}</span><strong>{player.name}</strong><small>{player.roundGain ? `+${player.roundGain}` : '—'}</small><em>{player.score} pts</em></div>)}</div>; }
