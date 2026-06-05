import api from './axios';

export const getCreatorMe = () => api.get('/creator/me');
export const applyCreator = (data) => api.post('/creator/apply', data);
export const getCreatorEarnings = (page = 1) => api.get(`/creator/earnings?page=${page}`);
export const getCreatorReferrals = (page = 1) => api.get(`/creator/referrals?page=${page}`);
export const updateCreatorBank = (data) => api.put('/creator/bank', data);
export const updateReferralCode = (code) => api.put('/creator/referral-code', { referralCode: code });
export const requestWithdrawal = () => api.post('/creator/withdraw');
export const getCreatorWithdrawals = () => api.get('/creator/withdrawals');

// Admin
export const adminGetApplications = (status = 'pending') => api.get(`/admin/creators/applications?status=${status}`);
export const adminGetCreators = () => api.get('/admin/creators');
export const adminApproveCreator = (id, note = '') => api.post(`/admin/creators/${id}/approve`, { note });
export const adminRejectCreator = (id, note = '') => api.post(`/admin/creators/${id}/reject`, { note });
export const adminGetWithdrawals = (status = 'pending') => api.get(`/admin/creators/withdrawals?status=${status}`);
export const adminMarkWithdrawalPaid = (id, note = '') => api.post(`/admin/creators/withdrawals/${id}/pay`, { note });
export const adminRejectWithdrawal = (id, note = '') => api.post(`/admin/creators/withdrawals/${id}/reject`, { note });
