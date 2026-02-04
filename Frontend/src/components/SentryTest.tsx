import React from 'react';
import { captureException, captureMessage } from '../utils/logger';
import { env } from '../config/env';

export default function SentryTest() {
  if (!env.isDevelopment && !env.enableSentry && !env.enableLogging) return null;

  const sendError = () => {
    try {
      throw new Error('Prueba Sentry - error generado desde SentryTest');
    } catch (err) {
      captureException(err, { source: 'SentryTest', timestamp: Date.now() });
      // also log a friendly message
      captureMessage('SentryTest: error event sent', 'info');
      // show quick console note
      console.info('SentryTest: evento de error enviado');
    }
  };

  const sendMessage = () => {
    captureMessage('SentryTest: evento de prueba (message)', 'info');
    console.info('SentryTest: evento message enviado');
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white/90 dark:bg-gray-800/90 shadow-lg rounded-lg p-3 space-y-2 text-sm">
        <div className="font-medium">Sentry Test</div>
        <div className="flex gap-2">
          <button onClick={sendError} className="px-3 py-1 bg-red-600 text-white rounded">Enviar Error</button>
          <button onClick={sendMessage} className="px-3 py-1 bg-amber-500 text-white rounded">Enviar Mensaje</button>
        </div>
        <div className="text-xs text-gray-500">Solo visible en dev / con logging/Sentry habilitado.</div>
      </div>
    </div>
  );
}
