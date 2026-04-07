export interface Contact {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  timestamp: string;
  unread: number;
  assignedTo?: string;
  status: 'active' | 'pending' | 'resolved';
  avatar: string;
}

export interface Message {
  id: string;
  contactId: string;
  text: string;
  timestamp: string;
  sender: 'customer' | 'operator';
  operatorName?: string;
  status: 'sent' | 'delivered' | 'read';
}
