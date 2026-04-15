import { useState, useCallback } from 'react';

const STORAGE_KEY = 'textlix_dismissed_orders';
const TTL_MS = 30 * 60 * 1000; // 30 minutes — matches backend window

function readDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Prune entries older than TTL
    const now = Date.now();
    const pruned = Object.fromEntries(
      Object.entries(parsed).filter(([, ts]) => now - ts < TTL_MS)
    );
    return pruned;
  } catch {
    return {};
  }
}

function writeDismissed(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export default function useDismissedOrders() {
  const [dismissed, setDismissed] = useState(() => readDismissed());

  const dismiss = useCallback((orderId) => {
    setDismissed((prev) => {
      const next = { ...prev, [orderId]: Date.now() };
      writeDismissed(next);
      return next;
    });
  }, []);

  const isDismissed = useCallback(
    (orderId) => Boolean(dismissed[orderId?.toString()]),
    [dismissed]
  );

  return { dismiss, isDismissed };
}
