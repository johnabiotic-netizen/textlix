import api from './axios';

export const getMe = () => api.get('/user/me');
export const updateMe = (data) => api.patch('/user/me', data);
export const changePassword = (data) => api.patch('/user/me/password', data);
export const getStats = () => api.get('/user/me/stats');
export const getReferral = () => api.get('/user/me/referral');
export const getApiKeys = () => api.get('/user/me/api-keys');
export const createApiKey = (data) => api.post('/user/me/api-keys', data);
export const deleteApiKey = (id) => api.delete(`/user/me/api-keys/${id}`);
