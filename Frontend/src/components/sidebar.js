"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sidebar = Sidebar;
var react_1 = require("react");
var lucide_react_1 = require("lucide-react");
function Sidebar(_a) {
    var contacts = _a.contacts, selectedContact = _a.selectedContact, onSelectContact = _a.onSelectContact;
    var _b = (0, react_1.useState)(''), searchQuery = _b[0], setSearchQuery = _b[1];
    var filteredContacts = contacts.filter(function (contact) {
        return contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            contact.phone.includes(searchQuery);
    });
    var getStatusColor = function (status) {
        switch (status) {
            case 'active':
                return 'bg-green-500';
            case 'pending':
                return 'bg-yellow-500';
            case 'resolved':
                return 'bg-gray-400';
            default:
                return 'bg-gray-400';
        }
    };
    var getStatusLabel = function (status) {
        switch (status) {
            case 'active':
                return 'Activo';
            case 'pending':
                return 'Pendiente';
            case 'resolved':
                return 'Resuelto';
            default:
                return status;
        }
    };
    return (<div className="w-full md:w-96 bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <lucide_react_1.MessageCircle className="w-6 h-6 text-white"/>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Mensajes</h1>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <lucide_react_1.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"/>
          <input type="text" placeholder="Buscar conversación..." value={searchQuery} onChange={function (e) { return setSearchQuery(e.target.value); }} className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full border-none outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all duration-200 text-sm"/>
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (<div className="p-8 text-center">
            <lucide_react_1.MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3"/>
            <p className="text-gray-500">No hay conversaciones</p>
          </div>) : (filteredContacts.map(function (contact) { return (<button key={contact.id} onClick={function () { return onSelectContact(contact); }} className={"w-full px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-150 text-left ".concat((selectedContact === null || selectedContact === void 0 ? void 0 : selectedContact.id) === contact.id ? 'bg-gray-100' : '')}>
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {contact.avatar}
                  </div>
                  {contact.status === 'active' && (<div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>)}
                </div>

                {/* Contact Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{contact.name}</h3>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{contact.timestamp}</span>
                  </div>
                  <p className="text-sm text-gray-600 truncate mb-1">{contact.lastMessage}</p>
                  <div className="flex items-center gap-2">
                    <span className={"inline-block px-2 py-1 rounded-full text-xs font-medium ".concat(getStatusColor(contact.status), " text-white")}>
                      {getStatusLabel(contact.status)}
                    </span>
                    {contact.unread > 0 && (<span className="inline-flex items-center justify-center w-5 h-5 bg-green-500 text-white rounded-full text-xs font-bold">
                        {contact.unread}
                      </span>)}
                  </div>
                </div>
              </div>
            </button>); }))}
      </div>
    </div>);
}
