import { useState } from 'react';
import { Send, Search, MoreVertical, Phone, Video, Paperclip, Smile, Check, CheckCheck } from 'lucide-react';

export default function App() {
  const [selectedChat, setSelectedChat] = useState(0);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const conversations = [
    {
      id: 1,
      name: 'María González',
      lastMessage: 'Perfecto, gracias por la info!',
      time: '10:30',
      unread: 0,
      avatar: 'MG',
      status: 'online',
      operator: 'Juan P.',
      messages: [
        { id: 1, text: 'Hola! Necesito info sobre el producto', time: '10:15', sent: false, read: true },
        { id: 2, text: 'Claro! Te paso toda la información', time: '10:20', sent: true, read: true },
        { id: 3, text: 'El precio es $5000 y viene con garantía', time: '10:21', sent: true, read: true },
        { id: 4, text: 'Perfecto, gracias por la info!', time: '10:30', sent: false, read: true }
      ]
    },
    {
      id: 2,
      name: 'Carlos Rodríguez',
      lastMessage: 'Cuándo pueden entregar?',
      time: '09:45',
      unread: 3,
      avatar: 'CR',
      status: 'online',
      operator: null,
      messages: [
        { id: 1, text: 'Buenos días!', time: '09:40', sent: false, read: false },
        { id: 2, text: 'Quiero hacer un pedido', time: '09:42', sent: false, read: false },
        { id: 3, text: 'Cuándo pueden entregar?', time: '09:45', sent: false, read: false }
      ]
    },
    {
      id: 3,
      name: 'Ana Martínez',
      lastMessage: 'Excelente servicio!',
      time: '08:20',
      unread: 0,
      avatar: 'AM',
      status: 'offline',
      operator: 'Laura S.',
      messages: [
        { id: 1, text: 'Ya recibí el pedido', time: '08:15', sent: false, read: true },
        { id: 2, text: 'Excelente servicio!', time: '08:20', sent: false, read: true },
        { id: 3, text: 'Muchas gracias! Nos alegra que todo esté bien', time: '08:25', sent: true, read: true }
      ]
    },
    {
      id: 4,
      name: 'Pedro Sánchez',
      lastMessage: 'Ok, espero la factura',
      time: 'Ayer',
      unread: 0,
      avatar: 'PS',
      status: 'offline',
      operator: 'Juan P.',
      messages: [
        { id: 1, text: 'Necesito la factura del mes pasado', time: 'Ayer', sent: false, read: true },
        { id: 2, text: 'Te la envío en un momento', time: 'Ayer', sent: true, read: true },
        { id: 3, text: 'Ok, espero la factura', time: 'Ayer', sent: false, read: true }
      ]
    }
  ];

  const currentChat = conversations[selectedChat];

  const handleSendMessage = () => {
    if (message.trim()) {
      setMessage('');
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Lista de conversaciones */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-white text-xl font-semibold">Mensajes</h1>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm bg-white/20 px-3 py-1 rounded-full">
                Operador: Juan P.
              </span>
              <button className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                <MoreVertical size={20} />
              </button>
            </div>
          </div>
          
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar conversación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
            />
          </div>
        </div>

        {/* Conversaciones */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv, idx) => (
            <div
              key={conv.id}
              onClick={() => setSelectedChat(idx)}
              className={`p-4 border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                selectedChat === idx ? 'bg-emerald-50 border-l-4 border-l-emerald-600' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold ${
                    selectedChat === idx ? 'bg-emerald-600' : 'bg-gradient-to-br from-emerald-500 to-teal-500'
                  } transition-colors`}>
                    {conv.avatar}
                  </div>
                  {conv.status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{conv.name}</h3>
                    <span className="text-xs text-gray-500">{conv.time}</span>
                  </div>
                  <p className="text-sm text-gray-600 truncate mb-1">{conv.lastMessage}</p>
                  <div className="flex items-center justify-between">
                    {conv.operator ? (
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Atendido por {conv.operator}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full animate-pulse">
                        Sin asignar
                      </span>
                    )}
                    {conv.unread > 0 && (
                      <span className="bg-emerald-600 text-white text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Principal */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-semibold">
                {currentChat.avatar}
              </div>
              {currentChat.status === 'online' && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{currentChat.name}</h2>
              <p className="text-xs text-gray-500">
                {currentChat.status === 'online' ? 'En línea' : 'Desconectado'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Phone size={20} className="text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Video size={20} className="text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <MoreVertical size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {currentChat.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sent ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`max-w-md px-4 py-2 rounded-2xl shadow-sm ${
                  msg.sent
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-br-sm'
                    : 'bg-white text-gray-900 rounded-bl-sm'
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <div className={`flex items-center gap-1 justify-end mt-1 ${msg.sent ? 'text-white/80' : 'text-gray-500'}`}>
                  <span className="text-xs">{msg.time}</span>
                  {msg.sent && (
                    msg.read ? <CheckCheck size={14} /> : <Check size={14} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input de mensaje */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Paperclip size={22} className="text-gray-600" />
            </button>
            
            <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2">
              <input
                type="text"
                placeholder="Escribe un mensaje..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 bg-transparent focus:outline-none text-gray-900"
              />
              <button className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <Smile size={20} className="text-gray-600" />
              </button>
            </div>

            <button
              onClick={handleSendMessage}
              className="p-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-full transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Panel lateral de información */}
      <div className="w-80 bg-white border-l border-gray-200 p-6">
        <div className="text-center mb-6">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-3xl font-semibold mb-4">
            {currentChat.avatar}
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-1">{currentChat.name}</h3>
          <p className="text-sm text-gray-500">+54 9 11 1234-5678</p>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Estado</h4>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${currentChat.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-gray-600">
                {currentChat.status === 'online' ? 'En línea' : 'Desconectado'}
              </span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Operador Asignado</h4>
            {currentChat.operator ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-semibold">
                  {currentChat.operator.split(' ').map(n => n[0]).join('')}
                </div>
                <span className="text-sm text-gray-900">{currentChat.operator}</span>
              </div>
            ) : (
              <button className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium">
                Asignarme esta conversación
              </button>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Etiquetas</h4>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">Cliente nuevo</span>
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">Consulta</span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Información</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Primera vez:</span>
                <span className="text-gray-900">Hace 2 días</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Mensajes:</span>
                <span className="text-gray-900">{currentChat.messages.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
