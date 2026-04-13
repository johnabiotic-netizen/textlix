import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';

let socketInstance = null;

export const getSocket = () => socketInstance;

export const useSocket = (onSmsReceived, onNumberExpired) => {
  const { accessToken, user } = useAuthStore();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!accessToken || !user) return;

    const socket = io(window.location.origin, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });

    socketInstance = socket;
    socketRef.current = socket;

    socket.on('sms:received', (data) => {
      onSmsReceived?.(data);
    });

    socket.on('number:expired', (data) => {
      onNumberExpired?.(data);
    });

    return () => {
      socket.disconnect();
      socketInstance = null;
    };
  }, [accessToken, user]);

  return socketRef.current;
};
