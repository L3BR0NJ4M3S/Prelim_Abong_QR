import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'qr-att-onboarding-complete';

export async function hasCompletedOnboarding(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === 'true';
}

export async function completeOnboarding(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
}
