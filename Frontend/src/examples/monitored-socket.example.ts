// Example: Monitoring socket.io events
import { io, Socket } from 'socket.io-client';
import { env } from '../config/env';
import { trackSocketEvent, trackAction } from '../utils/monitoring';
import { captureException } from '../utils/logger';

let socket: Socket | null = null;

export const initSocket = (token: string) => {
  if (socket) return socket;

  socket = io(env.socketUrl, {
    auth: { token },
    transports: ['websocket'],
  });

  // Track connection events
  socket.on('connect', () => {
    trackSocketEvent('connect', { 
      socket_id: socket!.id,
      transport: socket!.io.engine.transport.name 
    });
  });

  socket.on('disconnect', (reason) => {
    trackSocketEvent('disconnect', { reason });
  });

  socket.on('connect_error', (error) => {
    trackSocketEvent('connect_error', { error: error.message });
    captureException(error, { context: 'socket_connect' });
  });

  // Track custom events
  socket.on('message', (data) => {
    trackSocketEvent('message_received', {
      message_id: data.id,
      from_user: data.from,
      has_attachment: !!data.attachment,
    });
  });

  socket.on('typing', (data) => {
    trackSocketEvent('typing', { user_id: data.userId });
  });

  return socket;
};

export const sendMessage = (message: string) => {
  if (!socket) return;

  const start = performance.now();
  
  socket.emit('send_message', { message }, (ack: any) => {
    const duration = performance.now() - start;
    
    trackAction('send_message', {
      message_length: message.length,
      response_time_ms: duration,
      success: ack.success,
    });
  });
};

// Usage example:
// import { initSocket, sendMessage } from '@/services/monitored-socket';
// const socket = initSocket(token);
// sendMessage('Hello!');
// All socket events automatically tracked
