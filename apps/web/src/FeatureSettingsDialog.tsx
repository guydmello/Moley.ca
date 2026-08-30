import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Check, Download, Lock, Search, Share2, Upload, X } from 'lucide-react';
import { categories, words } from '@moley/word-packs';
import { customWordEntries, filterWordCatalog, validateConfiguration } from '@moley/game-core';
import { featureEnabled, modifiedSettingKeys, settingsForPreset, type GameSettings } from '@moley/shared';
import { useGame } from './store';
import { useDialogFocus } from './dialog';
import { encodePackWords } from './pack-codec';

const PRESETS: GameSettings['preset'][] = ['classic', 'online', 'party', 'quick', 'big-group', 'family', 'chaos', 'sweaty', 'custom'];
const LABELS: Partial<Record<keyof GameSettings, string>> = {
  clueMode: 'Clue mode', requiredClueRoundsBeforeVoting: 'Clue rounds before voting', guessMode: 'Mole guess', targetScore: 'Winning score', moleCount: 'Moles',
  boardEnabled: 'Board Play', boardSize: 'Board size',
  defenceSeconds: 'Defence phase', allowRevote: 'Optional revote', anonymousClues: 'Anonymous clues',
  privateNotebook: 'Private Mole notebook', confidenceVoting: 'Confidence voting', voteReveal: 'Vote reveal',
  spectatorPredictions: 'Spectator predictions', audienceReactions: 'Audience reactions', secretReactions: 'Secret reactions',
  chaosMode: 'Chaos modifiers', showIcebreakers: 'Lobby icebreakers', afkAutopilot: 'AFK bot autopilot'
};

export function FeatureSettingsDialog({ onClose }: { onClose: () => void }) {
  const [dialogRef, onDialogKeyDown] = useDialogFocus<HTMLElement>(onClose);
  const { room, me, send } = useGame();
  const editableSettings = me?.hostSettings ?? room?.settings ?? settingsForPreset('classic');
  const [draft, setDraft] = useState(editableSettings);
  const [query, setQuery] = useState('');
  const [customText, setCustomText] = useState(editableSettings.customWords.join('\n'));
  const importRef = useRef<HTMLInputElement>(null);
  const summary = useMemo(() => [draft.clueMode, `${draft.requiredClueRoundsBeforeVoting} clue round${draft.requiredClueRoundsBeforeVoting === 1 ? '' : 's'}`, draft.boardEnabled ? `${draft.boardSize}×${draft.boardSize} board` : null, draft.moleCount ? `${draft.moleCount} Moles` : 'Auto Moles', draft.targetScore ? `First to ${draft.targetScore}` : 'Endless', draft.defenceSeconds ? `${draft.defenceSeconds}s defence` : null, draft.chaosMode ? 'Chaos on' : null].filter(Boolean).join(' · '), [draft]);
  if (!room) return null;
  const update = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const visible = (label: string) => !query || label.toLocaleLowerCase('en-CA').includes(query.toLocaleLowerCase('en-CA'));
  const modified = modifiedSettingKeys(draft).map((key) => LABELS[key] ?? String(key));
  const customWords = customText.split(/\n|,/).map((word) => word.trim()).filter(Boolean);
  const duplicates = customWords.filter((word, index, all) => all.findIndex((item) => item.toLocaleLowerCase('en-CA').replace(/s$/, '') === word.toLocaleLowerCase('en-CA').replace(/s$/, '')) !== index);
  const availableWords = [...filterWordCatalog(words, draft), ...filterWordCatalog(customWordEntries(customWords, 'draft-custom'), draft)];
  const configuration = validateConfiguration(draft, { availableWords, fallbackBotWords: words, botCount: room.players.filter((player) => player.kind === 'bot').length, offline: false });

  const save = () => {
    send({ type: 'update_settings', settings: { ...draft, customWords } });
    localStorage.setItem('moley:settings', JSON.stringify({ ...draft, customWords }));
    onClose();
  };
  const exportPack = async () => {
    const payload = JSON.stringify({ format: 'moley-pack', version: 1, name: 'My Moley pack', words: customWords }, null, 2);
    const file = new File([payload], 'moley-pack.json', { type: 'application/json' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: 'Moley word pack', files: [file] });
    else { const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = file.name; link.click(); URL.revokeObjectURL(link.href); }
  };
  const importPack = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file || file.size > 100_000) return;
    try { const payload = JSON.parse(await file.text()) as { format?: string; words?: unknown }; if (payload.format === 'moley-pack' && Array.isArray(payload.words)) setCustomText(payload.words.filter((word): word is string => typeof word === 'string').slice(0, 1000).join('\n')); } catch { /* Invalid packs leave the draft untouched. */ }
  };
  const sharePack = async () => {
    const data = encodePackWords(customWords);
    const url = `${location.origin}/?pack=${encodeURIComponent(data)}`;
    if (navigator.share) await navigator.share({ title: 'Moley word pack', url }); else await navigator.clipboard.writeText(url);
  };

  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} onKeyDown={onDialogKeyDown} role="dialog" aria-modal="true" aria-labelledby="settings-title" className="game-dialog dialog-wide feature-settings">
      <button className="dialog-close" onClick={onClose} aria-label="Close settings"><X /></button>
      <div className="settings-head"><div><span className="section-kicker">HOST CONTROLS</span><h2 id="settings-title">Game setup</h2><p className="config-summary">{summary}</p></div><button className={`lock-toggle ${draft.locked ? 'active' : ''}`} onClick={() => update('locked', !draft.locked)}><Lock /> {draft.locked ? 'Locked' : 'Room open'}</button></div>
      <label className="settings-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search settings…" /></label>
      {visible('Presets') && <><label className="settings-label">PRESETS</label><div className="settings-presets expanded">{PRESETS.map((preset) => <button key={preset} className={draft.preset === preset ? 'active' : ''} onClick={() => setDraft(preset === 'custom' ? { ...draft, preset } : settingsForPreset(preset))}><strong>{preset === 'big-group' ? 'Big Group' : preset.charAt(0).toUpperCase() + preset.slice(1)}</strong><span>{preset === 'classic' ? 'Simple original flow' : preset === 'quick' ? 'Short and snappy' : preset === 'family' ? 'Easy, family-safe words' : preset === 'chaos' ? 'Wild round modifiers' : preset === 'sweaty' ? 'Hard, strategic rounds' : 'Purpose-built setup'}</span></button>)}</div></>}
      {modified.length > 0 && <div className="modified-summary"><strong>Modified preset</strong><span>{modified.slice(0, 6).join(', ')}{modified.length > 6 ? ` +${modified.length - 6}` : ''}</span></div>}
      {visible('Core clue mode guess winning score moles difficulty content') && <section className="settings-section"><h3>Core game</h3><div className="settings-grid">
        <Select label="Clue mode" value={draft.clueMode} onChange={(value) => update('clueMode', value as GameSettings['clueMode'])} options={[['spoken','Spoken aloud'],['typed','Typed privately'],['emoji','Emoji only'],['drawing','Drawing canvas']].filter(([value]) => value !== 'drawing' || featureEnabled(room.featureFlags, 'drawing'))} />
        <Select label="Clue rounds before voting" value={String(draft.requiredClueRoundsBeforeVoting)} onChange={(value) => update('requiredClueRoundsBeforeVoting', Number(value))} options={[1,2,3,4,5].map((count) => [String(count), String(count) + (count === 1 ? ' round' : ' rounds')])} />
        <Select label="Mole guess" value={draft.guessMode} onChange={(value) => update('guessMode', value as GameSettings['guessMode'])} options={[['typed','Typed privately'],['spoken','Spoken + judged']]} />
        <Select label="Winning score" value={draft.targetScore === null ? 'endless' : String(draft.targetScore)} onChange={(value) => update('targetScore', value === 'endless' ? null : Number(value))} options={[['3','3 points'],['5','5 points'],['7','7 points'],['10','10 points'],['endless','Endless']]} />
        <Select label="Moles" value={draft.moleCount === null ? 'auto' : String(draft.moleCount)} onChange={(value) => update('moleCount', value === 'auto' ? null : Number(value))} options={[['auto','Automatic'],['1','1 Mole'],['2','2 Moles'],['3','3 Moles'],['4','4 Moles']]} />
        <Select label="Word difficulty" value={draft.wordDifficulty} onChange={(value) => update('wordDifficulty', value as GameSettings['wordDifficulty'])} options={[['mixed','Mixed'],['easy','Easy'],['medium','Medium'],['hard','Hard']]} />
        <Select label="Content level" value={draft.contentLevel} onChange={(value) => update('contentLevel', value as GameSettings['contentLevel'])} options={[['family','Family'],['teen','Teen'],['anything','Anything']]} />
      </div></section>}
      {visible('Board play size grid words') && <section className="settings-section"><h3>Board Play</h3><Toggle label="Use a public word board" text="The server creates one canonical board for players, reconnects, spectators, and TV Display." checked={draft.boardEnabled} set={(value) => update('boardEnabled', value)} /><div className="settings-grid"><Select label="Board size" value={String(draft.boardSize)} onChange={(value) => update('boardSize', Number(value))} options={[5,6,7,8,9,10].map((size) => [String(size), `${size} × ${size} · ${size ** 2} words`])} /></div>{configuration.errors.map((error) => <div className="form-error" role="alert" key={error}>{error}</div>)}{configuration.warnings.map((warning) => <p className="config-summary" key={warning}>{warning}</p>)}</section>}
      {visible('Voting defence revote confidence reveal anonymous reactions') && <section className="settings-section"><h3>Voting & drama</h3><div className="settings-grid"><Select label="Defence phase" value={String(draft.defenceSeconds)} onChange={(value) => update('defenceSeconds', Number(value))} options={[['0','Off'],['15','15 seconds'],['30','30 seconds'],['60','60 seconds']]} /><Select label="Vote reveal" value={draft.voteReveal} onChange={(value) => update('voteReveal', value as GameSettings['voteReveal'])} options={[['all-at-once','All at once'],['incremental','One by one'],['anonymous','Anonymous totals']]} /></div><Toggle label="Allow one revote" text="After the accused players defend themselves." checked={draft.allowRevote} set={(value) => update('allowRevote', value)} disabled={!draft.defenceSeconds} /><Toggle label="Confidence voting" text="Choose unsure, confident, or certain with each vote." checked={draft.confidenceVoting} set={(value) => update('confidenceVoting', value)} /><Toggle label="Secret reactions" text="Bounded reactions reveal in the round recap." checked={draft.secretReactions} set={(value) => update('secretReactions', value)} /></section>}
      {visible('Clues anonymous notebook forbidden emoji drawing') && <section className="settings-section"><h3>Clue variants</h3><Toggle label="Anonymous clues" text="Hide clue authors until the round ends." checked={draft.anonymousClues} set={(value) => update('anonymousClues', value)} /><Toggle label="Private notebook" text="Each player gets a private, server-stored scratchpad." checked={draft.privateNotebook} set={(value) => update('privateNotebook', value)} /><label className="field"><span>Forbidden clue words · comma separated</span><input value={draft.forbiddenClueWords.join(', ')} onChange={(event) => update('forbiddenClueWords', event.target.value.split(',').map((word) => word.trim()).filter(Boolean).slice(0, 40))} /></label></section>}
      {visible('Audience spectator predictions reactions') && featureEnabled(room.featureFlags, 'audience') && <section className="settings-section"><h3>Audience</h3><Toggle label="Spectator predictions" text="Spectators predict before voting closes; only totals reveal later." checked={draft.spectatorPredictions} set={(value) => update('spectatorPredictions', value)} disabled={!featureEnabled(room.featureFlags, 'spectatorPredictions')} /><Toggle label="Audience reactions" text="Let spectators react without affecting the game." checked={draft.audienceReactions} set={(value) => update('audienceReactions', value)} /></section>}
      {visible('Party chaos icebreakers afk autopilot theme') && <section className="settings-section"><h3>Party controls</h3><Toggle label="Chaos modifiers" text="One announced modifier per round." checked={draft.chaosMode} set={(value) => update('chaosMode', value)} disabled={!featureEnabled(room.featureFlags, 'chaos')} /><Toggle label="Lobby icebreakers" text="Show rotating prompts while people join." checked={draft.showIcebreakers} set={(value) => update('showIcebreakers', value)} /><Toggle label="AFK bot autopilot" text="Keep a disconnected seat moving until its human returns." checked={draft.afkAutopilot} set={(value) => update('afkAutopilot', value)} /><Select label="Room theme" value={draft.roomTheme} onChange={(value) => update('roomTheme', value as GameSettings['roomTheme'])} options={[['classic','Classic'],['northern-lights','Northern Lights'],['campfire','Campfire'],['arcade','Arcade'],['ice-rink','Ice Rink']]} /></section>}
      {visible('Custom pack import export share categories blacklist recent') && featureEnabled(room.featureFlags, 'customPacks') && <section className="settings-section"><h3>Words & custom packs</h3><label className="field"><span>Custom pack · one word or phrase per line</span><textarea rows={6} value={customText} onChange={(event) => setCustomText(event.target.value)} placeholder={'Campfire\nCanoe\nMarshmallow'} /></label>{duplicates.length > 0 && <div className="form-error">Possible duplicates: {duplicates.slice(0, 5).join(', ')}</div>}<div className="pack-actions"><button className="button button-light" onClick={() => importRef.current?.click()}><Upload /> Import</button><button className="button button-light" disabled={!customWords.length} onClick={exportPack}><Download /> Export</button><button className="button button-light" disabled={!customWords.length} onClick={sharePack}><Share2 /> Share link</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={importPack} /></div><label className="field"><span>Word blacklist · comma separated</span><input value={draft.wordBlacklist.join(', ')} onChange={(event) => update('wordBlacklist', event.target.value.split(',').map((word) => word.trim()).filter(Boolean).slice(0, 200))} /></label><div className="category-picker"><span>Categories · {draft.categories.length ? `${draft.categories.length} selected` : 'All'}</span><div>{categories.map((category) => <button className={draft.categories.includes(category.name) ? 'active' : ''} key={category.name} onClick={() => update('categories', draft.categories.includes(category.name) ? draft.categories.filter((name) => name !== category.name) : [...draft.categories, category.name])}>{category.name}<small>{category.count}</small></button>)}</div></div></section>}
      {visible('Crowd pack') && featureEnabled(room.featureFlags, 'customPacks') && <section className="settings-section"><h3>Crowd pack</h3><Toggle label="Player word submissions" text="Each player can privately add one validated word in the lobby." checked={draft.crowdPack} set={(value) => update('crowdPack', value)} />{meCrowdWords(room, useGame.getState().me?.crowdWords ?? [])}</section>}
      <div className="settings-save"><span><strong>Game summary</strong>{summary}</span><button className="button button-primary" onClick={save} disabled={configuration.errors.length > 0}><Check /> Save settings</button></div>
    </section>
  </div>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label className="setting-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}</select></label>; }
function Toggle({ label, text, checked, set, disabled = false }: { label: string; text: string; checked: boolean; set: (value: boolean) => void; disabled?: boolean }) { return <button className="toggle-row" disabled={disabled} onClick={() => set(!checked)}><div><strong>{label}</strong><span>{text}{disabled ? ' Requires its related setting or feature flag.' : ''}</span></div><span className={`switch ${checked ? 'on' : ''}`}><i /></span></button>; }
function meCrowdWords(_room: unknown, words: string[]) { return words.length ? <p className="config-summary">Ready: {words.join(', ')}</p> : <p className="config-summary">No player words submitted yet.</p>; }
