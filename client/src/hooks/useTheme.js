import { useState, useEffect } from 'react';

// Module-level singleton so all components share the same dark state
let _listeners = [];
let _dark = (() => {
  try {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch { return false; }
})();

function applyTheme(dark) {
  _dark = dark;
  const root = document.documentElement;
  if (dark) {
    root.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  } else {
    root.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }
  _listeners.forEach((fn) => fn(dark));
}

export default function useTheme() {
  const [dark, setDark] = useState(_dark);

  useEffect(() => {
    const handler = (d) => setDark(d);
    _listeners.push(handler);
    return () => { _listeners = _listeners.filter((l) => l !== handler); };
  }, []);

  return { dark, toggle: () => applyTheme(!_dark) };
}
