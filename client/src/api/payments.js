import api from './axios';

export const getPackages = () => api.get('/payments/packages');
export const getBalance = () => api.get('/credits/balance');
export const getCreditHistory = (params) => api.get('/credits/history', { params });
export const initializeKorapay = (data) => api.post('/payments/korapay/initialize', data);
export const verifyKorapay = (reference) => api.get(`/payments/korapay/verify/${reference}`);
export const createOxprocessing = (data) => api.post('/payments/oxprocessing/create', data);
export const getPaymentHistory = (params) => api.get('/payments/history', { params });
export const validatePromo = (data) => api.post('/payments/promo/validate', data);
export const getWelcomeBonusStatus = () => api.get('/welcome-bonus/status');
export const claimWelcomeBonus = () => api.post('/welcome-bonus/claim');
