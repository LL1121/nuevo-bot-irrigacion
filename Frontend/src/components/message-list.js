"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageList = MessageList;
var react_1 = require("react");
var lucide_react_1 = require("lucide-react");
function MessageList(_a) {
    var messages = _a.messages;
    var messagesEndRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        var _a;
        (_a = messagesEndRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    return (<div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
      {messages.map(function (message) { return (<div key={message.id} className={"flex ".concat(message.sender === 'operator' ? 'justify-end' : 'justify-start', " animate-fadeIn")}>
          <div className={"max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ".concat(message.sender === 'operator'
                ? 'bg-green-500 text-white rounded-br-none'
                : 'bg-gray-200 text-gray-900 rounded-bl-none')}>
            <p className="text-sm break-words">{message.text}</p>
            <div className={"flex items-center justify-end gap-1 mt-1 text-xs ".concat(message.sender === 'operator' ? 'text-green-100' : 'text-gray-600')}>
              <span>{message.timestamp}</span>
              {message.sender === 'operator' && (message.status === 'read' ? (<lucide_react_1.CheckCheck className="w-4 h-4"/>) : (<lucide_react_1.Check className="w-4 h-4"/>))}
            </div>
          </div>
        </div>); })}
      <div ref={messagesEndRef}/>
    </div>);
}
