import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { isPremium, getCustomerInfo, getExpirationDate, setupPurchases } from '../services/purchases';
import { api } from '../services/api';

interface SubscriptionState {
  isSubscribed: boolean;
  expiresAt: string | null;
  productId: string | null;
  syncFromRevenueCat: (userId: string) => Promise<boolean>;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      isSubscribed: false,
      expiresAt: null,
      productId: null,
      syncFromRevenueCat: async (userId) => {
        await setupPurchases(userId);
        const info = await getCustomerInfo();
        const localStatus = {
          isSubscribed: isPremium(info),
          expiresAt: getExpirationDate(info),
          productId: info?.entitlements.active.premium?.productIdentifier ?? null,
        };
        set(localStatus);
        try {
          const verified = await api.post<{ active: boolean; expiresAt: string | null; productId: string | null }>('/me/subscription/sync', {});
          set({ isSubscribed: verified.active, expiresAt: verified.expiresAt, productId: verified.productId });
          return verified.active;
        } catch (error) {
          console.warn('[subscription] Sunucu doğrulaması tamamlanamadı:', error);
          return false;
        }
      },
      reset: () => set({ isSubscribed: false, expiresAt: null, productId: null }),
    }),
    {
      name: 'famicare-subscription',
      storage: createJSONStorage(() => ({
        getItem: (name) => SecureStore.getItemAsync(name),
        setItem: (name, value) => SecureStore.setItemAsync(name, value),
        removeItem: (name) => SecureStore.deleteItemAsync(name),
      })),
      partialize: (state) => ({ isSubscribed: state.isSubscribed, expiresAt: state.expiresAt, productId: state.productId }),
    }
  )
);
