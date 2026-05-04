import { useAuth as useManusAuth } from './useAuth';

export function useAuthWithDevBypass() {
  const auth = useManusAuth();
  
  // Server handles dev bypass automatically in development mode
  // Just pass through the auth state
  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    loading: auth.loading,
    error: auth.error,
    refresh: auth.refresh,
    logout: auth.logout,
  };
}
