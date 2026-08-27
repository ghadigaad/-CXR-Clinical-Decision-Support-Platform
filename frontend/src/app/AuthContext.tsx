import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ApiError } from '../api/client';
import { authApi, queryKeys } from '../api/resources';
import type { Doctor } from '../types/api';

interface AuthContextValue {
  doctor: Doctor | null;
  isLoading: boolean;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readMagicLinkFromLocation():
  | { accessToken: string }
  | { tokenHash: string; type: 'email' | 'magiclink' }
  | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  if (accessToken) return { accessToken };

  const query = new URLSearchParams(window.location.search);
  const tokenHash = query.get('token_hash') ?? query.get('token');
  const rawType = query.get('type');
  if (tokenHash) {
    const type = rawType === 'magiclink' ? 'magiclink' : 'email';
    return { tokenHash, type };
  }
  return null;
}

function stripAuthParamsFromUrl(): void {
  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.delete('token_hash');
  url.searchParams.delete('token');
  url.searchParams.delete('type');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [linkPending, setLinkPending] = useState(() => Boolean(readMagicLinkFromLocation()));

  const { data, isLoading: sessionLoading } = useQuery({
    queryKey: queryKeys.session,
    queryFn: authApi.me,
    enabled: !linkPending,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 401) && failureCount < 2,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const payload = readMagicLinkFromLocation();
    if (!payload) {
      setLinkPending(false);
      return;
    }

    let cancelled = false;
    authApi
      .completeLink(payload)
      .then((result) => {
        if (cancelled) return;
        queryClient.setQueryData(queryKeys.session, result);
        stripAuthParamsFromUrl();
      })
      .catch(() => {
        if (!cancelled) stripAuthParamsFromUrl();
      })
      .finally(() => {
        if (!cancelled) setLinkPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const requestOtp = useCallback(async (email: string) => {
    await authApi.requestOtp(email);
  }, []);

  const verifyOtp = useCallback(
    async (email: string, token: string) => {
      const result = await authApi.verifyOtp(email, token);
      queryClient.setQueryData(queryKeys.session, result);
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      doctor: data?.doctor ?? null,
      isLoading: linkPending || sessionLoading,
      requestOtp,
      verifyOtp,
      logout,
    }),
    [data, linkPending, sessionLoading, requestOtp, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
