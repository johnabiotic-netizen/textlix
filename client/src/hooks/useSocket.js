import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';

// Shared singleton connection — all components share one socket
let socketInstance = null;
let socketToken = null;

// Per-event listener registries so multiple components can subscribe
const listeners = {
  'sms:received': new Set(),
  'number:expired': new Set(),
  'payment:completed': new Set(),
  'support:message': new Set(),
  'support:resolved': new Set(),
  'support:new': new Set(),
  'support:escalated': new Set(),
  'support:claimed': new Set(),
  'support:released': new Set(),
};

function getOrCreateSocket(token) {
  if (socketInstance && socketToken === token) return socketInstance;

  // Token changed or no socket yet — tear down old one and reconnect
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  // The Socket.io server lives on the API host (e.g. api.textlix.com), NOT the
  // page origin (www.textlix.com). Connect to VITE_API_URL in prod; locally
  // VITE_API_URL is unset so we hit the page origin and Vite proxies /socket.io.
  const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
  const socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });

  socket.on('sms:received', (data) => {
    listeners['sms:received'].forEach((cb) => cb(data));
  });

  socket.on('number:expired', (data) => {
    listeners['number:expired'].forEach((cb) => cb(data));
  });

  socket.on('payment:completed', (data) => {
    listeners['payment:completed'].forEach((cb) => cb(data));
  });

  socket.on('support:message', (data) => {
    listeners['support:message'].forEach((cb) => cb(data));
  });

  socket.on('support:resolved', (data) => {
    listeners['support:resolved'].forEach((cb) => cb(data));
  });

  socket.on('support:new', (data) => {
    listeners['support:new'].forEach((cb) => cb(data));
  });

  socket.on('support:escalated', (data) => {
    listeners['support:escalated'].forEach((cb) => cb(data));
  });

  socket.on('support:claimed', (data) => {
    listeners['support:claimed'].forEach((cb) => cb(data));
  });

  socket.on('support:released', (data) => {
    listeners['support:released'].forEach((cb) => cb(data));
  });

  socketInstance = socket;
  socketToken = token;
  return socket;
}

export const getSocket = () => socketInstance;

// Subscribe to live support-chat events (AI/agent replies, resolution). Reuses
// the same singleton socket — no extra connection. Safe to mount/unmount with
// the chat panel.
export const useSupportSocket = (onMessage, onResolved) => {
  const { accessToken, user } = useAuthStore();
  const cbRef = useRef({ onMessage, onResolved });
  useEffect(() => {
    cbRef.current = { onMessage, onResolved };
  });
  useEffect(() => {
    if (!accessToken || !user) return;
    const msgCb = (data) => cbRef.current.onMessage?.(data);
    const resCb = (data) => cbRef.current.onResolved?.(data);
    getOrCreateSocket(accessToken);
    listeners['support:message'].add(msgCb);
    listeners['support:resolved'].add(resCb);
    return () => {
      listeners['support:message'].delete(msgCb);
      listeners['support:resolved'].delete(resCb);
    };
  }, [accessToken, user]);
};

// Admin-side: fires whenever any user sends a new message or a chat escalates.
// Admins are auto-joined to the admin:support room server-side on connect.
export const useAdminSupportSocket = (onActivity) => {
  const { accessToken, user } = useAuthStore();
  const cbRef = useRef(onActivity);
  useEffect(() => { cbRef.current = onActivity; });
  useEffect(() => {
    if (!accessToken || !user) return;
    const cb = (data) => cbRef.current?.(data);
    getOrCreateSocket(accessToken);
    listeners['support:new'].add(cb);
    listeners['support:escalated'].add(cb);
    listeners['support:claimed'].add(cb);
    listeners['support:released'].add(cb);
    return () => {
      listeners['support:new'].delete(cb);
      listeners['support:escalated'].delete(cb);
      listeners['support:claimed'].delete(cb);
      listeners['support:released'].delete(cb);
    };
  }, [accessToken, user]);
};

export const useSocket = (onSmsReceived, onNumberExpired, onPaymentCompleted) => {
  const { accessToken, user } = useAuthStore();
  const cbRef = useRef({ onSmsReceived, onNumberExpired, onPaymentCompleted });

  // Keep callbacks current without re-subscribing the effect
  useEffect(() => {
    cbRef.current = { onSmsReceived, onNumberExpired, onPaymentCompleted };
  });

  useEffect(() => {
    if (!accessToken || !user) return;

    const smsCb = (data) => cbRef.current.onSmsReceived?.(data);
    const expiredCb = (data) => cbRef.current.onNumberExpired?.(data);
    const paymentCb = (data) => cbRef.current.onPaymentCompleted?.(data);

    getOrCreateSocket(accessToken);
    listeners['sms:received'].add(smsCb);
    listeners['number:expired'].add(expiredCb);
    listeners['payment:completed'].add(paymentCb);

    return () => {
      listeners['sms:received'].delete(smsCb);
      listeners['number:expired'].delete(expiredCb);
      listeners['payment:completed'].delete(paymentCb);
    };
  }, [accessToken, user]);
};
