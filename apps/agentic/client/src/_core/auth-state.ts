export const RUNTIME_USER_INFO_STORAGE_KEY = "manus-runtime-user-info";
export const LOGIN_RETURN_TO_STORAGE_KEY = "loginReturnTo";

export function persistRuntimeUserInfo(user: unknown) {
  if (typeof window === "undefined") return;

  if (user == null) {
    window.localStorage.removeItem(RUNTIME_USER_INFO_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    RUNTIME_USER_INFO_STORAGE_KEY,
    JSON.stringify(user)
  );
}

export function clearPersistedAuthState() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(RUNTIME_USER_INFO_STORAGE_KEY);
  window.sessionStorage.removeItem(LOGIN_RETURN_TO_STORAGE_KEY);
}

export function replaceBrowserLocation(url: string) {
  if (typeof window === "undefined") return;

  window.location.replace(url);
}
