import api from './axios';

export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const logout = () => api.post('/auth/logout');
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email });
export const resetPassword = (data) => api.post('/auth/reset-password', data);
// Stamp the just-signed-up user's first-touch acquisition source (server sets
// it only if empty). Authenticated — call after the access token is set.
export const setAttribution = (data) => api.post('/user/attribution', data);
