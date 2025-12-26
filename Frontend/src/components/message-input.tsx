import { useState } from 'react';
import { Send, Paperclip, Smile } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
}

export function MessageInput({ onSendMessage }: MessageInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 px-6 py-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <button
          type="button"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-150"
        >
          <Paperclip className="w-5 h-5 text-gray-600" />
        </button>

        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full border-none outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all duration-200 text-sm"
        />

        <button
          type="button"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-150"
        >
          <Smile className="w-5 h-5 text-gray-600" />
        </button>

        <button
          type="submit"
          disabled={!message.trim()}
          className="p-2.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full transition-colors duration-200"
        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </form>
    </div>
  );
}
