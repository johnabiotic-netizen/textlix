import api from './axios';

export const getMe = () => api.get('/user/me');
export const updateMe = (data) => api.patch('/user/me', data);
export const changePassword = (data) => api.patch('/user/me/password', data);
export const getStats = () => api.get('/user/me/stats');
