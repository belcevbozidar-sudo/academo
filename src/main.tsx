import { createRoot } from "react-dom/client";
import App from "./App.tsx";

try {
  localStorage.setItem("theme", "light");
  document.documentElement.classList.remove("dark");
  document.documentElement.classList.add("light");
} catch {
  // Keep startup resilient when storage is unavailable.
}

createRoot(document.getElementById("root")!).render(<App />);
