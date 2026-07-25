import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Role = 'caregiver' | 'elderly' | 'existing' | null;

interface AuthState {
  role: Role;
  isLoggedIn: boolean;
  userName: string;
  userId: string;
  token: string | null;
  hydrated: boolean;
  setRole: (r: Role) => void;
  login: (name: string, token: string, userId: string, role: Role) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null, isLoggedIn: false, userName: '', userId: '', token: null, hydrated: false,
      setRole: (role) => set({ role }),
      login: (name, token, userId, role) => set({ isLoggedIn: true, userName: name, token, userId, role }),
      logout: () => set({ isLoggedIn: false, role: null, userName: '', userId: '', token: null }),
    }),
    {
      name: 'famicare-auth',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => { if (state) state.hydrated = true; },
    }
  )
);
