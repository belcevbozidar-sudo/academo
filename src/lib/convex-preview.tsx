import type { ReactNode } from "react";
import * as ConvexReact from "convex/react";
import { useAuth } from "@/hooks/use-auth.ts";

export * from "convex/react";

export const useQuery = ConvexReact.useQuery;
export const useMutation = ConvexReact.useMutation;
export const useAction = ConvexReact.useAction;
export const usePaginatedQuery = ConvexReact.usePaginatedQuery;
export const useQueries = ConvexReact.useQueries;
export const useConvex = ConvexReact.useConvex;
export const ConvexProvider = ConvexReact.ConvexProvider;
export const ConvexProviderWithAuth = ConvexReact.ConvexProviderWithAuth;
export const ConvexReactClient = ConvexReact.ConvexReactClient;

function isPreviewMode() {
  return localStorage.getItem("academo.previewAuth") === "true";
}

export function Authenticated({ children }: { children: ReactNode }) {
  const appAuth = useAuth();
  const convexAuth = ConvexReact.useConvexAuth();

  if (isPreviewMode()) {
    return <>{children}</>;
  }

  if (
    appAuth.isLoading ||
    convexAuth.isLoading ||
    !appAuth.isAuthenticated ||
    !convexAuth.isAuthenticated
  ) {
    return null;
  }

  return <>{children}</>;
}

export function Unauthenticated({ children }: { children: ReactNode }) {
  const appAuth = useAuth();
  const convexAuth = ConvexReact.useConvexAuth();

  if (isPreviewMode() || appAuth.isAuthenticated) {
    return null;
  }

  if (appAuth.isLoading || convexAuth.isLoading) {
    return null;
  }

  return <>{children}</>;
}

export function AuthLoading({ children }: { children: ReactNode }) {
  const appAuth = useAuth();
  const convexAuth = ConvexReact.useConvexAuth();

  if (isPreviewMode()) {
    return null;
  }

  if (!appAuth.isLoading && !convexAuth.isLoading) {
    return null;
  }

  return <>{children}</>;
}

export function useConvexAuth(): {
  isLoading: boolean;
  isAuthenticated: boolean;
} {
  const appAuth = useAuth();
  const convexAuth = ConvexReact.useConvexAuth();

  if (isPreviewMode()) {
    return {
      isLoading: false,
      isAuthenticated: true,
    };
  }

  return {
    isLoading: appAuth.isLoading || convexAuth.isLoading,
    isAuthenticated: appAuth.isAuthenticated && convexAuth.isAuthenticated,
  };
}
