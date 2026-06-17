const KEY = 'gs_token';

/** Tiny token store backed by localStorage (SSR-safe). */
export const getToken = (): string | null =>
  typeof window === 'undefined' ? null : window.localStorage.getItem(KEY);

export const setToken = (token: string): void => {
  if (typeof window !== 'undefined') window.localStorage.setItem(KEY, token);
};

export const clearToken = (): void => {
  if (typeof window !== 'undefined') window.localStorage.removeItem(KEY);
};
