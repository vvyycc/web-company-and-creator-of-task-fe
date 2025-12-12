import { useEffect } from 'react';
import { io } from 'socket.io-client';

type TaskUpdatedEvent = {
  projectId: string;
  task: any;
};

export function useProjectSocket(
  projectId: string | undefined,
  onTaskUpdate: (task: any) => void
) {
  useEffect(() => {
    if (!projectId) return;

    const socketUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const socket = io(socketUrl, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      socket.emit('join_project', projectId);
    });

    socket.on('task_updated', (event: TaskUpdatedEvent) => {
      if (event?.projectId === projectId) {
        onTaskUpdate(event.task);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId, onTaskUpdate]);
}
