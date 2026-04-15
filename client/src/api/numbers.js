import api from './axios';

export const getCountries = () => api.get('/numbers/countries');
export const getServices = (countryId) => api.get(`/numbers/countries/${countryId}/services`);
export const orderNumber = (data) => api.post('/numbers/order', data);
export const getActiveOrders = () => api.get('/numbers/active');
export const getOrderHistory = (params) => api.get('/numbers/history', { params });
export const cancelOrder = (orderId) => api.post(`/numbers/${orderId}/cancel`);
export const resendSMS = (orderId) => api.post(`/numbers/${orderId}/resend`);
export const orderRental = (data) => api.post('/numbers/order/rental', data);
