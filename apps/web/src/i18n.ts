export type Locale = 'en-CA' | 'fr-CA';

const messages = {
  'en-CA': {
    options: 'Moley options', whatsNew: 'What’s new', accessibility: 'Accessibility',
    gameHealth: 'Game health', createGame: 'Create game', joinGame: 'Join game',
    secretSafe: 'Secrets stay secret.'
  },
  'fr-CA': {
    options: 'Options Moley', whatsNew: 'Nouveautés', accessibility: 'Accessibilité',
    gameHealth: 'État du jeu', createGame: 'Créer une partie', joinGame: 'Rejoindre',
    secretSafe: 'Les secrets restent secrets.'
  }
} as const;

export type MessageKey = keyof typeof messages['en-CA'];
export function locale(): Locale { return localStorage.getItem('moley:locale') === 'fr-CA' ? 'fr-CA' : 'en-CA'; }
export function t(key: MessageKey, language: Locale = locale()): string { return messages[language][key]; }
