import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

type Role = 'caregiver' | 'elderly' | null;

interface AuthState {
  role: Role;
  isLoggedIn: boolean;
  userName: string;
  userId: string;
  token: string | null;
  setRole: (r: Role) => void;
  login: (name: string, token: string, userId: string, role: Role) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      role: null, isLoggedIn: false, userName: '', userId: '', token: null,
      setRole: (role) => set({ role }),
      login: (name, token, userId, role) => set({ isLoggedIn: true, userName: name, token, userId, role }),
      logout: () => set({ isLoggedIn: false, role: null, userName: '', userId: '', token: null }),
    }),
    {
      name: 'famicare-auth',
      storage: createJSONStorage(() => ({
        getItem: (name) => SecureStore.getItemAsync(name),
        setItem: (name, value) => SecureStore.setItemAsync(name, value),
        removeItem: (name) => SecureStore.deleteItemAsync(name),
      })),
    }
  )
);
