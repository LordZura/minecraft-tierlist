export type SessionUser = {
  id: string;
  username: string;
  is_admin: boolean;
};

const STORAGE_KEY = 'mct_user';
const ADMIN_UNLOCK_KEY = 'mct_admin_unlock';

export function setSessionUser(user: SessionUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearSessionUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function isAdminUnlocked() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ADMIN_UNLOCK_KEY) === '1';
}

export function setAdminUnlocked(value: boolean) {
  if (typeof window === 'undefined') return;
  if (value) localStorage.setItem(ADMIN_UNLOCK_KEY, '1');
  else localStorage.removeItem(ADMIN_UNLOCK_KEY);
}
