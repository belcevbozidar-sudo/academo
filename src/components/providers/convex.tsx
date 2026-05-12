import { useAuthContext } from "./auth.tsx";
import { ConvexProviderWithAuth, ConvexReactClient } from "@/lib/convex-preview";
import { useCallback, useMemo } from "react";

const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "http://localhost:3000";
const convex = new ConvexReactClient(convexUrl);

function useConvexAuthBridge() {
  const { user, isLoading } = useAuthContext();
  const isPreviewMode = localStorage.getItem("academo.previewAuth") === "true";

  const fetchAccessToken = useCallback(async () => {
    if (isPreviewMode) {
      return null;
    }
    return user?.access_token ?? null;
  }, [isPreviewMode, user?.access_token]);

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: Boolean(user),
      fetchAccessToken,
    }),
    [fetchAccessToken, isLoading, user],
  );
}

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthBridge}>
      {children}
    </ConvexProviderWithAuth>
  );
}
