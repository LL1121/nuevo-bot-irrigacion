// Configuración de URLs del backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export const config = {
  apiUrl: API_BASE_URL,
  socketUrl: SOCKET_URL,
  endpoints: {
    chats: '/api/chats',
    messages: (telefono) => `/api/messages/${telefono}`,
    send: '/api/send',
    markRead: (telefono) => `/api/mark-read/${telefono}`,
    stats: '/api/stats',
    health: '/api/health'
  }
};

export default config;
