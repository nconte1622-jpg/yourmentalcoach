const ONBOARDING_KEY = "onboarding-complete-v1";

export function isOnboardingComplete() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function completeOnboarding() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // Ignore local storage failures.
  }
}
