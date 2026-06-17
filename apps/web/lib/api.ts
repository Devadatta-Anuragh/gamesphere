import axios, { type AxiosResponse } from 'axios';
import { getToken } from './token';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const api = axios.create({ baseURL: `${API_URL}/api` });

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** All API responses are wrapped in `{ data: ... }`; this unwraps it. */
export const unwrap = <T>(res: AxiosResponse<{ data: T }>): T => res.data.data;
