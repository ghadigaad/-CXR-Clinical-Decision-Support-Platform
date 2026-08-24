import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { ApiError } from '../api/client';
import { authApi, queryKeys } from '../api/resources';
import type { Doctor } from '../types/api';

interface AuthContextValue {
  doctor: Doctor | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.session,
    queryFn: authApi.me,
    // A 401 here just means "not signed in", which is an expected state, not a failure
    // worth retrying.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 401) && failureCount < 2,
    staleTime: 5 * 60 * 1000,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      queryClient.setQueryData(queryKeys.session, result);
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Drop every cached response on sign-out so patient data cannot linger in memory
      // for the next person to use this browser.
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ doctor: data?.doctor ?? null, isLoading, login, logout }),
    [data, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
