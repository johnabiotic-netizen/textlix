import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,

  setUser: (user) => set({ user }),
  setAccessToken: (token) => set({ accessToken: token }),
  setLoading: (isLoading) => set({ isLoading }),

  setAuth: (user, token) => {
    // Clear SSO retry flags whenever auth is successfully established
    try {
      sessionStorage.removeItem('mainSsoTried');
      sessionStorage.removeItem('ssoTried');
    } catch {}
    set({ user, accessToken: token, isLoading: false });
  },

  logout: () => set({ user: null, accessToken: null, isLoading: false }),
}));

export default useAuthStore;
