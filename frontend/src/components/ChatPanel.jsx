// FILE: /frontend/src/components/ChatPanel.jsx

import { useState, useEffect, useRef } from 'react';
import { useMessages, useSendMessage, useTakeover } from '../hooks/useMessages';
import { formatTime, timeAgo } from '../utils/formatters';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  CheckIcon,
  CheckBadgeIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

export default function ChatPanel({ customerId, customerName, customerPhone, isHandedOff, onClose }) {
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef(null);
  const { data, isLoading } = useMessages(customerId, { limit: 50 });
  const sendMessage = useSendMessage();
  const takeover = useTakeover();

  const messages = data?.data || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    if (!messageInput.trim()) return;
    sendMessage.mutate({
      customerId,
      content: messageInput.trim(),
      type: 'TEXT',
    });
    setMessageInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'SENT':
        return <ClockIcon className="w-3 h-3 text-surface-500" />;
      case 'DELIVERED':
        return <CheckIcon className="w-3 h-3 text-surface-400" />;
      case 'READ':
        return <CheckBadgeIcon className="w-3 h-3 text-blue-400" />;
      case 'FAILED':
        return <ExclamationCircleIcon className="w-3 h-3 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-900 border-l border-surface-700/50 w-[400px] animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700/50 bg-surface-800/50">
        <div>
          <h3 className="text-sm font-semibold text-white">{customerName || 'Customer'}</h3>
          <p className="text-xs text-surface-400">{customerPhone}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isHandedOff && (
            <button
              onClick={() => takeover.mutate(customerId)}
              className="btn-ghost text-xs text-amber-400 hover:text-amber-300"
            >
              Take Over
            </button>
          )}
          <button onClick={onClose} className="p-1 text-surface-400 hover:text-white transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bot mode banner */}
      {!isHandedOff && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <p className="text-xs text-amber-400 flex items-center gap-2">
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
            Bot is handling this conversation
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-surface-500 text-sm">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === 'OUT' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={msg.direction === 'OUT' ? 'chat-bubble-out' : 'chat-bubble-in'}>
                {/* Sender label */}
                {msg.direction === 'OUT' && msg.agent && (
                  <p className="text-[10px] font-medium text-surface-600 mb-1">{msg.agent.name || 'BOT'}</p>
                )}
                
                <p className={`text-sm whitespace-pre-wrap ${msg.direction === 'OUT' ? 'text-surface-800' : 'text-white'}`}>
                  {msg.content}
                </p>
                
                <div className={`flex items-center justify-end gap-1 mt-1 ${msg.direction === 'OUT' ? 'text-surface-500' : 'text-surface-500'}`}>
                  <span className="text-[10px]">{formatTime(msg.timestamp)}</span>
                  {msg.direction === 'OUT' && getStatusIcon(msg.status)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {isHandedOff && (
        <div className="px-4 py-2 border-t border-surface-700/30 flex gap-2 overflow-x-auto">
          {['Send Quote', 'Request Payment', 'Send Itinerary', 'Transfer'].map((action) => (
            <button
              key={action}
              className="shrink-0 px-3 py-1 text-xs bg-surface-800/50 text-surface-300 hover:text-white hover:bg-surface-700 rounded-lg transition-colors border border-surface-700/30"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-surface-700/50">
        <div className="flex items-end gap-2">
          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isHandedOff ? 'Type a message...' : 'Bot is active. Take over to reply.'}
            disabled={!isHandedOff}
            rows={1}
            className="input-field resize-none text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!isHandedOff || !messageInput.trim()}
            className="btn-primary p-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
