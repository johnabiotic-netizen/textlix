import axios from 'axios';
import api from './axios';

const PUBLIC_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

export const getPublicStats = () => axios.get(`${PUBLIC_BASE}/stats`);

export const getCountries = (mode = 'otp') => api.get('/numbers/countries', { params: { mode } });
export const getServiceList = (mode = 'otp') => api.get('/numbers/services', { params: { mode } });
export const getCountriesForService = (serviceSlug, mode = 'otp') => api.get(`/numbers/services/${serviceSlug}/countries`, { params: { mode } });
export const getServices = (countryId) => api.get(`/numbers/countries/${countryId}/services`);
export const orderNumber = (data) => api.post('/numbers/order', data);
export const getActiveOrders = () => api.get('/numbers/active');
export const getOrderHistory = (params) => api.get('/numbers/history', { params });
export const cancelOrder = (orderId) => api.post(`/numbers/${orderId}/cancel`);
export const resendSMS = (orderId) => api.post(`/numbers/${orderId}/resend`);
export const getRentalPrice = (countryId) => api.get(`/numbers/countries/${countryId}/rental-price`);
export const orderRental = (data) => api.post('/numbers/order/rental', data);
