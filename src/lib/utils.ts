import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a user name as "Име П. Фамилия" (First M. Last)
 * @param firstName - First name
 * @param middleName - Middle name (optional, will use first letter + ".")
 * @param lastName - Last name
 * @returns Formatted name string
 */
export function formatUserName(
  firstName?: string | null,
  middleName?: string | null,
  lastName?: string | null
): string {
  if (!firstName && !lastName) return "-";
  
  const middleInitial = middleName ? ` ${middleName.charAt(0)}.` : "";
  return `${firstName || ""}${middleInitial} ${lastName || ""}`.trim();
}

/**
 * Parses a full name string into first, middle, and last name parts
 * and returns formatted name as "Име П. Фамилия"
 * @param fullName - Full name string (e.g., "Иван Петров Георгиев")
 * @returns Formatted name string
 */
export function formatFullName(fullName?: string | null): string {
  if (!fullName) return "-";
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "-";
  
  const firstName = parts[0];
  const lastName = parts.length > 1 ? parts[parts.length - 1] : undefined;
  const middleName = parts.length > 2 ? parts[1] : undefined;
  
  return formatUserName(firstName, middleName, lastName);
}
