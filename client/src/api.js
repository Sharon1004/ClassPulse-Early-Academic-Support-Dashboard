import { useState, useEffect, useCallback } from 'react';

const KEY = 'classpulse_token';
export const getToken = () => sessionStorage.getItem(KEY);
export const setToken = (t) => sessionStorage.setItem(KEY, t);
export const clearToken = () => sessionStorage.removeItem(KEY);

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check that it is running.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && token) { clearToken(); window.dispatchEvent(new Event('classpulse-logout')); }
  if (!res.ok) { const e = new Error(data?.error || `Request failed (${res.status})`); e.data = data; throw e; }
  return data;
}

// Loads a GET endpoint. Keeps the previous data visible while a new request is loading.
export function useApi(path) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const load = useCallback(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    api(path)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((e) => !cancelled && setState({ data: null, loading: false, error: e.message }));
    return () => { cancelled = true; };
  }, [path]);
  useEffect(() => load(), [load]);
  return { ...state, reload: load };
}
