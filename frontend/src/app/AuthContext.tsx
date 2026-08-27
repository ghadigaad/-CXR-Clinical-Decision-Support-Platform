import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.session,
    queryFn: authApi.me,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 401) && failureCount < 2,
    staleTime: 5 * 60 * 1000,
  });

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
      isLoading,
      requestOtp,
      verifyOtp,
      logout,
    }),
    [data, isLoading, requestOtp, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
