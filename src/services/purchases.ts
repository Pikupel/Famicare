import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';
const ENTITLEMENT_ID = 'premium';

let initialized = false;

export async function setupPurchases(userId: string | null) {
  if (!API_KEY) return;
  try {
    if (!initialized) {
      Purchases.configure({ apiKey: API_KEY });
      initialized = true;
    }
    if (userId) await Purchases.logIn(userId);
  } catch {}
}

export async function getOfferings(): Promise<{
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
  lifetime: PurchasesPackage | null;
}> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    return {
      monthly: current?.monthly ?? null,
      annual: current?.annual ?? null,
      lifetime: current?.lifetime ?? null,
    };
  } catch {
    return { monthly: null, annual: null, lifetime: null };
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return isPremium(customerInfo);
  } catch {
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return isPremium(info);
  } catch {
    return false;
  }
}

export function isPremium(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
}

export function getExpirationDate(info: CustomerInfo | null): string | null {
  const entitlement = info?.entitlements.active[ENTITLEMENT_ID];
  if (!entitlement) return null;
  if (entitlement.productIdentifier?.includes('lifetime')) return 'lifetime';
  return entitlement.expirationDate ?? null;
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}
