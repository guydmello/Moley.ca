import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './local.css';
import './local-privacy.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
