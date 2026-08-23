import { useEffect, useMemo, useState } from 'react';
import { Activity, Accessibility, Check, Download, Eye, Globe2, Info, Settings2, Share2, X } from 'lucide-react';
import { APP_VERSION, PROTOCOL_VERSION } from '@moley/shared';
import { useGame } from './store';

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function UtilityMenu({ onTutorial }: { onTutorial?: () => void }) {
  const { room, connection, latencyMs, runtime } = useGame();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'access' | 'health' | 'new'>('new');
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [font, setFont] = useState(() => Number(localStorage.getItem('moley:font-scale') ?? 1));
  const [contrast, setContrast] = useState(() => localStorage.getItem('moley:contrast') === 'high');
  const [motion, setMotion] = useState(() => localStorage.getItem('moley:reduce-motion') === 'true');
  const [locale, setLocale] = useState(() => localStorage.getItem('moley:locale') ?? 'en-CA');
  useEffect(() => { const capture = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); }; addEventListener('beforeinstallprompt', capture); return () => removeEventListener('beforeinstallprompt', capture); }, []);
  useEffect(() => { document.documentElement.style.setProperty('--font-scale', String(font)); document.documentElement.dataset.contrast = contrast ? 'high' : ''; document.documentElement.dataset.reduceMotion = String(motion); localStorage.setItem('moley:font-scale', String(font)); localStorage.setItem('moley:contrast', contrast ? 'high' : ''); localStorage.setItem('moley:reduce-motion', String(motion)); }, [font, contrast, motion]);
  const health = useMemo(() => ({ version: APP_VERSION, protocol: PROTOCOL_VERSION, connection, latency: latencyMs === null ? 'unknown' : `${latencyMs}ms`, online: navigator.onLine, serviceWorker: 'serviceWorker' in navigator, wakeLock: 'wakeLock' in navigator, roomStage: room?.stage ?? 'none', seats: room?.players.length ?? 0 }), [connection, latencyMs, room]);
  const supportCode = btoa(JSON.stringify({
    version: APP_VERSION,
    protocol: PROTOCOL_VERSION,
    connection,
    latency: latencyMs === null ? 'unknown' : latencyMs < 180 ? 'good' : latencyMs < 450 ? 'fair' : 'slow',
    online: navigator.onLine,
    serviceWorker: 'serviceWorker' in navigator,
    wakeLock: 'wakeLock' in navigator
  })).replace(/=+$/, '').slice(0, 180);
  const french = locale === 'fr-CA';
  const setLanguage = (value: string) => { setLocale(value); localStorage.setItem('moley:locale', value); document.documentElement.lang = value; };
  return <div className="utility-menu"><button className="utility-trigger" onClick={() => setOpen(!open)} aria-label="Moley options"><Settings2 /></button>{open && <aside className="utility-panel" aria-label="Moley options"><header><strong>{french ? 'Options Moley' : 'Moley options'}</strong><button onClick={() => setOpen(false)} aria-label="Close"><X /></button></header><nav><button className={tab === 'new' ? 'active' : ''} onClick={() => setTab('new')}><Info /> New</button><button className={tab === 'access' ? 'active' : ''} onClick={() => setTab('access')}><Accessibility /> Access</button><button className={tab === 'health' ? 'active' : ''} onClick={() => setTab('health')}><Activity /> Health</button></nav>
      {tab === 'new' && <section><span className="section-kicker">WHAT’S NEW</span><h3>{runtime?.release.title ?? 'Replayability upgrade'}</h3><p>{runtime?.release.publishedAt ?? '2026-08-23'}</p><ul>{(runtime?.release.highlights ?? ['New clue modes', 'Defence and recaps', 'New party presets']).map((item) => <li key={item}><Check /> {item}</li>)}</ul>{install && <button className="button button-lime button-wide" onClick={async () => { await install.prompt(); await install.userChoice; setInstall(null); }}><Download /> Install Moley app</button>}<button className="button button-light button-wide" onClick={onTutorial}><Eye /> Interactive rules demo</button><small>Seasonal cosmetics are visual only and never affect scoring.</small></section>}
      {tab === 'access' && <section><span className="section-kicker">ACCESSIBILITY</span><label>Language<select value={locale} onChange={(event) => setLanguage(event.target.value)}><option value="en-CA">English (Canada)</option><option value="fr-CA">Français (Canada) · bêta</option></select></label><label>Text size<input type="range" min="0.9" max="1.3" step="0.1" value={font} onChange={(event) => setFont(Number(event.target.value))} /></label><button className={`toggle-row ${contrast ? 'active' : ''}`} onClick={() => setContrast(!contrast)}><div><strong>High contrast</strong><span>Stronger borders and focus.</span></div><span className={`switch ${contrast ? 'on' : ''}`}><i /></span></button><button className={`toggle-row ${motion ? 'active' : ''}`} onClick={() => setMotion(!motion)}><div><strong>Reduce motion</strong><span>Minimize transitions and animation.</span></div><span className={`switch ${motion ? 'on' : ''}`}><i /></span></button><p><Globe2 /> Player symbols supplement colour throughout voting and rosters.</p></section>}
      {tab === 'health' && <section><span className="section-kicker">GAME HEALTH</span><h3>{connection === 'connected' ? 'Tunnel looks healthy' : 'Reconnecting safely'}</h3><dl>{Object.entries(health).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl><button className="button button-light button-wide" onClick={() => navigator.clipboard.writeText(`MOLEY-${supportCode}`)}><Share2 /> Copy support code</button><small>The support code excludes names, room codes, words, roles, votes, chat and device identifiers.</small></section>}
    </aside>}</div>;
}
