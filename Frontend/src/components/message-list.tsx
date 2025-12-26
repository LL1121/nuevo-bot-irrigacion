import { useEffect, useRef } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import type { Message } from '../types';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.sender === 'operator' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
        >
          <div
            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
              message.sender === 'operator'
                ? 'bg-green-500 text-white rounded-br-none'
                : 'bg-gray-200 text-gray-900 rounded-bl-none'
            }`}
          >
            <p className="text-sm break-words">{message.text}</p>
            <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
              message.sender === 'operator' ? 'text-green-100' : 'text-gray-600'
            }`}>
              <span>{message.timestamp}</span>
              {message.sender === 'operator' && (
                message.status === 'read' ? (
                  <CheckCheck className="w-4 h-4" />
                ) : (
                  <Check className="w-4 h-4" />
                )
              )}
            </div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
