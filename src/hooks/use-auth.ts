import { useAuthContext } from "@/components/providers/auth.tsx";

export function useAuth() {
  return useAuthContext();
}

export function useUser() {
  const { user, isAuthenticated, isLoading } = useAuthContext();
  return {
    user,
    isAuthenticated,
    isLoading,
  };
}
