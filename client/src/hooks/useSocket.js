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
};

function getOrCreateSocket(token) {
  if (socketInstance && socketToken === token) return socketInstance;

  // Token changed or no socket yet — tear down old one and reconnect
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  const socket = io(window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('sms:received', (data) => {
    listeners['sms:received'].forEach((cb) => cb(data));
  });

  socket.on('number:expired', (data) => {
    listeners['number:expired'].forEach((cb) => cb(data));
  });

  socketInstance = socket;
  socketToken = token;
  return socket;
}

export const getSocket = () => socketInstance;

export const useSocket = (onSmsReceived, onNumberExpired) => {
  const { accessToken, user } = useAuthStore();
  const cbRef = useRef({ onSmsReceived, onNumberExpired });

  // Keep callbacks current without re-subscribing the effect
  useEffect(() => {
    cbRef.current = { onSmsReceived, onNumberExpired };
  });

  useEffect(() => {
    if (!accessToken || !user) return;

    const smsCb = (data) => cbRef.current.onSmsReceived?.(data);
    const expiredCb = (data) => cbRef.current.onNumberExpired?.(data);

    getOrCreateSocket(accessToken);
    listeners['sms:received'].add(smsCb);
    listeners['number:expired'].add(expiredCb);

    return () => {
      listeners['sms:received'].delete(smsCb);
      listeners['number:expired'].delete(expiredCb);
    };
  }, [accessToken, user]);
};
