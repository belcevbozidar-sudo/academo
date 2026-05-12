import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { AlertTriangleIcon, XIcon, PlusIcon, ClockIcon, InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface WeekInfo {
  startDate: string;
  endDate: string;
  weekNumber: number;
}

interface RegimeRow {
  period: number;
  time: string;
  duration: number;
}

interface LessonSlot {
  subjectId: Id<"subjects"> | null;
  teacherId: Id<"teachers"> | null;
  preparationType?: string;
  groupId?: Id<"classGroups">;
  id: string;
}

// Calculate ISO week number (same as ClassSchedule.tsx display)
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeeksInPeriod(startDate: string, endDate: string): WeekInfo[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const weeks: WeekInfo[] = [];
  
  let current = new Date(start);
  
  while (current <= end) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    if (weekEnd > end) {
      weekEnd.setTime(end.getTime());
    }
    
    // Use ISO week number to match the display in ClassSchedule.tsx
    const isoWeek = getISOWeekNumber(weekStart);
    
    weeks.push({
      startDate: weekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      weekNumber: isoWeek,
    });
    
    current.setDate(current.getDate() + 7);
  }
  
  return weeks;
}

function formatDateBG(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${day}.${month}.${year}`;
}

function AddWeeklyScheduleInner() {
  const { classId, scheduleId } = useParams<{ classId: string; scheduleId?: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  
  // Check if we're in edit mode
  const isEditMode = !!scheduleId;
  
  // Validate classId format (Convex IDs are alphanumeric and > 20 chars)
  const isValidClassId = classId && classId.length > 20 && /^[a-z0-9]+$/.test(classId);
  
  // Validate scheduleId format if present
  const isValidScheduleId = !scheduleId || (scheduleId.length > 20 && /^[a-z0-9]+$/.test(scheduleId));
  
  // Load existing schedule if in edit mode
  const existingSchedule = useQuery(
    api.weeklySchedules.getById,
    scheduleId && isValidScheduleId ? { id: scheduleId as Id<"weeklySchedules"> } : "skip"
  );
  
  // Step 2 - Period data
  const [term, setTerm] = useState<1 | 2>(1);
  const [hasLoadedEditData, setHasLoadedEditData] = useState(false);
  
  // Get default dates based on current academic year
  const getDefaultDates = (termNum: 1 | 2) => {
    const year = new Date().getFullYear();
    const month = new Date().getMonth();
    const academicYearStart = month >= 8 ? year : year - 1;
    if (termNum === 1) {
      return {
        start: `${academicYearStart}-09-15`,
        end: `${academicYearStart + 1}-02-05`,
      };
    } else {
      return {
        start: `${academicYearStart + 1}-02-06`,
        end: `${academicYearStart + 1}-06-30`,
      };
    }
  };
  
  // Store dates for each term separately (persisted to database)
  const [term1StartDate, setTerm1StartDate] = useState(() => getDefaultDates(1).start);
  const [term1EndDate, setTerm1EndDate] = useState(() => getDefaultDates(1).end);
  const [term2StartDate, setTerm2StartDate] = useState(() => getDefaultDates(2).start);
  const [term2EndDate, setTerm2EndDate] = useState(() => getDefaultDates(2).end);
  
  // Current active dates (based on selected term)
  const startDate = term === 1 ? term1StartDate : term2StartDate;
  const endDate = term === 1 ? term1EndDate : term2EndDate;
  
  // Setters that update the correct term's dates
  const setStartDate = (date: string) => {
    if (term === 1) {
      setTerm1StartDate(date);
    } else {
      setTerm2StartDate(date);
    }
  };
  
  const setEndDate = (date: string) => {
    if (term === 1) {
      setTerm1EndDate(date);
    } else {
      setTerm2EndDate(date);
    }
  };
  
  const [selectedWeeks, setSelectedWeeks] = useState<Set<number>>(new Set());
  
  // Store raw entries from database for week-specific filtering in edit mode
  type RawEntry = {
    dayOfWeek: number;
    periodIndex: number;
    subjectId: Id<"subjects">;
    teacherId: Id<"teachers">;
    preparationType?: string;
    weekNumbers?: number[];
    groupId?: Id<"classGroups">;
  };
  const [allEntriesFromDb, setAllEntriesFromDb] = useState<RawEntry[]>([]);
  const [editWeeksLoaded, setEditWeeksLoaded] = useState(false);
  
  // Step 3 - Regime data
  const [selectedRegimeId, setSelectedRegimeId] = useState<Id<"dayRegimes"> | null>(null);
  const [regimeData, setRegimeData] = useState<RegimeRow[]>([
    { period: 1, time: "", duration: 40 },
    { period: 2, time: "", duration: 40 },
    { period: 3, time: "", duration: 40 },
    { period: 4, time: "", duration: 40 },
    { period: 5, time: "", duration: 40 },
    { period: 6, time: "", duration: 40 },
    { period: 7, time: "", duration: 40 },
  ]);
  
  // Steps 4-8 - Daily schedules (Monday to Friday)
  const [mondaySchedule, setMondaySchedule] = useState<LessonSlot[][]>(
    Array(7).fill(null).map(() => [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }])
  );
  const [tuesdaySchedule, setTuesdaySchedule] = useState<LessonSlot[][]>(
    Array(7).fill(null).map(() => [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }])
  );
  const [wednesdaySchedule, setWednesdaySchedule] = useState<LessonSlot[][]>(
    Array(7).fill(null).map(() => [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }])
  );
  const [thursdaySchedule, setThursdaySchedule] = useState<LessonSlot[][]>(
    Array(7).fill(null).map(() => [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }])
  );
  const [fridaySchedule, setFridaySchedule] = useState<LessonSlot[][]>(
    Array(7).fill(null).map(() => [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }])
  );
  
  const classData = useQuery(
    api.admin.getClassById,
    isValidClassId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Get current user for admin check
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  // Check if user is admin (only admins can edit schedules)
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");
  
  // Redirect non-admins away
  useEffect(() => {
    if (currentUser && !isAdmin) {
      navigate(`/bg/diary/class/${classId}/schedule`);
    }
  }, [currentUser, isAdmin, navigate, classId]);
  
  // Get subject-teacher combinations for this class (from "Предмети и учители")
  const classSubjectsTeachers = useQuery(
    api.admin.getClassSubjectsTeachers,
    isValidClassId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Get class groups for this class
  const classGroups = useQuery(
    api.classGroups.listByClass,
    isValidClassId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const schoolData = useQuery(api.admin.getDefaultSchool, {});
  
  // Fetch day regimes for the school
  const dayRegimes = useQuery(
    api.dayRegimes.list,
    schoolData?.schoolId 
      ? { schoolId: schoolData.schoolId }
      : "skip"
  );
  
  // Fetch full details of selected day regime (with periods)
  const selectedRegimeDetails = useQuery(
    api.dayRegimes.getById,
    selectedRegimeId ? { id: selectedRegimeId } : "skip"
  );
  
  const createSchedule = useMutation(api.weeklySchedules.create);
  const updateSchedule = useMutation(api.weeklySchedules.update);
  
  // Handle invalid classId or class not found
  useEffect(() => {
    if (!classId || !isValidClassId) {
      toast.error("Невалиден идентификатор на клас");
      navigate("/bg");
      return;
    }
    // If query returned undefined after loading (class not found)
    if (classData === null) {
      toast.error("Класът не е намерен");
      navigate("/bg");
    }
  }, [classId, isValidClassId, classData, navigate]);
  
  // Load existing schedule data when in edit mode (only once)
  useEffect(() => {
    if (isEditMode && existingSchedule && existingSchedule.entries && !hasLoadedEditData) {
      setHasLoadedEditData(true);
      
      // Save raw entries from DB for week-specific filtering
      setAllEntriesFromDb(existingSchedule.entries as RawEntry[]);
      
      // Initialize all day schedules from existing data
      // Initially load ALL entries - will be re-filtered when moving from step 2 to 3
      const newMonday = Array(7).fill(null).map(() => [] as LessonSlot[]);
      const newTuesday = Array(7).fill(null).map(() => [] as LessonSlot[]);
      const newWednesday = Array(7).fill(null).map(() => [] as LessonSlot[]);
      const newThursday = Array(7).fill(null).map(() => [] as LessonSlot[]);
      const newFriday = Array(7).fill(null).map(() => [] as LessonSlot[]);
      
      // Populate from existing entries
      existingSchedule.entries.forEach((entry) => {
        // Normalize preparationType to match classSubjectsTeachers format
        // Default to "ЗП" if undefined to ensure matching works
        const normalizedPrepType = entry.preparationType || "ЗП";
        
        const slot: LessonSlot = {
          subjectId: entry.subjectId,
          teacherId: entry.teacherId,
          preparationType: normalizedPrepType,
          groupId: entry.groupId,
          id: crypto.randomUUID(),
        };
        
        const periodIdx = entry.periodIndex - 1; // Convert 1-based to 0-based
        
        switch (entry.dayOfWeek) {
          case 1:
            if (!newMonday[periodIdx]) newMonday[periodIdx] = [];
            newMonday[periodIdx].push(slot);
            break;
          case 2:
            if (!newTuesday[periodIdx]) newTuesday[periodIdx] = [];
            newTuesday[periodIdx].push(slot);
            break;
          case 3:
            if (!newWednesday[periodIdx]) newWednesday[periodIdx] = [];
            newWednesday[periodIdx].push(slot);
            break;
          case 4:
            if (!newThursday[periodIdx]) newThursday[periodIdx] = [];
            newThursday[periodIdx].push(slot);
            break;
          case 5:
            if (!newFriday[periodIdx]) newFriday[periodIdx] = [];
            newFriday[periodIdx].push(slot);
            break;
        }
      });
      
      // Ensure each period has at least one empty slot
      for (let i = 0; i < 7; i++) {
        if (newMonday[i].length === 0) newMonday[i] = [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }];
        if (newTuesday[i].length === 0) newTuesday[i] = [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }];
        if (newWednesday[i].length === 0) newWednesday[i] = [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }];
        if (newThursday[i].length === 0) newThursday[i] = [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }];
        if (newFriday[i].length === 0) newFriday[i] = [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }];
      }
      
      setMondaySchedule(newMonday);
      setTuesdaySchedule(newTuesday);
      setWednesdaySchedule(newWednesday);
      setThursdaySchedule(newThursday);
      setFridaySchedule(newFriday);
      
      // Load existing dayRegimeId if available
      if (existingSchedule.dayRegimeId) {
        setSelectedRegimeId(existingSchedule.dayRegimeId);
      }
      
      // Load existing dates if available
      if (existingSchedule.term1StartDate) {
        setTerm1StartDate(existingSchedule.term1StartDate);
      } else if (existingSchedule.startDate) {
        // Fallback to legacy startDate for term 1
        setTerm1StartDate(existingSchedule.startDate);
      }
      if (existingSchedule.term1EndDate) {
        setTerm1EndDate(existingSchedule.term1EndDate);
      } else if (existingSchedule.endDate) {
        // Fallback to legacy endDate for term 1
        setTerm1EndDate(existingSchedule.endDate);
      }
      if (existingSchedule.term2StartDate) {
        setTerm2StartDate(existingSchedule.term2StartDate);
      }
      if (existingSchedule.term2EndDate) {
        setTerm2EndDate(existingSchedule.term2EndDate);
      }
    }
  }, [isEditMode, existingSchedule, hasLoadedEditData]);
  
  // Helper to ensure schedule has correct number of periods
  const ensureScheduleSize = (schedule: LessonSlot[][], targetSize: number): LessonSlot[][] => {
    const newSchedule = [...schedule];
    // Add missing periods
    while (newSchedule.length < targetSize) {
      newSchedule.push([{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }]);
    }
    // Trim excess periods (optional, keeps schedule clean)
    if (newSchedule.length > targetSize) {
      newSchedule.length = targetSize;
    }
    return newSchedule;
  };

  // Update regimeData when selectedRegimeDetails loads (includes periods)
  useEffect(() => {
    let newPeriodCount = 7; // Default
    
    if (selectedRegimeDetails?.periods && selectedRegimeDetails.periods.length > 0) {
      // Use the detailed periods from the regime
      const newRegimeData: RegimeRow[] = selectedRegimeDetails.periods.map(p => ({
        period: p.periodNumber,
        time: p.startTime,
        duration: p.duration,
      }));
      setRegimeData(newRegimeData);
      newPeriodCount = newRegimeData.length;
    } else if (selectedRegimeDetails) {
      // Fallback: generate based on periodCount, startTime and endTime
      const newRegimeData: RegimeRow[] = [];
      const periodCount = selectedRegimeDetails.periodCount;
      
      const [startHour, startMin] = selectedRegimeDetails.startTime.split(":").map(Number);
      let currentMinutes = startHour * 60 + startMin;
      
      const defaultDuration = 40;
      const breakDuration = 10;
      
      for (let i = 0; i < periodCount; i++) {
        const hours = Math.floor(currentMinutes / 60);
        const mins = currentMinutes % 60;
        const timeStr = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
        
        newRegimeData.push({
          period: i + 1,
          time: timeStr,
          duration: defaultDuration,
        });
        
        currentMinutes += defaultDuration + breakDuration;
      }
      
      setRegimeData(newRegimeData);
      newPeriodCount = periodCount;
    }
    
    // Ensure all day schedules have the correct number of periods
    if (newPeriodCount > 0) {
      setMondaySchedule(prev => ensureScheduleSize(prev, newPeriodCount));
      setTuesdaySchedule(prev => ensureScheduleSize(prev, newPeriodCount));
      setWednesdaySchedule(prev => ensureScheduleSize(prev, newPeriodCount));
      setThursdaySchedule(prev => ensureScheduleSize(prev, newPeriodCount));
      setFridaySchedule(prev => ensureScheduleSize(prev, newPeriodCount));
    }
  }, [selectedRegimeDetails]);
  
  const weeks = useMemo(() => {
    return getWeeksInPeriod(startDate, endDate);
  }, [startDate, endDate]);

  // Auto-select all weeks initially (only in create mode)
  useMemo(() => {
    if (!isEditMode && weeks.length > 0 && selectedWeeks.size === 0) {
      setSelectedWeeks(new Set(weeks.map(w => w.weekNumber)));
    }
  }, [weeks]);

  // Pre-select weeks that have entries in edit mode
  useEffect(() => {
    if (isEditMode && hasLoadedEditData && weeks.length > 0 && !editWeeksLoaded) {
      setEditWeeksLoaded(true);
      
      // Detect which weeks have entries
      const weeksWithEntries = new Set<number>();
      allEntriesFromDb.forEach(entry => {
        if (entry.weekNumbers && entry.weekNumbers.length > 0) {
          entry.weekNumbers.forEach(w => weeksWithEntries.add(w));
        }
      });
      
      if (weeksWithEntries.size > 0) {
        // Select only weeks that have entries
        // Filter to only include week numbers that are within the current period
        const availableWeekNumbers = new Set(weeks.map(w => w.weekNumber));
        const validWeeks = new Set<number>();
        weeksWithEntries.forEach(w => {
          if (availableWeekNumbers.has(w)) validWeeks.add(w);
        });
        setSelectedWeeks(validWeeks.size > 0 ? validWeeks : new Set(weeks.map(w => w.weekNumber)));
      } else {
        // Legacy entries (no weekNumbers): select all weeks
        setSelectedWeeks(new Set(weeks.map(w => w.weekNumber)));
      }
    }
  }, [isEditMode, hasLoadedEditData, weeks, editWeeksLoaded, allEntriesFromDb]);

  // Helper functions for daily schedules
  const getCurrentDaySchedule = () => {
    switch (currentStep) {
      case 4: return mondaySchedule;
      case 5: return tuesdaySchedule;
      case 6: return wednesdaySchedule;
      case 7: return thursdaySchedule;
      case 8: return fridaySchedule;
      default: return mondaySchedule;
    }
  };

  const setCurrentDaySchedule = (schedule: LessonSlot[][]) => {
    switch (currentStep) {
      case 4: setMondaySchedule(schedule); break;
      case 5: setTuesdaySchedule(schedule); break;
      case 6: setWednesdaySchedule(schedule); break;
      case 7: setThursdaySchedule(schedule); break;
      case 8: setFridaySchedule(schedule); break;
    }
  };

  const addSubjectSlot = (periodIndex: number) => {
    const currentSchedule = getCurrentDaySchedule();
    const newSchedule = [...currentSchedule];
    newSchedule[periodIndex] = [
      ...newSchedule[periodIndex],
      { subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }
    ];
    setCurrentDaySchedule(newSchedule);
  };

  const removeSubjectSlot = (periodIndex: number, slotIndex: number) => {
    const currentSchedule = getCurrentDaySchedule();
    const newSchedule = [...currentSchedule];
    if (newSchedule[periodIndex].length > 1) {
      newSchedule[periodIndex] = newSchedule[periodIndex].filter((_, i) => i !== slotIndex);
      setCurrentDaySchedule(newSchedule);
    }
  };

  const updateSubjectSlot = (periodIndex: number, slotIndex: number, subjectId: Id<"subjects"> | null, teacherId: Id<"teachers"> | null, preparationType?: string, groupId?: Id<"classGroups">) => {
    const currentSchedule = getCurrentDaySchedule();
    const newSchedule = [...currentSchedule];
    newSchedule[periodIndex][slotIndex].subjectId = subjectId;
    newSchedule[periodIndex][slotIndex].teacherId = teacherId;
    newSchedule[periodIndex][slotIndex].preparationType = preparationType;
    newSchedule[periodIndex][slotIndex].groupId = groupId;
    setCurrentDaySchedule(newSchedule);
  };

  const toggleWeek = (weekNumber: number) => {
    const newSelected = new Set(selectedWeeks);
    if (newSelected.has(weekNumber)) {
      newSelected.delete(weekNumber);
    } else {
      newSelected.add(weekNumber);
    }
    setSelectedWeeks(newSelected);
  };

  const selectAll = () => {
    setSelectedWeeks(new Set(weeks.map(w => w.weekNumber)));
  };

  const selectEven = () => {
    setSelectedWeeks(new Set(weeks.filter(w => w.weekNumber % 2 === 0).map(w => w.weekNumber)));
  };

  const selectOdd = () => {
    setSelectedWeeks(new Set(weeks.filter(w => w.weekNumber % 2 !== 0).map(w => w.weekNumber)));
  };

  const clearAll = () => {
    setSelectedWeeks(new Set());
  };

  const handleTermChange = (newTerm: 1 | 2) => {
    setTerm(newTerm);
    // Just switch term - dates are stored separately for each term
    setSelectedWeeks(new Set());
  };

  // Helper to populate day schedules from a filtered set of entries
  const populateDaySchedulesFromEntries = (entries: RawEntry[]) => {
    const periodCount = regimeData.length || 7;
    const newMonday = Array(periodCount).fill(null).map(() => [] as LessonSlot[]);
    const newTuesday = Array(periodCount).fill(null).map(() => [] as LessonSlot[]);
    const newWednesday = Array(periodCount).fill(null).map(() => [] as LessonSlot[]);
    const newThursday = Array(periodCount).fill(null).map(() => [] as LessonSlot[]);
    const newFriday = Array(periodCount).fill(null).map(() => [] as LessonSlot[]);

    entries.forEach((entry) => {
      const normalizedPrepType = entry.preparationType || "ЗП";
      const slot: LessonSlot = {
        subjectId: entry.subjectId,
        teacherId: entry.teacherId,
        preparationType: normalizedPrepType,
        groupId: entry.groupId,
        id: crypto.randomUUID(),
      };
      const periodIdx = entry.periodIndex - 1;
      if (periodIdx < 0 || periodIdx >= periodCount) return;

      switch (entry.dayOfWeek) {
        case 1: newMonday[periodIdx].push(slot); break;
        case 2: newTuesday[periodIdx].push(slot); break;
        case 3: newWednesday[periodIdx].push(slot); break;
        case 4: newThursday[periodIdx].push(slot); break;
        case 5: newFriday[periodIdx].push(slot); break;
      }
    });

    // Ensure each period has at least one empty slot
    for (let i = 0; i < periodCount; i++) {
      if (newMonday[i].length === 0) newMonday[i] = [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }];
      if (newTuesday[i].length === 0) newTuesday[i] = [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }];
      if (newWednesday[i].length === 0) newWednesday[i] = [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }];
      if (newThursday[i].length === 0) newThursday[i] = [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }];
      if (newFriday[i].length === 0) newFriday[i] = [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }];
    }

    setMondaySchedule(newMonday);
    setTuesdaySchedule(newTuesday);
    setWednesdaySchedule(newWednesday);
    setThursdaySchedule(newThursday);
    setFridaySchedule(newFriday);
  };

  // Handle day regime selection - populate regimeData with the selected regime's periods
  const handleRegimeChange = (regimeId: string) => {
    if (regimeId === "none") {
      setSelectedRegimeId(null);
      setRegimeData([
        { period: 1, time: "", duration: 40 },
        { period: 2, time: "", duration: 40 },
        { period: 3, time: "", duration: 40 },
        { period: 4, time: "", duration: 40 },
        { period: 5, time: "", duration: 40 },
        { period: 6, time: "", duration: 40 },
        { period: 7, time: "", duration: 40 },
      ]);
      return;
    }
    
    // Just set the selected regime ID - the effect will load the detailed data
    setSelectedRegimeId(regimeId as Id<"dayRegimes">);
  };

  const handleSaveAndContinue = async () => {
    // If we're on the last step (Friday), save the schedule
    if (currentStep === 8) {
      await handleSaveSchedule();
    } else if (currentStep === 2) {
      // Validate at least one week is selected
      if (selectedWeeks.size === 0) {
        toast.error("Моля, изберете поне една седмица");
        return;
      }
      // In edit mode, re-populate day schedules from entries filtered by selected weeks
      if (isEditMode && allEntriesFromDb.length > 0) {
        const filteredEntries = allEntriesFromDb.filter(entry => {
          if (!entry.weekNumbers || entry.weekNumbers.length === 0) {
            return true; // Legacy entries apply to all weeks
          }
          return entry.weekNumbers.some(w => selectedWeeks.has(w));
        });
        populateDaySchedulesFromEntries(filteredEntries);
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Validate that a regime is selected before proceeding to step 4
      if (!selectedRegimeId) {
        toast.error("Моля, изберете дневен режим преди да продължите");
        return;
      }
      setCurrentStep(4);
    } else if (currentStep < 8) {
      setCurrentStep((currentStep + 1) as Step);
    }
  };

  const handleSaveSchedule = async () => {
    try {
      // Validate we have all required data
      if (!classId || !classData || !schoolData?.schoolId) {
        toast.error("Липсват необходими данни");
        return;
      }

      // Collect all entries from all days
      const allSchedules = [
        { day: 1, schedule: mondaySchedule },
        { day: 2, schedule: tuesdaySchedule },
        { day: 3, schedule: wednesdaySchedule },
        { day: 4, schedule: thursdaySchedule },
        { day: 5, schedule: fridaySchedule },
      ];

      const entries: Array<{
        dayOfWeek: number;
        periodIndex: number;
        subjectId: Id<"subjects">;
        teacherId: Id<"teachers">;
        preparationType?: string;
        groupId?: Id<"classGroups">;
      }> = [];

      // Build entries array - only include slots with subjects and teachers
      for (const { day, schedule } of allSchedules) {
        schedule.forEach((slots, periodIndex) => {
          slots.forEach((slot) => {
            if (slot.subjectId && slot.teacherId) {
              entries.push({
                dayOfWeek: day,
                periodIndex: periodIndex + 1, // Convert from 0-based to 1-based (schema expects 1-7+)
                subjectId: slot.subjectId,
                teacherId: slot.teacherId,
                preparationType: slot.preparationType,
                groupId: slot.groupId,
              });
            }
          });
        });
      }

      if (entries.length === 0) {
        toast.error("Моля, добавете поне един час в разписанието");
        return;
      }

      // Compute week arrays for week-specific saving
      const selectedWeeksArray = Array.from(selectedWeeks).sort((a, b) => a - b);
      // totalWeekNumbers should cover BOTH terms (full school year)
      // so entries are tagged with all school year weeks, not just the current term
      const fullYearWeeks = getWeeksInPeriod(term1StartDate, term2EndDate);
      const totalWeekNumbers = fullYearWeeks.map(w => w.weekNumber);

      if (isEditMode && scheduleId) {
        // Update existing schedule
        await updateSchedule({
          id: scheduleId as Id<"weeklySchedules">,
          weekCount: selectedWeeks.size,
          entries,
          selectedWeeks: selectedWeeksArray,
          totalWeekNumbers,
          dayRegimeId: selectedRegimeId ?? undefined,
          startDate,
          endDate,
          term1StartDate,
          term1EndDate,
          term2StartDate,
          term2EndDate,
        });
        toast.success("Разписанието е актуализирано успешно!");
      } else {
        // Create new schedule
        // Use current academic year
        const currentYear = new Date().getFullYear();
        const academicYear = `${currentYear}/${currentYear + 1}`;
        
        await createSchedule({
          classId: classId as Id<"classes">,
          weekCount: selectedWeeks.size,
          academicYear,
          schoolId: schoolData.schoolId,
          entries,
          selectedWeeks: selectedWeeksArray,
          totalWeekNumbers,
          dayRegimeId: selectedRegimeId ?? undefined,
          startDate,
          endDate,
          term1StartDate,
          term1EndDate,
          term2StartDate,
          term2EndDate,
        });
        toast.success("Разписанието е запазено успешно!");
      }

      navigate(`/bg/diary/class/${classId}/schedule`);
    } catch (error) {
      console.error("Error saving schedule:", error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Грешка при запазване на разписанието");
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    } else if (isValidClassId) {
      navigate(`/bg/diary/class/${classId}/schedule`);
    } else {
      navigate(`/bg`);
    }
  };

  if (!classData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const steps = [
    { num: 1, label: "КЛАС", shortLabel: "1" },
    { num: 2, label: "ПЕРИОД", shortLabel: "2" },
    { num: 3, label: "РЕЖИМ", shortLabel: "3" },
    { num: 4, label: "ПОН", shortLabel: "4" },
    { num: 5, label: "ВТО", shortLabel: "5" },
    { num: 6, label: "СРЯ", shortLabel: "6" },
    { num: 7, label: "ЧЕТ", shortLabel: "7" },
    { num: 8, label: "ПЕТ", shortLabel: "8" },
  ];

  return (
    <div className="flex h-screen flex-col bg-background">
        {/* Header */}
        <div className="border-b bg-background">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">
              {isEditMode ? "Редактиране на седмично разписание в" : "Добавяне на седмично разписание в"} {classData.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleBack}>
              Назад
            </Button>
            <Button 
              size="sm" 
              onClick={handleSaveAndContinue}
              className="bg-primary text-primary-foreground"
            >
              {currentStep === 8 
                ? (isEditMode ? "Запази промените" : "Запази разписанието") 
                : "Запази и премини"}
            </Button>
          </div>
        </div>

        {/* Steps Bar */}
        <div className="flex items-center gap-0 px-6 py-2 border-t overflow-x-auto">
          {steps.map((step, index) => (
            <div
              key={step.num}
              className={cn(
                "flex items-center justify-center min-w-[120px] py-3 text-sm font-medium transition-colors",
                currentStep === step.num
                  ? "bg-primary text-primary-foreground"
                  : currentStep > step.num
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                  currentStep === step.num
                    ? "bg-primary-foreground text-primary"
                    : "bg-transparent"
                )}>
                  {step.num}
                </div>
                <span>{step.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {currentStep === 1 && (
          <div className="max-w-3xl mx-auto">
            <Alert className="mb-6 border-amber-200 bg-amber-50">
              <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Внимание! При въвеждането на разписание. Ако въведете неколектно разписание, вашите колеги няма да могат да отбелязват училищни отсъствия.
              </AlertDescription>
            </Alert>

            <Card className="p-6">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Избран клас</h2>
                <div className="text-2xl font-bold text-primary">
                  {classData.name}
                </div>
              </div>
            </Card>
          </div>
        )}

        {currentStep === 2 && (
          <div className="max-w-5xl mx-auto">
            <Alert className="mb-6 border-amber-200 bg-amber-50">
              <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Внимание! При въвеждането на разписание. Ако въведете неколектно разписание, вашите колеги няма да могат да отбелязват училищни отсъствия.
              </AlertDescription>
            </Alert>

            <Card className="p-6 mb-6">
              <div className="space-y-6">
                <h2 className="text-lg font-semibold">Изберете периода, за който желаете да въведете седмично разписание</h2>
                
                <div className="flex items-center gap-4">
                  <Label>Срок:</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={term === 1 ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleTermChange(1)}
                    >
                      1
                    </Button>
                    <Button
                      variant={term === 2 ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleTermChange(2)}
                    >
                      2
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>От дата:</Label>
                    <Input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setSelectedWeeks(new Set());
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>До дата:</Label>
                    <Input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setSelectedWeeks(new Set());
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">Седмици</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Изчисти
                </Button>
                <Button variant="outline" size="sm" onClick={selectEven}>
                  Четни
                </Button>
                <Button variant="outline" size="sm" onClick={selectOdd}>
                  Нечетни
                </Button>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Всички
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-6">
              {weeks.map((week) => (
                <button
                  key={week.weekNumber}
                  onClick={() => toggleWeek(week.weekNumber)}
                  className={cn(
                    "p-3 rounded text-xs font-medium transition-colors",
                    selectedWeeks.has(week.weekNumber)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  <div className="font-bold mb-1">
                    {formatDateBG(week.startDate)}-{formatDateBG(week.endDate)}
                  </div>
                  <div className="text-[10px]">
                    Сед ({week.weekNumber})
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="max-w-5xl mx-auto">
            <Card className="p-6 mb-6">
              <div className="space-y-6">
                <h2 className="text-lg font-semibold">Изберете дневен режим</h2>
                <p className="text-sm text-muted-foreground">
                  Изберете режим от добавените в секция "Дневни режими". Часовете и продължителността ще се заредят автоматично.
                </p>
                
                {/* Day regimes dropdown */}
                <div className="space-y-2">
                  <Label>
                    Дневен режим <span className="text-destructive">*</span>
                  </Label>
                  {dayRegimes === undefined ? (
                    <Skeleton className="h-10 w-full" />
                  ) : dayRegimes.length === 0 ? (
                    <Empty className="py-8">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <ClockIcon />
                        </EmptyMedia>
                        <EmptyTitle>Няма добавени дневни режими</EmptyTitle>
                        <EmptyDescription>
                          Моля, първо добавете дневни режими в секция "Дневни режими" от менюто.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => navigate("/bg/admin/day-regimes")}
                        >
                          Към Дневни режими
                        </Button>
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <Select 
                      value={selectedRegimeId || "none"} 
                      onValueChange={handleRegimeChange}
                    >
                      <SelectTrigger className={!selectedRegimeId ? "border-amber-500" : ""}>
                        <SelectValue placeholder="Изберете режим" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Изберете режим --</SelectItem>
                        {dayRegimes.map((regime) => (
                          <SelectItem key={regime._id} value={regime._id}>
                            {regime.name} ({regime.startTime} - {regime.endTime}, {regime.periodCount} часа)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!selectedRegimeId && dayRegimes && dayRegimes.length > 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Изборът на дневен режим е задължителен за продължаване
                    </p>
                  )}
                </div>
                
                {/* Show selected regime info */}
                {selectedRegimeId && selectedRegimeDetails && (
                  <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                    <InfoIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-blue-800 dark:text-blue-300">
                      <strong>Избран режим:</strong> {selectedRegimeDetails.name}
                      <div className="mt-1 text-sm">
                        Начало: {selectedRegimeDetails.startTime} | Край: {selectedRegimeDetails.endTime} | Брой часове: {selectedRegimeDetails.periodCount}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </Card>

            {/* Show schedule preview only when a regime is selected */}
            {selectedRegimeId && regimeData.length > 0 && (
              <div className="overflow-x-auto">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Преглед на часовете</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border border-border p-2 text-xs font-semibold text-center w-12">#</th>
                      <th className="border border-border p-2 text-xs font-semibold text-center">Начало</th>
                      <th className="border border-border p-2 text-xs font-semibold text-center">Продължителност</th>
                      <th className="border border-border p-2 text-xs font-semibold text-center">Край</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regimeData.map((row) => {
                      // Calculate end time
                      const [startH, startM] = row.time.split(":").map(Number);
                      const startMinutes = (startH || 0) * 60 + (startM || 0);
                      const endMinutes = startMinutes + row.duration;
                      const endH = Math.floor(endMinutes / 60);
                      const endM = endMinutes % 60;
                      const endTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
                      
                      return (
                        <tr key={row.period}>
                          <td className="border border-border p-2 text-center text-sm font-semibold bg-muted/50">
                            {row.period}
                          </td>
                          <td className="border border-border p-3 text-center text-sm">
                            {row.time || "—"}
                          </td>
                          <td className="border border-border p-3 text-center text-sm">
                            {row.duration} мин
                          </td>
                          <td className="border border-border p-3 text-center text-sm">
                            {row.time ? endTime : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {currentStep > 3 && (
          <div className="max-w-5xl mx-auto">
            <Card className="p-6">
              <div className="space-y-4">
                <h2 className="text-lg font-semibold mb-6">
                  Въведете разписание за {steps[currentStep - 1].label}
                </h2>

                {/* Show message if no subjects-teachers configured */}
                {classSubjectsTeachers && classSubjectsTeachers.length === 0 && (
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      Няма конфигурирани предмети и учители за тази паралелка. Моля, първо добавете предмети и учители в секция "Предмети и учители" при редактиране на паралелката.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  {regimeData.map((row, periodIndex) => {
                    const daySchedule = getCurrentDaySchedule();
                    // Safety check: ensure slots exist for this period
                    const slots = daySchedule[periodIndex] ?? [{ subjectId: null, teacherId: null, preparationType: undefined, id: crypto.randomUUID() }];
                    
                    // Helper function to create unique key for subject-teacher-prepType combination
                    const createSubjectTeacherKey = (subjectId: Id<"subjects">, teacherId: Id<"teachers">, prepType?: string, groupId?: Id<"classGroups">) => 
                      groupId
                        ? `${subjectId}|${teacherId}|${prepType || ""}|group:${groupId}`
                        : `${subjectId}|${teacherId}|${prepType || ""}`;
                    
                    // Build combined options: regular + group-based
                    const combinedOptions: Array<{
                      key: string;
                      label: string;
                      subjectId: Id<"subjects">;
                      teacherId: Id<"teachers">;
                      preparationType?: string;
                      groupId?: Id<"classGroups">;
                      isGroup: boolean;
                    }> = [];
                    
                    // 1) Regular subject-teacher entries
                    classSubjectsTeachers?.forEach((st) => {
                      const prepTypeSuffix = st.preparationType && st.preparationType !== "ЗП" && st.preparationType !== "ООП"
                        ? ` (${st.preparationType})` : "";
                      combinedOptions.push({
                        key: createSubjectTeacherKey(st.subjectId, st.teacherId, st.preparationType),
                        label: `${st.subjectName}${prepTypeSuffix} – ${st.teacherName}`,
                        subjectId: st.subjectId,
                        teacherId: st.teacherId,
                        preparationType: st.preparationType,
                        isGroup: false,
                      });
                    });
                    
                    // 2) Group entries: use actual group data with stored teacher
                    classGroups?.forEach((group) => {
                      const prepType = group.preparationType || "ЗП";
                      const prepTypeSuffix = prepType !== "ЗП" && prepType !== "ООП"
                        ? ` (${prepType})` : "";

                      if (group.teacherId) {
                        // Group has a specific teacher assigned - find their name
                        const matchingTeacher = classSubjectsTeachers?.find(
                          st => st.teacherId === group.teacherId
                        );
                        const teacherName = matchingTeacher?.teacherName || group.teacherName || "—";
                        const teacherId = group.teacherId;
                        combinedOptions.push({
                          key: createSubjectTeacherKey(group.subjectId, teacherId as Id<"teachers">, prepType, group._id),
                          label: `${group.subjectName}${prepTypeSuffix} – ${teacherName} [${group.name}]`,
                          subjectId: group.subjectId,
                          teacherId: teacherId as Id<"teachers">,
                          preparationType: prepType,
                          groupId: group._id,
                          isGroup: true,
                        });
                      } else {
                        // Legacy: group without teacherId - use first matching teacher only (not all)
                        const firstMatch = classSubjectsTeachers?.find(
                          st => st.subjectId === group.subjectId &&
                            (st.preparationType || "ЗП") === prepType
                        );
                        
                        if (firstMatch) {
                          combinedOptions.push({
                            key: createSubjectTeacherKey(firstMatch.subjectId, firstMatch.teacherId, firstMatch.preparationType, group._id),
                            label: `${firstMatch.subjectName}${prepTypeSuffix} – ${firstMatch.teacherName} [${group.name}]`,
                            subjectId: firstMatch.subjectId,
                            teacherId: firstMatch.teacherId,
                            preparationType: firstMatch.preparationType,
                            groupId: group._id,
                            isGroup: true,
                          });
                        }
                      }
                    });
                    
                    // Get current slot value (including group)
                    const getSlotValue = (slot: LessonSlot): string => {
                      if (slot.subjectId && slot.teacherId) {
                        return createSubjectTeacherKey(slot.subjectId, slot.teacherId, slot.preparationType, slot.groupId);
                      }
                      return "none";
                    };
                    
                    // Get display name for current selection
                    const getSelectedDisplayName = (slot: LessonSlot): string | undefined => {
                      if (!slot.subjectId || !slot.teacherId) return undefined;
                      const val = getSlotValue(slot);
                      const opt = combinedOptions.find(o => o.key === val);
                      if (opt) return opt.label;
                      // Fallback: match without group
                      const match = classSubjectsTeachers?.find(
                        st => st.subjectId === slot.subjectId && st.teacherId === slot.teacherId && st.preparationType === slot.preparationType
                      );
                      if (match) {
                        const prepTypeSuffix = match.preparationType && match.preparationType !== "ЗП" && match.preparationType !== "ООП"
                          ? ` (${match.preparationType})` : "";
                        const groupName = slot.groupId ? classGroups?.find(g => g._id === slot.groupId)?.name : undefined;
                        return `${match.subjectName}${prepTypeSuffix} – ${match.teacherName}${groupName ? ` [${groupName}]` : ""}`;
                      }
                      return undefined;
                    };
                    
                    return (
                      <Card key={row.period} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                              {row.period}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {(() => {
                                // Calculate end time from start time + duration
                                if (!row.time) return `${row.duration} мин`;
                                const [startH, startM] = row.time.split(":").map(Number);
                                const startMinutes = (startH || 0) * 60 + (startM || 0);
                                const endMinutes = startMinutes + row.duration;
                                const endH = Math.floor(endMinutes / 60);
                                const endM = endMinutes % 60;
                                const endTime = `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
                                return `🕛 ${row.time} - ${endTime}`;
                              })()}
                            </div>
                          </div>

                          {slots.map((slot, slotIndex) => (
                              <div key={slot.id} className="space-y-2">
                                <div className="flex items-center gap-2">
                                <Select
                                  value={getSlotValue(slot)}
                                  onValueChange={(val) => {
                                    if (val === "none") {
                                      updateSubjectSlot(periodIndex, slotIndex, null, null, undefined, undefined);
                                    } else {
                                      const opt = combinedOptions.find(o => o.key === val);
                                      if (opt) {
                                        updateSubjectSlot(periodIndex, slotIndex, opt.subjectId, opt.teacherId, opt.preparationType, opt.groupId);
                                      }
                                    }
                                  }}
                                >
                                  <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Изберете предмет и учител">
                                      {getSelectedDisplayName(slot) || "Изберете предмет и учител"}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Изберете</SelectItem>
                                    {/* Regular subject-teacher entries */}
                                    {combinedOptions.filter(o => !o.isGroup).map((opt) => (
                                      <SelectItem key={opt.key} value={opt.key}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                    {/* Group entries with visual separator */}
                                    {combinedOptions.some(o => o.isGroup) && (
                                      <SelectItem value="__group_separator__" disabled>
                                        ── Групи ──
                                      </SelectItem>
                                    )}
                                    {combinedOptions.filter(o => o.isGroup).map((opt) => (
                                      <SelectItem key={opt.key} value={opt.key}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {slots.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeSubjectSlot(periodIndex, slotIndex)}
                                    className="text-destructive hover:text-destructive/80"
                                  >
                                    <XIcon className="h-4 w-4" />
                                  </Button>
                                )}
                                </div>
                              </div>
                            ))}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addSubjectSlot(periodIndex)}
                            className="w-full"
                          >
                            <PlusIcon className="h-4 w-4 mr-2" />
                            Добави група
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AddWeeklySchedule() {
  return (
    <Layout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="text-muted-foreground">Моля, влезте в профила си</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen">
          <Skeleton className="h-96 w-full max-w-md" />
        </div>
      </AuthLoading>
      <Authenticated>
        <DiaryAccessGuard>
          <AddWeeklyScheduleInner />
        </DiaryAccessGuard>
      </Authenticated>
    </Layout>
  );
}
