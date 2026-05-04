import { memo, type Dispatch, type SetStateAction } from 'react';
import { X, Check, Copy, Trash, ChevronUp, Play, FileText } from 'lucide-react';
import type { ChatMessage, Conversation } from '../types/chat';
import type { ThemeColorBundle } from '../types/theme';
import { formatPhoneForDisplay } from '../utils/phoneFormat';

export type MediaFilter = 'all' | 'images' | 'videos' | 'files' | 'urls';

export type InfoPanelProps = {
  currentChat: Conversation;
  darkMode: boolean;
  theme: string;
  themeColors: ThemeColorBundle;
  infoPanelClosing: boolean;
  closeInfoPanel: () => void;
  editingName: boolean;
  tempName: string;
  setTempName: Dispatch<SetStateAction<string>>;
  saveEditName: () => void;
  cancelEditName: () => void;
  startEditName: () => void;
  updatePadronField: (field: 'number' | 'location' | 'debtStatus', value: string) => void;
  noteDrafts: Record<number, string>;
  setNoteDrafts: Dispatch<SetStateAction<Record<number, string>>>;
  addNote: () => void;
  deleteNote: (noteId: number) => void;
  showMediaMenu: boolean;
  setShowMediaMenu: Dispatch<SetStateAction<boolean>>;
  mediaFilter: MediaFilter;
  setMediaFilter: Dispatch<SetStateAction<MediaFilter>>;
  getMediaMessages: () => ChatMessage[];
  setLightboxImage: (url: string | null | undefined) => void;
};

type ConversationWithStatus = Conversation & { status?: string };

export const InfoPanel = memo(function InfoPanel(p: InfoPanelProps) {
  const chat = p.currentChat as ConversationWithStatus;

  return (
    <div
      className={`w-80 border-l p-6 pt-12 relative overflow-y-auto ${p.infoPanelClosing ? 'animate-slideOutRight' : 'animate-slideInRight'}`}
      style={{
        backgroundColor: p.darkMode ? '#1f2937' : '#ffffff',
        borderColor: p.darkMode ? '#374151' : '#e5e7eb'
      }}
    >
      <button
        aria-label="Cerrar panel"
        className="absolute top-4 right-4 p-2 rounded-full transition"
        onClick={p.closeInfoPanel}
        style={{ color: p.darkMode ? '#9ca3af' : '#4b5563', backgroundColor: p.darkMode ? '#374151' : '#f3f4f6' }}
      >
        <X className="w-4 h-4" />
      </button>
      <div className="text-center mb-6">
        {chat.profilePic ? (
          <img
            src={chat.profilePic}
            alt={chat.name}
            className="w-24 h-24 mx-auto rounded-full object-cover mb-4"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-white text-3xl font-semibold mb-4"
          style={{
            backgroundImage: `linear-gradient(135deg, ${p.themeColors[p.theme].hex}, #14b8a6)`,
            display: chat.profilePic ? 'none' : 'flex'
          }}
        >
          {chat.avatar}
        </div>
        {p.editingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={p.tempName}
              onChange={(e) => p.setTempName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && p.saveEditName()}
              className="flex-1 px-3 py-1 rounded-md border focus:outline-none text-center font-semibold"
              style={{
                backgroundColor: p.darkMode ? '#1f2937' : '#ffffff',
                borderColor: p.darkMode ? '#4b5563' : '#d1d5db',
                color: p.darkMode ? '#f3f4f6' : '#111827'
              }}
              autoFocus
            />
            <button onClick={p.saveEditName} className="p-1 hover:bg-green-100 dark:hover:bg-green-900 rounded">
              <Check size={18} className="text-green-600" />
            </button>
            <button onClick={p.cancelEditName} className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded">
              <X size={18} className="text-red-600" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-xl font-semibold mb-1" style={{ color: p.darkMode ? '#f3f4f6' : '#111827' }}>
              {chat.name}
            </h3>
            <button onClick={p.startEditName} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded opacity-60 hover:opacity-100">
              <Copy size={14} style={{ color: p.darkMode ? '#9ca3af' : '#6b7280' }} />
            </button>
          </div>
        )}
        <p style={{ color: p.darkMode ? '#9ca3af' : '#6b7280' }}>{formatPhoneForDisplay(chat.phone)}</p>
      </div>

      <div className="space-y-4">
        <div
          className="rounded-lg p-4 border"
          style={{
            backgroundColor: p.darkMode ? '#374151' : '#f9fafb',
            borderColor: p.darkMode ? '#4b5563' : '#e5e7eb'
          }}
        >
          <h4 className="text-sm font-semibold mb-3" style={{ color: p.darkMode ? '#e5e7eb' : '#1f2937' }}>
            Datos del Padrón
          </h4>
          <div className="space-y-3 text-sm">
            <div className="flex flex-col gap-1">
              <label style={{ color: p.darkMode ? '#9ca3af' : '#4b5563', fontSize: '0.75rem' }}>Nº Padrón / Cuenta</label>
              <input
                type="number"
                value={chat.padron?.number || ''}
                onChange={(e) => p.updatePadronField('number', e.target.value)}
                className="w-full px-3 py-2 rounded-md border focus:outline-none transition"
                style={{
                  backgroundColor: p.darkMode ? '#1f2937' : '#ffffff',
                  borderColor: p.darkMode ? '#4b5563' : '#d1d5db',
                  color: p.darkMode ? '#f3f4f6' : '#111827',
                  boxShadow: 'var(--tw-ring-offset-shadow), var(--tw-ring-shadow), 0 0 #0000'
                }}
                onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 3px ${p.themeColors[p.theme].hex}40`)}
                onBlur={(e) => (e.currentTarget.style.boxShadow = '')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label style={{ color: p.darkMode ? '#9ca3af' : '#4b5563', fontSize: '0.75rem' }}>Ubicación</label>
              <input
                type="text"
                value={chat.padron?.location || ''}
                onChange={(e) => p.updatePadronField('location', e.target.value)}
                className="w-full px-3 py-2 rounded-md border focus:outline-none transition"
                style={{
                  backgroundColor: p.darkMode ? '#1f2937' : '#ffffff',
                  borderColor: p.darkMode ? '#4b5563' : '#d1d5db',
                  color: p.darkMode ? '#f3f4f6' : '#111827'
                }}
                onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 3px ${p.themeColors[p.theme].hex}40`)}
                onBlur={(e) => (e.currentTarget.style.boxShadow = '')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label style={{ color: p.darkMode ? '#9ca3af' : '#4b5563', fontSize: '0.75rem' }}>Estado Deuda</label>
              <select
                value={chat.padron?.debtStatus || 'Al Día'}
                onChange={(e) => p.updatePadronField('debtStatus', e.target.value)}
                className="w-full px-3 py-2 rounded-md border focus:outline-none transition"
                style={{
                  backgroundColor: p.darkMode ? '#1f2937' : '#ffffff',
                  borderColor: p.darkMode ? '#4b5563' : '#d1d5db',
                  color: p.darkMode ? '#f3f4f6' : '#111827'
                }}
                onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 3px ${p.themeColors[p.theme].hex}40`)}
                onBlur={(e) => (e.currentTarget.style.boxShadow = '')}
              >
                <option value="Al Día">🟢 Al Día</option>
                <option value="Con Deuda">🔴 Con Deuda</option>
                <option value="Plan de Pago">🟡 Plan de Pago</option>
              </select>
            </div>
          </div>
        </div>

        <div
          className="border rounded-lg p-4"
          style={{
            backgroundColor: p.darkMode ? '#374151' : '#fffbeb',
            borderColor: p.darkMode ? '#d97706' : '#fcd34d'
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold" style={{ color: p.darkMode ? '#fbbf24' : '#92400e' }}>
              Notas Privadas 🔒
            </h4>
            <span className="text-xs" style={{ color: p.darkMode ? '#f59e0b' : '#b45309' }}>
              Solo internos
            </span>
          </div>
          <div className="space-y-2 mb-3">
            {(chat.notes || []).map((note) => (
              <div
                key={note.id}
                className="border rounded-md p-2 flex justify-between items-start transition"
                style={{
                  backgroundColor: p.darkMode ? '#1f2937' : '#fef3c7',
                  borderColor: p.darkMode ? '#92400e' : '#fcd34d',
                  color: p.darkMode ? '#fbbf24' : '#92400e'
                }}
              >
                <span className="text-sm leading-tight">{note.text}</span>
                <button
                  className="p-1 rounded-md transition"
                  onClick={() => p.deleteNote(note.id)}
                  style={{ backgroundColor: p.darkMode ? '#374151' : '#fed7aa', color: p.darkMode ? '#fbbf24' : '#b45309' }}
                >
                  <Trash size={14} />
                </button>
              </div>
            ))}
            {(chat.notes || []).length === 0 && (
              <p className="text-sm" style={{ color: p.darkMode ? '#f59e0b' : '#b45309' }}>
                Sin notas aún.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <textarea
              placeholder="Nueva nota privada"
              value={p.noteDrafts[chat.id] || ''}
              onChange={(e) => p.setNoteDrafts((prev) => ({ ...prev, [chat.id]: e.target.value }))}
              className="w-full h-16 px-3 py-2 rounded-md border focus:outline-none transition"
              style={{
                backgroundColor: p.darkMode ? '#1f2937' : '#fffbeb',
                borderColor: p.darkMode ? '#92400e' : '#fcd34d',
                color: p.darkMode ? '#9ca3af' : '#6b7280'
              }}
              onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 3px ${p.themeColors[p.theme].hex}40`)}
              onBlur={(e) => (e.currentTarget.style.boxShadow = '')}
            />
            <button
              className="w-full px-3 py-2 rounded-md text-white font-semibold transition"
              onClick={p.addNote}
              style={{ backgroundColor: p.themeColors[p.theme].hex }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Guardar Nota
            </button>
          </div>
        </div>

        <div
          className="rounded-lg p-4 border"
          style={{
            backgroundColor: p.darkMode ? '#374151' : '#f9fafb',
            borderColor: p.darkMode ? '#4b5563' : '#e5e7eb'
          }}
        >
          <h4 className="text-sm font-semibold mb-2" style={{ color: p.darkMode ? '#e5e7eb' : '#374151' }}>
            Estado
          </h4>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${chat.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm" style={{ color: p.darkMode ? '#d1d5db' : '#4b5563' }}>
              {chat.status === 'online' ? 'En línea' : 'Desconectado'}
            </span>
          </div>
        </div>

        <div
          className="rounded-lg p-4 border"
          style={{
            backgroundColor: p.darkMode ? '#374151' : '#f9fafb',
            borderColor: p.darkMode ? '#4b5563' : '#e5e7eb'
          }}
        >
          <h4 className="text-sm font-semibold mb-3" style={{ color: p.darkMode ? '#e5e7eb' : '#374151' }}>
            Etiquetas
          </h4>
          <div className="flex flex-wrap gap-2">
            <span
              className="px-3 py-1 rounded-full text-xs transition"
              style={{
                backgroundColor: p.darkMode ? '#3b82f620' : '#dbeafe',
                color: p.darkMode ? '#60a5fa' : '#1e40af'
              }}
            >
              Cliente nuevo
            </span>
            <span
              className="px-3 py-1 rounded-full text-xs transition"
              style={{
                backgroundColor: p.darkMode ? '#a855f720' : '#e9d5ff',
                color: p.darkMode ? '#d8b4fe' : '#6b21a8'
              }}
            >
              Consulta
            </span>
          </div>
        </div>

        <div
          className="rounded-lg p-4 border"
          style={{
            backgroundColor: p.darkMode ? '#374151' : '#f9fafb',
            borderColor: p.darkMode ? '#4b5563' : '#e5e7eb'
          }}
        >
          <h4 className="text-sm font-semibold mb-2" style={{ color: p.darkMode ? '#e5e7eb' : '#374151' }}>
            Información
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: p.darkMode ? '#9ca3af' : '#6b7280' }}>Primera vez:</span>
              <span style={{ color: p.darkMode ? '#e5e7eb' : '#111827' }}>Hace 2 días</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: p.darkMode ? '#9ca3af' : '#6b7280' }}>Mensajes:</span>
              <span style={{ color: p.darkMode ? '#e5e7eb' : '#111827' }}>{chat.messages.length}</span>
            </div>
          </div>
        </div>

        <div
          className="rounded-lg p-4 border"
          style={{
            backgroundColor: p.darkMode ? '#374151' : '#f9fafb',
            borderColor: p.darkMode ? '#4b5563' : '#e5e7eb'
          }}
        >
          <button onClick={() => p.setShowMediaMenu(!p.showMediaMenu)} className="w-full flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold" style={{ color: p.darkMode ? '#e5e7eb' : '#374151' }}>
              Archivos Multimedia
            </h4>
            <ChevronUp
              size={18}
              className={`transition-transform ${p.showMediaMenu ? 'rotate-180' : ''}`}
              style={{ color: p.darkMode ? '#9ca3af' : '#6b7280' }}
            />
          </button>

          {p.showMediaMenu && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {(['all', 'images', 'videos', 'files', 'urls'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => p.setMediaFilter(filter)}
                    className="px-3 py-1 rounded-full text-xs transition"
                    style={{
                      backgroundColor: p.mediaFilter === filter ? p.themeColors[p.theme].hex : p.darkMode ? '#4b5563' : '#e5e7eb',
                      color: p.mediaFilter === filter ? '#ffffff' : p.darkMode ? '#d1d5db' : '#4b5563'
                    }}
                  >
                    {filter === 'all'
                      ? 'Todos'
                      : filter === 'images'
                        ? 'Imágenes'
                        : filter === 'videos'
                          ? 'Videos'
                          : filter === 'files'
                            ? 'Archivos'
                            : 'URLs'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {p.getMediaMessages().map((msg) => (
                  <div
                    key={msg.id}
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition border"
                    style={{ borderColor: p.darkMode ? '#4b5563' : '#d1d5db' }}
                    onClick={() => {
                      if (msg.type === 'image') p.setLightboxImage(msg.fileUrl);
                    }}
                  >
                    {msg.type === 'image' ? (
                      <img src={msg.fileUrl || ''} alt={msg.text} className="w-full h-full object-cover" />
                    ) : msg.type === 'video' ? (
                      <div className="relative w-full h-full bg-black">
                        <video src={msg.fileUrl || ''} className="w-full h-full object-cover" preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play size={24} className="text-white" />
                        </div>
                      </div>
                    ) : msg.type === 'file' ? (
                      (() => {
                        const isPdf = msg.filename?.toLowerCase().endsWith('.pdf');
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.filename || '');

                        if (isPdf && msg.fileUrl) {
                          return (
                            <div className="relative w-full h-full">
                              <iframe
                                src={`${msg.fileUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0`}
                                className="w-full h-full pointer-events-none"
                                style={{ transform: 'scale(1.5)', transformOrigin: 'top left' }}
                              />
                              <div className="absolute inset-0 flex items-end justify-center pb-2 bg-gradient-to-t from-black/60 to-transparent">
                                <span className="text-xs text-white font-medium">PDF</span>
                              </div>
                            </div>
                          );
                        }
                        if (isImage && msg.fileUrl) {
                          return <img src={msg.fileUrl} alt={msg.text} className="w-full h-full object-cover" />;
                        }
                        return (
                          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex flex-col items-center justify-center p-2">
                            <FileText size={24} className="text-emerald-600 mb-1" />
                            <span className="text-xs text-center truncate w-full" style={{ color: p.darkMode ? '#d1d5db' : '#4b5563' }}>
                              {msg.filename}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="w-full h-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center p-2">
                        <span className="text-xs text-center break-all text-blue-600 dark:text-blue-300">
                          {msg.text.match(/https?:\/\/[^\s]+/)?.[0]}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {p.getMediaMessages().length === 0 && (
                <p className="text-xs text-center py-4" style={{ color: p.darkMode ? '#9ca3af' : '#6b7280' }}>
                  No hay archivos multimedia
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
