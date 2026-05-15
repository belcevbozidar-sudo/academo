import Sidebar from "./Sidebar.tsx";
import Header from "./Header.tsx";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useAuth } from "@/hooks/use-auth.ts";
import { useNavigate } from "react-router-dom";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { signoutRedirect, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const hasCheckedAuth = useRef(false);
  const hasRecordedSession = useRef(false);
  const recordLoginSession = useMutation(api.users.recordLoginSession);
  const isPreviewMode = localStorage.getItem("academo.previewAuth") === "true";

  // Only query when authenticated
  const isAuthenticated = !isLoading && !!user;

  // Monitor for authentication errors
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated && !isPreviewMode ? {} : "skip",
  );

  // Record device info for the current session once after login
  useEffect(() => {
    if (
      !isPreviewMode &&
      isAuthenticated &&
      currentUser &&
      !hasRecordedSession.current
    ) {
      hasRecordedSession.current = true;
      const ua = navigator.userAgent;
      // Parse browser and device from user agent
      let browser = "Неизвестен";
      if (ua.includes("Firefox")) browser = "Firefox";
      else if (ua.includes("Edg/")) browser = "Edge";
      else if (ua.includes("Chrome")) browser = "Chrome";
      else if (ua.includes("Safari")) browser = "Safari";

      let device = "Десктоп";
      if (/Mobi|Android/i.test(ua)) device = "Мобилен";
      else if (/Tablet|iPad/i.test(ua)) device = "Таблет";

      recordLoginSession({ userAgent: ua, device, browser }).catch(() => {
        // Silently fail - non-critical
      });
    }
  }, [isAuthenticated, currentUser, recordLoginSession, isPreviewMode]);

  useEffect(() => {
    // Only check for auth issues if:
    // 1. We're authenticated (user exists)
    // 2. Auth loading is complete
    // 3. getCurrentUser query has returned (not undefined)
    // 4. getCurrentUser returned null (user not found in DB)
    // 5. We haven't already checked (prevent loop)
    const shouldCheckAuth =
      !isPreviewMode &&
      isAuthenticated &&
      currentUser === null &&
      !hasCheckedAuth.current;

    if (shouldCheckAuth) {
      hasCheckedAuth.current = true;

      const checkAuthError = async () => {
        try {
          console.error("User not found in Layout - clearing all auth data");

          // Clear all storage
          sessionStorage.clear();
          localStorage.clear();

          // Clear all cookies
          document.cookie.split(";").forEach(function (c) {
            document.cookie = c
              .replace(/^ +/, "")
              .replace(
                /=.*/,
                "=;expires=" + new Date().toUTCString() + ";path=/",
              );
          });

          // Sign out
          await signoutRedirect();

          // Navigate to home and reload to ensure clean state
          navigate("/", { replace: true });
          window.location.reload();
        } catch (error) {
          console.error("Auth error in Layout:", error);
          // Clear session and redirect on any error
          sessionStorage.clear();
          localStorage.clear();

          // Clear cookies
          document.cookie.split(";").forEach(function (c) {
            document.cookie = c
              .replace(/^ +/, "")
              .replace(
                /=.*/,
                "=;expires=" + new Date().toUTCString() + ";path=/",
              );
          });

          await signoutRedirect();
          navigate("/", { replace: true });
          window.location.reload();
        }
      };

      checkAuthError();
    }
  }, [currentUser, signoutRedirect, navigate, isAuthenticated, isPreviewMode]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_32%_0%,rgba(107,76,255,0.22),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(255,39,54,0.16),transparent_30%),linear-gradient(180deg,#fff_0%,#f7f1ff_38%,#ffe9ee_100%)] font-sans text-foreground">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <Header onMenuClick={() => setIsSidebarOpen(true)} />
      <main className="px-3 pb-8 pt-24 sm:px-4 md:ml-72 md:px-7 md:pt-28">
        {children}
      </main>
    </div>
  );
}
