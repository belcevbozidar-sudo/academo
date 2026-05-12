// Form validation utilities

/**
 * Utility function to scroll to an invalid field
 */
export function scrollToInvalidField(element: HTMLElement): void {
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * Utility function to highlight an invalid field with red border and animation
 */
export function highlightInvalidField(element: HTMLElement): void {
  // Add red border and animation
  element.classList.add("border-destructive", "animate-pulse-scale");
  
  // Remove after animation
  setTimeout(() => {
    element.classList.remove("border-destructive", "animate-pulse-scale");
  }, 600);
}

export function scrollToField(fieldId: string) {
  const element = document.getElementById(fieldId);
  if (element) {
    scrollToInvalidField(element);
    highlightInvalidField(element);
  }
}

export function validateRequiredField(value: string | undefined | null, fieldId: string, fieldName: string): boolean {
  if (!value || value.trim() === "") {
    scrollToField(fieldId);
    return false;
  }
  return true;
}

export function validateRequiredFields(fields: { value: string | undefined | null; fieldId: string; fieldName: string }[]): boolean {
  for (const field of fields) {
    if (!validateRequiredField(field.value, field.fieldId, field.fieldName)) {
      return false;
    }
  }
  return true;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const errorString = error.message;
      
      // First, check if the error string contains specific Bulgarian error messages
      // This is the most reliable method
      const bulgarianErrors = [
        "Невалиден телефонен номер",
        "Невалиден имейл адрес",
        "Невалидно име",
      ];
      
      for (const bgError of bulgarianErrors) {
        if (errorString.includes(bgError)) {
          return bgError;
        }
      }
      
      // Method 1: Try to extract from various ConvexError patterns
      // Pattern: "Uncaught ConvexError: {...}"
      const convexPatterns = [
        /ConvexError:\s*(\{[^}]+\})/g,
        /\{[^{}]*"code"\s*:\s*"[^"]*"\s*,\s*"message"\s*:\s*"([^"]+)"\s*\}/g,
      ];
      
      for (const pattern of convexPatterns) {
        const matches = Array.from(errorString.matchAll(pattern));
        for (const match of matches) {
          try {
            // Try to parse as JSON if it looks like a JSON object
            if (match[1] && match[1].startsWith('{')) {
              const parsed = JSON.parse(match[1]);
              if (parsed.message) {
                return parsed.message;
              }
            } else if (match[1]) {
              // Direct message extraction from regex group
              return match[1];
            }
          } catch {
            continue;
          }
        }
      }
      
      // Method 2: Look for quoted message values in the error string
      const quotedMessageMatch = errorString.match(/"message"\s*:\s*"([^"]+)"/);
      if (quotedMessageMatch && quotedMessageMatch[1]) {
        return quotedMessageMatch[1];
      }
      
      // Method 3: Extract validation errors
      if (errorString.includes("Validation error")) {
        const match = errorString.match(/Validation error: (.+)/);
        if (match) {
          return match[1];
        }
      }
      
      // Method 4: If it's a generic server error but mentions phone validation
      // This handles the case where the backend threw a phone validation error
      if ((errorString.includes("Server Error") || errorString.includes("Request ID")) &&
          (errorString.toLowerCase().includes("phone") || 
           errorString.toLowerCase().includes("телефон") ||
           errorString.includes("validatePhone"))) {
        return "Невалиден телефонен номер. Моля въведете валиден номер (напр. +359XXXXXXXXX).";
      }
      
      // Method 5: Fallback based on keywords for other fields
      if (errorString.toLowerCase().includes("phone") || errorString.includes("телефон")) {
        return "Невалиден телефонен номер. Моля въведете валиден номер (напр. +359XXXXXXXXX).";
      }
      
      if (errorString.toLowerCase().includes("email") || errorString.includes("имейл")) {
        return "Невалиден имейл адрес.";
      }
      
      if (errorString.toLowerCase().includes("name") || errorString.includes("име")) {
        return "Невалидно име.";
      }
      
      // Method 6: Generic server error message only as last resort
      if (errorString.includes("Server Error") || errorString.includes("Request ID")) {
        return "Възникна грешка при обработката на данните. Моля, проверете въведените стойности и опитайте отново.";
      }
      
      // Return original message if nothing else matched
      return errorString;
    } catch {
      return error.message;
    }
  }
  
  return "Възникна грешка. Моля опитайте отново.";
}
