import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { playNotificationSound, playMessageSound } from '../../hooks/useNotificationSound';
import {
  adminGetUsage,
  adminListConversations,
  adminGetMessages,
  adminReply,
  adminAssign,
  adminRelease,
  adminResolve,
  adminReopen,
  adminAiToggle,
} from '../../api/support';
import { useAdminSupportSocket } from '../../hooks/useSocket';
import useAuthStore from '../../store/authStore';

const FILTERS = [
  { key: 'waiting', label: 'Needs human' },
  { key: 'ai', label: 'AI-handled' },
  { key: 'human', label: 'With agent' },
  { key: 'resolved', label: 'Resolved' },
  { key: '', label: 'All' },
];

const STATUS_STYLES = {
  AI: 'bg-blue-100 text-blue-700',
  WAITING_HUMAN: 'bg-amber-100 text-amber-800',
  HUMAN: 'bg-green-100 text-green-700',
  RESOLVED: 'bg-gray-100 text-gray-500',
  CLOSED: 'bg-gray-100 text-gray-500',
};

function StatusBadge({ status }) {
  return (
    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-500'}`}>
      {status === 'WAITING_HUMAN' ? 'Waiting' : status}
    </span>
  );
}

function CostStrip() {
  const { data } = useQuery({
    queryKey: ['adminSupportUsage'],
    queryFn: () => adminGetUsage().then((r) => r.data.data),
    refetchInterval: 30000,
  });
  const u = data || {};
  const cell = (label, value) => (
    <div className="px-4 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
  return (
    <div className="flex flex-wrap divide-x divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 mb-4">
      {cell('This month', u.month || '—')}
      {cell('AI spend', `$${(u.costUsd || 0).toFixed(2)}`)}
      {cell('Conversations', u.conversations ?? 0)}
      {cell('Deflected (free)', u.deflected ?? 0)}
      {cell('Deflection rate', `${u.deflectionRate ?? 0}%`)}
    </div>
  );
}

function Thread({ conversationId, onChanged }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const lastUserMsgRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminSupportThread', conversationId],
    queryFn: () => adminGetMessages(conversationId).then((r) => r.data.data),
    enabled: !!conversationId,
    refetchInterval: 8000,
  });

  // Compute the latest USER message id (data may be undefined pre-load → null).
  const messages = data?.messages || [];
  let lastUserId = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender === 'USER') { lastUserId = String(messages[i].id); break; }
  }

  // Hooks must run on EVERY render — keep them above the early returns below,
  // otherwise the hook count changes between "no ticket" and "ticket open"
  // and React crashes the page (blank screen).
  useEffect(() => { lastUserMsgRef.current = null; }, [conversationId]); // reset on switch
  useEffect(() => {
    if (lastUserId && lastUserMsgRef.current && lastUserMsgRef.current !== lastUserId) {
      playMessageSound();
    }
    lastUserMsgRef.current = lastUserId;
  }, [lastUserId]);

  if (!conversationId) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a conversation</div>;
  }
  if (isLoading) return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>;

  const convo = data?.conversation;

  // Claim-lock state: one agent owns a conversation at a time.
  const meId = String(user?.id || '');
  const owner = convo?.assignedAdminId ? String(convo.assignedAdminId) : null;
  const mine = owner && owner === meId;
  const lockedByOther = owner && !mine;
  const canTakeOver = lockedByOther && convo?.staleClaim; // assigned agent went idle
  const fullyLocked = lockedByOther && !convo?.staleClaim;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['adminSupportThread', conversationId] });
    onChanged?.();
  };

  const errMsg = (e) => e?.response?.data?.error?.message;

  const act = async (fn, ok) => {
    try { await fn(conversationId); toast.success(ok); refresh(); }
    catch (e) { toast.error(errMsg(e) || 'Action failed'); refresh(); }
  };

  const send = async (e) => {
    e.preventDefault();
    const text = reply.trim();
    if (!text) return;
    setReply('');
    setSending(true);
    try { await adminReply(conversationId, text); refresh(); }
    catch (e2) { toast.error(errMsg(e2) || 'Reply failed'); refresh(); }
    finally { setSending(false); }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Thread header / actions */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{convo?.user?.name || 'User'}</p>
          <p className="text-xs text-gray-400 truncate">{convo?.user?.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={convo?.status} />
          {fullyLocked ? (
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">🔒 {convo?.assignedAdminName || 'Another agent'}</span>
          ) : canTakeOver ? (
            <>
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">⌛ {convo?.assignedAdminName || 'Agent'} idle</span>
              <button onClick={() => act(adminAssign, 'You took over the chat')} className="text-xs px-2.5 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600">Take over</button>
            </>
          ) : (
            <>
              {convo?.status !== 'RESOLVED' && !owner && (
                <button onClick={() => act(adminAssign, 'You took this chat')} className="text-xs px-2.5 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700">Take over</button>
              )}
              {mine && (
                <button onClick={() => act(adminRelease, 'Released back to the queue')} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">Release</button>
              )}
              <button onClick={() => act(adminAiToggle, convo?.aiEnabled ? 'AI off' : 'AI on')} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
                {convo?.aiEnabled ? 'Disable AI' : 'Enable AI'}
              </button>
              {convo?.status === 'RESOLVED'
                ? <button onClick={() => act(adminReopen, 'Reopened')} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">Reopen</button>
                : <button onClick={() => act(adminResolve, 'Resolved')} className="text-xs px-2.5 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700">Resolve</button>}
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-gray-950">
        {messages.map((m) => {
          if (m.sender === 'SYSTEM') return <p key={m.id} className="text-center text-xs text-gray-400">{m.text}</p>;
          const fromUser = m.sender === 'USER';
          return (
            <div key={m.id} className={`flex flex-col ${fromUser ? 'items-start' : 'items-end'}`}>
              <span className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">
                {fromUser ? 'User' : m.sender === 'AI' ? `AI${m.deflected ? ' · FAQ' : ''}` : 'You'}
              </span>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
                fromUser ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100'
                  : m.sender === 'AI' ? 'bg-blue-50 dark:bg-blue-900/20 text-gray-800 dark:text-gray-100'
                  : 'bg-brand-600 text-white'
              }`}>
                {m.text}
              </div>
              <span className="text-[10px] text-gray-300 mt-0.5">{dayjs(m.createdAt).format('MMM D, HH:mm')}</span>
            </div>
          );
        })}
      </div>

      {/* Reply — locked to one agent, unless their claim has gone stale */}
      {fullyLocked ? (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-amber-600 dark:text-amber-400">
          🔒 {convo?.assignedAdminName || 'Another agent'} is handling this chat — only they can reply.
        </div>
      ) : (
        <form onSubmit={send} className="flex items-center gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={canTakeOver ? 'Reply to take over this chat…' : owner ? 'Reply as support…' : 'Reply to take this chat…'}
            className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 dark:text-white rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button type="submit" disabled={!reply.trim() || sending} className="text-sm font-medium px-4 py-2 rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">Send</button>
        </form>
      )}
    </div>
  );
}

export default function AdminSupportPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('waiting');
  const [selected, setSelected] = useState(null);

  const { data } = useQuery({
    queryKey: ['adminSupportList', filter],
    queryFn: () => adminListConversations(filter).then((r) => r.data.data),
    refetchInterval: 12000,
  });

  // Live refresh of the queue + cost strip on any new/escalated activity.
  useAdminSupportSocket((data, event) => {
    qc.invalidateQueries({ queryKey: ['adminSupportList'] });
    qc.invalidateQueries({ queryKey: ['adminSupportUsage'] });
    qc.invalidateQueries({ queryKey: ['adminSupportThread'] }); // refresh the open thread instantly
    if (event === 'support:escalated') playNotificationSound(); // a new chat needs a human
  });

  const conversations = data?.conversations || [];
  const waitingCount = data?.waitingCount || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support</h1>
        {waitingCount > 0 && (
          <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">{waitingCount} waiting</span>
        )}
      </div>

      <CostStrip />

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-sm px-3 py-1.5 rounded-lg border ${filter === f.key ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-22rem)] min-h-[28rem]">
        {/* Queue */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-y-auto">
          {conversations.length === 0 && <p className="text-center text-sm text-gray-400 py-10">No conversations</p>}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 ${selected === c.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{c.user?.name || 'User'}</span>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{c.lastMessagePreview || '—'}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-300">{dayjs(c.lastMessageAt).format('MMM D, HH:mm')}</span>
                <div className="flex items-center gap-1.5">
                  {c.assignedAdminName && <span className="text-[10px] text-amber-600 dark:text-amber-400 truncate max-w-[7rem]">🔒 {c.assignedAdminName}</span>}
                  {c.unread > 0 && <span className="text-[10px] bg-red-500 text-white rounded-full px-1.5">{c.unread}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Thread */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col min-h-0">
          <Thread
            conversationId={selected}
            onChanged={() => {
              qc.invalidateQueries({ queryKey: ['adminSupportList'] });
              qc.invalidateQueries({ queryKey: ['adminSupportUsage'] });
            }}
          />
        </div>
      </div>
    </div>
  );
}
