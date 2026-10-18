const ONBOARDING_KEY = 'qr-att-onboarding-complete';

export async function hasCompletedOnboarding(): Promise<boolean> {
  return window.localStorage.getItem(ONBOARDING_KEY) === 'true';
}

export async function completeOnboarding(): Promise<void> {
  window.localStorage.setItem(ONBOARDING_KEY, 'true');
}
