import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { env } from '../config/env';
import { auth } from '../config/auth';

export type SocketContextValue = {
  socket: Socket;
  refreshSocketAuth: () => void;
};

const SocketContext = createContext<SocketContextValue | null>(null);

/**
 * Una sola instancia de Socket.io por árbol React (reconexión y auth alineados con auth.getToken()).
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);

  if (!socketRef.current) {
    socketRef.current = io(env.socketUrl, {
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: auth.getToken() || undefined }),
      reconnection: true,
      reconnectionDelay: env.socketReconnectDelayMs,
      reconnectionDelayMax: Math.max(env.socketReconnectDelayMs * 10, 10_000),
      reconnectionAttempts: env.socketReconnectAttempts,
      timeout: Math.max(env.requestTimeoutMs, 10_000),
      autoConnect: false
    });
  }

  const value = useMemo(
    () => ({
      socket: socketRef.current as Socket,
      refreshSocketAuth: () => {
        const s = socketRef.current;
        if (s) {
          s.auth = { token: auth.getToken() || undefined };
        }
      }
    }),
    []
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error('useSocket debe usarse dentro de SocketProvider');
  }
  return ctx;
}
