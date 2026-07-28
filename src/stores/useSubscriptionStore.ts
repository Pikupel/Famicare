import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { isPremium, getCustomerInfo, getExpirationDate, setupPurchases } from '../services/purchases';

interface SubscriptionState {
  isSubscribed: boolean;
  expiresAt: string | null;
  productId: string | null;
  syncFromRevenueCat: (userId: string) => Promise<void>;
  setSubscribed: (value: boolean, productId?: string | null, expiresAt?: string | null) => void;
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
        const subscribed = isPremium(info);
        const expires = getExpirationDate(info);
        set({
          isSubscribed: subscribed,
          expiresAt: expires,
          productId: info?.entitlements.active.premium?.productIdentifier ?? null,
        });
      },
      setSubscribed: (value, productId = null, expiresAt = null) => set({ isSubscribed: value, productId, expiresAt }),
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
