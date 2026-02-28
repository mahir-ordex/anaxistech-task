import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

export interface Session {
  id: string;
  deviceName: string;
  browser: string;
  isSuspicious: boolean;
  suspiciousReason?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  currentSession: Session | null;
  requiresVerification: boolean;
  isAuthenticated: boolean;
  
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
  setCurrentSession: (session: Session | null) => void;
  setRequiresVerification: (requires: boolean) => void;
  login: (user: User, accessToken: string, session: Session, requiresVerification?: boolean, refreshToken?: string) => void;
  logout: (broadcast?: boolean) => void;
}

// BroadcastChannel for cross-tab logout synchronization
const logoutChannel = new BroadcastChannel('auth-logout');

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      currentSession: null,
      requiresVerification: false,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setAccessToken: (accessToken) => set({ accessToken }),
      
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      
      setCurrentSession: (currentSession) => set({ currentSession }),
      
      setRequiresVerification: (requiresVerification) => set({ requiresVerification }),
      
      login: (user, accessToken, session, requiresVerification = false, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken: refreshToken || null,
          currentSession: session,
          requiresVerification,
          isAuthenticated: true,
        }),
      
      logout: (broadcast = true) => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          currentSession: null,
          requiresVerification: false,
          isAuthenticated: false,
        });
        // Broadcast logout to other tabs
        if (broadcast) {
          logoutChannel.postMessage({ type: 'LOGOUT' });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        currentSession: state.currentSession,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Listen for logout messages from other tabs
logoutChannel.onmessage = (event) => {
  if (event.data?.type === 'LOGOUT') {
    // Clear state without broadcasting again (to avoid loop)
    useAuthStore.getState().logout(false);
    // Redirect to login page
    window.location.href = '/login';
  }
};
