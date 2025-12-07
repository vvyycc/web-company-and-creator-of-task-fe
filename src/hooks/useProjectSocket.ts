import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export function useProjectSocket(projectId: string | undefined, onEvent: (event: any) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const socket = io('http://localhost:4000', { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_project', projectId);
    });

    socket.on('task_updated', (data) => onEvent(data));
    socket.on('task_claimed', (data) => onEvent(data));
    socket.on('task_verified', (data) => onEvent(data));

    return () => {
      socket.disconnect();
    };
  }, [projectId, onEvent]);

  return socketRef.current;
}
