const KEY = 'textlix_recent_services';
const MAX = 4;

export function useRecentServices() {
  const getRecent = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  };

  const addRecent = (slug, name, emoji) => {
    const prev = getRecent().filter((s) => s.slug !== slug);
    const next = [{ slug, name, emoji }, ...prev].slice(0, MAX);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  };

  return { recent: getRecent(), addRecent };
}
