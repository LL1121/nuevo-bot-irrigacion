import { MessageCircle } from 'lucide-react';
import type { Contact, Message } from '../types';
import { ChatHeader } from './chat-header';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';

interface ChatWindowProps {
  contact: Contact | null;
  messages: Message[];
  onSendMessage: (text: string) => void;
}

export function ChatWindow({ contact, messages, onSendMessage }: ChatWindowProps) {
  if (!contact) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
        <div className="text-center">
          <MessageCircle className="w-20 h-20 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Selecciona una conversación para comenzar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden md:flex flex-col flex-1 bg-white h-screen">
      <ChatHeader contact={contact} />
      <MessageList messages={messages} />
      <MessageInput onSendMessage={onSendMessage} />
    </div>
  );
}
