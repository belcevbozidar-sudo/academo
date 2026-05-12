import { api } from "@/convex/_generated/api.js";
import { ConvexHttpClient } from "convex/browser";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthProfile = {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  role?: string;
};

type AuthUser = {
  profile: AuthProfile;
  access_token: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  signinRedirect: () => Promise<void>;
  signoutRedirect: () => Promise<void>;
  removeUser: () => Promise<void>;
  signInWithPassword: (args: {
    username: string;
    password: string;
  }) => Promise<void>;
  bootstrapFirstAdmin: (args: {
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    password: string;
  }) => Promise<void>;
};

type DecodedToken = {
  exp?: number;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  role?: string;
  sub?: string;
};

const AUTH_STORAGE_KEY = "academo.auth.session";
const PREVIEW_STORAGE_KEY = "academo.previewAuth";
const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "";
const httpClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwtPayload(token: string): DecodedToken | null {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(json) as DecodedToken;
  } catch {
    return null;
  }
}

function isTokenValid(token: string) {
  const decoded = decodeJwtPayload(token);
  if (!decoded?.exp) return false;
  return decoded.exp * 1000 > Date.now();
}

function getPreviewUser(): AuthUser {
  return {
    access_token: "preview",
    profile: {
      sub: "preview-admin",
      email: "demo.admin@academo.local",
      name: "Demo Admin",
      given_name: "Demo",
      family_name: "Admin",
      role: "system_admin",
    },
  };
}

async function syncCurrentUser(token: string): Promise<AuthUser> {
  if (!httpClient) {
    throw new Error("Липсва връзка към базата данни.");
  }

  httpClient.setAuth(token);
  await httpClient.mutation(api.users.updateCurrentUser, {});
  const currentUser = await httpClient.query(api.users.getCurrentUser, {});

  if (!currentUser) {
    throw new Error("Потребителят не е намерен в системата.");
  }

  return {
    access_token: token,
    profile: {
      sub: currentUser.tokenIdentifier,
      email: currentUser.email ?? undefined,
      name: currentUser.name ?? undefined,
      given_name: currentUser.firstName ?? undefined,
      family_name: currentUser.lastName ?? undefined,
      role: currentUser.role,
    },
  };
}

function persistSession(user: AuthUser | null) {
  if (!user) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const clearSession = useCallback(() => {
    persistSession(null);
    if (httpClient) {
      httpClient.clearAuth();
    }
    setUser(null);
  }, []);

  useEffect(() => {
    const previewMode = localStorage.getItem(PREVIEW_STORAGE_KEY) === "true";
    if (previewMode) {
      setUser(getPreviewUser());
      setIsLoading(false);
      return;
    }

    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as AuthUser;
      if (!parsed?.access_token || !isTokenValid(parsed.access_token)) {
        clearSession();
        setIsLoading(false);
        return;
      }
      setUser(parsed);
    } catch {
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  const finalizeLogin = useCallback(async (token: string) => {
    setError(null);
    const syncedUser = await syncCurrentUser(token);
    persistSession(syncedUser);
    setUser(syncedUser);
    localStorage.removeItem(PREVIEW_STORAGE_KEY);
  }, []);

  const signInWithPassword = useCallback(
    async (args: { username: string; password: string }) => {
      if (!httpClient) {
        throw new Error("Липсва връзка към базата данни.");
      }

      setIsLoading(true);
      try {
        const result = await httpClient.action(
          api.usersActions.signInWithPasswordAction,
          args,
        );
        await finalizeLogin(result.token);
      } catch (authError) {
        const resolvedError =
          authError instanceof Error
            ? authError
            : new Error("Неуспешен вход в системата.");
        setError(resolvedError);
        throw resolvedError;
      } finally {
        setIsLoading(false);
      }
    },
    [finalizeLogin],
  );

  const bootstrapFirstAdmin = useCallback(
    async (args: {
      firstName: string;
      lastName: string;
      email: string;
      username: string;
      password: string;
    }) => {
      if (!httpClient) {
        throw new Error("Липсва връзка към базата данни.");
      }

      setIsLoading(true);
      try {
        const result = await httpClient.action(
          api.usersActions.bootstrapFirstAdminAction,
          args,
        );
        await finalizeLogin(result.token);
      } catch (authError) {
        const resolvedError =
          authError instanceof Error
            ? authError
            : new Error("Неуспешно създаване на начален администратор.");
        setError(resolvedError);
        throw resolvedError;
      } finally {
        setIsLoading(false);
      }
    },
    [finalizeLogin],
  );

  const removeUser = useCallback(async () => {
    localStorage.removeItem(PREVIEW_STORAGE_KEY);
    clearSession();
    setError(null);
  }, [clearSession]);

  const signoutRedirect = useCallback(async () => {
    await removeUser();
    const segments = window.location.pathname.split("/").filter(Boolean);
    const locale = segments[0] || "bg";
    window.location.href = `/${locale}`;
  }, [removeUser]);

  const signinRedirect = useCallback(async () => {
    window.dispatchEvent(new CustomEvent("academo:show-auth"));
    const segments = window.location.pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      window.location.href = "/bg";
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      error,
      signinRedirect,
      signoutRedirect,
      removeUser,
      signInWithPassword,
      bootstrapFirstAdmin,
    }),
    [
      bootstrapFirstAdmin,
      error,
      isLoading,
      removeUser,
      signInWithPassword,
      signinRedirect,
      signoutRedirect,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}

export function useStoredAuthToken() {
  return useAuthContext().user?.access_token ?? null;
}
