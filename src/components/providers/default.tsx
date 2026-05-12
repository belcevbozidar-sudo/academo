import { AuthProvider } from "./auth.tsx";
import { ConvexProvider } from "./convex.tsx";
import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";
import { SelectedClassProvider } from "../../contexts/SelectedClassContext.tsx";
import ErrorBoundary from "../ErrorBoundary.tsx";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConvexProvider>
          <QueryClientProvider>
            <TooltipProvider>
              <ThemeProvider>
                <SelectedClassProvider>
                  <Toaster />
                  {children}
                </SelectedClassProvider>
              </ThemeProvider>
            </TooltipProvider>
          </QueryClientProvider>
        </ConvexProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
