import api from './axios';

export const getPackages = () => api.get('/payments/packages');
export const getBalance = () => api.get('/credits/balance');
export const getCreditHistory = (params) => api.get('/credits/history', { params });
export const initializePaystack = (data) => api.post('/payments/paystack/initialize', data);
export const verifyPaystack = (reference) => api.get(`/payments/paystack/verify/${reference}`);
export const createCrypto = (data) => api.post('/payments/crypto/create', data);
export const getPaymentHistory = (params) => api.get('/payments/history', { params });
