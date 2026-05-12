import { ConvexError } from "convex/values";

// ✅ FIX 2: FILE UPLOAD ВАЛИДАЦИЯ
// Валидира качени файлове за размер и тип

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_MIME_TYPES = {
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ],
  avatar: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  attachment: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ],
};

export function validateFile(
  fileName: string,
  fileSize: number,
  mimeType: string,
  category: keyof typeof ALLOWED_MIME_TYPES
): void {
  // Проверка на размера
  if (fileSize > MAX_FILE_SIZE) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Файлът е твърде голям. Максимален размер: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    });
  }

  // Проверка на типа
  const allowedTypes = ALLOWED_MIME_TYPES[category];
  if (!allowedTypes.includes(mimeType)) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Невалиден тип файл. Разрешени типове: ${allowedTypes.join(", ")}`,
    });
  }

  // Проверка на разширението (за сигурност)
  const ext = fileName.split(".").pop()?.toLowerCase();
  const validExtensions = {
    document: ["pdf", "doc", "docx", "xls", "xlsx", "txt"],
    avatar: ["jpg", "jpeg", "png", "gif", "webp"],
    attachment: [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "txt",
    ],
  };

  if (!ext || !validExtensions[category].includes(ext)) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: `Невалидно разширение на файла. Разрешени: ${validExtensions[category].join(", ")}`,
    });
  }
}

// ✅ FIX 4: INPUT ВАЛИДАЦИЯ И SANITIZATION
export function sanitizeString(input: string, maxLength: number = 500): string {
  // Премахни HTML тагове
  let sanitized = input.replace(/<[^>]*>/g, "");

  // Премахни скриптове
  sanitized = sanitized.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ""
  );

  // Ограничи дължината
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Escape специални символи
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");

  return sanitized.trim();
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  // Български телефонен номер (0[0-9]{9} или +359[0-9]{9})
  const phoneRegex = /^(\+359|0)[0-9]{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
}

export function validateName(name: string): boolean {
  // Само букви, интервали и тирета
  const nameRegex = /^[a-zA-Zа-яА-Я\s-]+$/;
  return nameRegex.test(name) && name.length >= 2 && name.length <= 100;
}
