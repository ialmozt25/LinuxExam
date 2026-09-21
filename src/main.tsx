import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { useQuizStore } from '@/store/quizStore';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// DEV-only escape hatch: run `window.__quizStore.getState().unlockPro()` in DevTools.
// Vite strips this block from the production build (import.meta.env.DEV === false).
if (import.meta.env.DEV) {
  window.__quizStore = useQuizStore;
}
