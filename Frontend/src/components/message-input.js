"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageInput = MessageInput;
var react_1 = require("react");
var lucide_react_1 = require("lucide-react");
function MessageInput(_a) {
    var onSendMessage = _a.onSendMessage;
    var _b = (0, react_1.useState)(''), message = _b[0], setMessage = _b[1];
    var handleSubmit = function (e) {
        e.preventDefault();
        if (message.trim()) {
            onSendMessage(message);
            setMessage('');
        }
    };
    return (<div className="bg-white border-t border-gray-200 px-6 py-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <button type="button" className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-150">
          <lucide_react_1.Paperclip className="w-5 h-5 text-gray-600"/>
        </button>

        <input type="text" value={message} onChange={function (e) { return setMessage(e.target.value); }} placeholder="Escribe un mensaje..." className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full border-none outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all duration-200 text-sm"/>

        <button type="button" className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-150">
          <lucide_react_1.Smile className="w-5 h-5 text-gray-600"/>
        </button>

        <button type="submit" disabled={!message.trim()} className="p-2.5 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full transition-colors duration-200">
          <lucide_react_1.Send className="w-5 h-5 text-white"/>
        </button>
      </form>
    </div>);
}
