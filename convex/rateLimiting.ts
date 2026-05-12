import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

// ✅ FIX 1: RATE LIMITING ЗА КРИТИЧНИ ОПЕРАЦИИ
// Проверява дали потребителят не прави твърде много заявки

const RATE_LIMITS = {
  // Операция: [максимален брой заявки, период в минути]
  create_user: [200, 60], // 200 потребители на час
  delete_user: [5, 60], // 5 изтривания на час
  update_grade: [100, 60], // 100 оценки на час
  create_document: [20, 60], // 20 документа на час
  send_message: [50, 5], // 50 съобщения на 5 минути
  default: [30, 5], // 30 действия на 5 минути за всичко останало
};

export async function checkRateLimit(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: string
): Promise<void> {
  const now = Date.now();
  const [maxRequests, windowMinutes] =
    RATE_LIMITS[action as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
  const windowMs = windowMinutes * 60 * 1000;

  // Вземи последните записи за този потребител и действие
  const recentLimits = await ctx.db
    .query("rateLimits")
    .withIndex("by_user_and_action", (q) =>
      q.eq("userId", userId).eq("action", action)
    )
    .collect();

  // Филтрирай само тези в прозореца на време
  const recentInWindow = recentLimits.filter(
    (limit) => limit.timestamp > now - windowMs
  );

  // Изчисли общия брой заявки
  const totalRequests = recentInWindow.reduce(
    (sum, limit) => sum + limit.count,
    0
  );

  if (totalRequests >= maxRequests) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Твърде много заявки. Моля, изчакайте ${windowMinutes} минути.`,
    });
  }

  // Запиши новата заявка
  await ctx.db.insert("rateLimits", {
    userId,
    action,
    timestamp: now,
    count: 1,
  });

  // Изчисти стари записи (по-стари от 24 часа)
  const oldLimits = await ctx.db
    .query("rateLimits")
    .withIndex("by_timestamp", (q) => q.lt("timestamp", now - 24 * 60 * 60 * 1000))
    .take(100);

  for (const limit of oldLimits) {
    await ctx.db.delete(limit._id);
  }
}
