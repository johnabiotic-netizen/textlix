import { useState, useRef, useEffect, useCallback } from 'react';
import { FiMessageCircle, FiX, FiSend } from 'react-icons/fi';
import {
  startConversation,
  getMessages,
  sendMessage as apiSend,
  escalateConversation,
  markRead,
} from '../../api/support';
import { useSupportSocket } from '../../hooks/useSocket';

// Label shown above each message bubble.
const SENDER_LABEL = { AI: 'Assistant', AGENT: 'Support', SYSTEM: '' };

export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [convId, setConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  // De-duped append (socket can echo a reply we already loaded over HTTP).
  const pushMessage = useCallback((m) => {
    setMessages((prev) => {
      if (prev.some((p) => p.sender === m.sender && p.text === m.text)) return prev;
      return [...prev, m];
    });
    scrollToBottom();
  }, [scrollToBottom]);

  // Live AI/agent replies + resolution notices.
  useSupportSocket(
    (data) => {
      if (convId && String(data.conversationId) !== String(convId)) return;
      if (open) {
        pushMessage({ sender: data.sender, text: data.text });
      } else {
        setUnread((u) => u + 1);
      }
    },
    (data) => {
      if (!convId || String(data.conversationId) !== String(convId)) return;
      pushMessage({ sender: 'SYSTEM', text: 'This conversation was marked resolved. Send a message any time to reopen it.' });
    }
  );

  // Lazily create/open the conversation when the panel first opens.
  const openPanel = async () => {
    setOpen(true);
    setUnread(0);
    if (convId) {
      markRead(convId).catch(() => {});
      return;
    }
    setBooting(true);
    try {
      const { data } = await startConversation();
      const id = data.data.conversation.id;
      setConvId(id);
      const res = await getMessages(id);
      setMessages(res.data.data.messages || []);
      markRead(id).catch(() => {});
      scrollToBottom();
    } catch {
      setMessages([{ sender: 'SYSTEM', text: "Couldn't load support right now. Please try again." }]);
    } finally {
      setBooting(false);
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !convId || loading) return;
    setInput('');
    pushMessage({ sender: 'USER', text });
    setLoading(true);
    try {
      const { data } = await apiSend(convId, text);
      // Server returns the authoritative thread incl. any AI reply.
      if (data.data.messages) {
        setMessages(data.data.messages);
        scrollToBottom();
      }
    } catch {
      pushMessage({ sender: 'SYSTEM', text: "Message didn't send. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleHuman = async () => {
    if (!convId) return;
    try {
      await escalateConversation(convId, 'User clicked Talk to a human');
      pushMessage({ sender: 'SYSTEM', text: "Connecting you with a human teammate — they'll reply here shortly." });
    } catch {}
  };

  useEffect(() => { if (open) scrollToBottom(); }, [open, scrollToBottom]);

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={openPanel}
          aria-label="Open support chat"
          className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg flex items-center justify-center transition-colors"
        >
          <FiMessageCircle size={24} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm h-[32rem] max-h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-brand-600 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">Textlix Support</p>
              <p className="text-xs text-white/70">Usually replies in seconds</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/80 hover:text-white p-1">
              <FiX size={20} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-gray-50 dark:bg-gray-950">
            {booting && <p className="text-center text-xs text-gray-400">Loading…</p>}
            {!booting && messages.length === 0 && (
              <p className="text-center text-sm text-gray-400 mt-6">Hi! 👋 How can we help you today?</p>
            )}
            {messages.map((m, i) => {
              if (m.sender === 'SYSTEM') {
                return <p key={i} className="text-center text-xs text-gray-400 px-4">{m.text}</p>;
              }
              const mine = m.sender === 'USER';
              return (
                <div key={i} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {!mine && <span className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5 ml-1">{SENDER_LABEL[m.sender]}</span>}
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                    mine
                      ? 'bg-brand-600 text-white rounded-br-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-sm'
                  }`}>
                    {m.text}
                  </div>
                </div>
              );
            })}
            {loading && <p className="text-xs text-gray-400 ml-1">Assistant is typing…</p>}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-2.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message…"
                disabled={booting}
                className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 dark:text-white rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button type="submit" disabled={!input.trim() || loading} className="h-9 w-9 shrink-0 rounded-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white flex items-center justify-center">
                <FiSend size={16} />
              </button>
            </form>
            <button onClick={handleHuman} className="w-full text-center text-xs text-gray-400 hover:text-brand-600 pb-2">
              Talk to a human
            </button>
          </div>
        </div>
      )}
    </>
  );
}
