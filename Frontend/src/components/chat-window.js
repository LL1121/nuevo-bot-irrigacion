"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatWindow = ChatWindow;
var lucide_react_1 = require("lucide-react");
var chat_header_1 = require("./chat-header");
var message_list_1 = require("./message-list");
var message_input_1 = require("./message-input");
function ChatWindow(_a) {
    var contact = _a.contact, messages = _a.messages, onSendMessage = _a.onSendMessage;
    if (!contact) {
        return (<div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
        <div className="text-center">
          <lucide_react_1.MessageCircle className="w-20 h-20 text-gray-300 mx-auto mb-4"/>
          <p className="text-gray-500 text-lg">Selecciona una conversación para comenzar</p>
        </div>
      </div>);
    }
    return (<div className="hidden md:flex flex-col flex-1 bg-white h-screen">
      <chat_header_1.ChatHeader contact={contact}/>
      <message_list_1.MessageList messages={messages}/>
      <message_input_1.MessageInput onSendMessage={onSendMessage}/>
    </div>);
}
