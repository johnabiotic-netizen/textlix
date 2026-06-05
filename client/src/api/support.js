import api from './axios';

// ── User-facing support chat ──────────────────────────────────────────────────
export const listConversations = () => api.get('/support/conversations');
export const startConversation = (text) => api.post('/support/conversations', text ? { text } : {});
export const getMessages = (id) => api.get(`/support/conversations/${id}/messages`);
export const sendMessage = (id, text) => api.post(`/support/conversations/${id}/messages`, { text });
export const escalateConversation = (id, reason) => api.post(`/support/conversations/${id}/escalate`, reason ? { reason } : {});
export const markRead = (id) => api.post(`/support/conversations/${id}/read`);

// ── Admin support console ─────────────────────────────────────────────────────
export const adminGetUsage = () => api.get('/admin/support/usage');
export const adminListConversations = (status = '', page = 1) =>
  api.get(`/admin/support/conversations?status=${status}&page=${page}`);
export const adminGetMessages = (id) => api.get(`/admin/support/conversations/${id}/messages`);
export const adminReply = (id, text) => api.post(`/admin/support/conversations/${id}/messages`, { text });
export const adminAssign = (id) => api.post(`/admin/support/conversations/${id}/assign`);
export const adminResolve = (id) => api.post(`/admin/support/conversations/${id}/resolve`);
export const adminReopen = (id) => api.post(`/admin/support/conversations/${id}/reopen`);
export const adminAiToggle = (id) => api.post(`/admin/support/conversations/${id}/ai-toggle`);
