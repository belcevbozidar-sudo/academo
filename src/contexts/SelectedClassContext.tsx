import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

interface SelectedClassContextType {
  selectedClassId: Id<"classes"> | null;
  setSelectedClassId: (classId: Id<"classes"> | null) => void;
}

const SelectedClassContext = createContext<SelectedClassContextType | undefined>(undefined);

export function SelectedClassProvider({ children }: { children: ReactNode }) {
  const [selectedClassId, setSelectedClassIdState] = useState<Id<"classes"> | null>(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem("selectedClassId");
    return stored ? (stored as Id<"classes">) : null;
  });

  const setSelectedClassId = (classId: Id<"classes"> | null) => {
    setSelectedClassIdState(classId);
    if (classId) {
      localStorage.setItem("selectedClassId", classId);
    } else {
      localStorage.removeItem("selectedClassId");
    }
  };

  return (
    <SelectedClassContext.Provider value={{ selectedClassId, setSelectedClassId }}>
      {children}
    </SelectedClassContext.Provider>
  );
}

export function useSelectedClass() {
  const context = useContext(SelectedClassContext);
  if (context === undefined) {
    throw new Error("useSelectedClass must be used within a SelectedClassProvider");
  }
  return context;
}
