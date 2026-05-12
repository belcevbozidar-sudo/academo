"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Миграция на badge типове - ИЗТРИВА ВСИЧКИ СТАРИ
export const runBadgeMigration = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deleted: number; message: string }> => {
    try {
      // Вземи всички badges
      const badges = await ctx.runQuery(internal.migrateBadgesHelpers.getAllBadges, {});
      
      console.log(`Намерени ${badges.length} badges за проверка`);
      
      // Списък на новите валидни типове
      const validTypes = new Set([
        "general_remark",
        "bad_discipline",
        "lack_of_attention",
        "official_remark",
        "disrespect",
        "aggression",
        "removed_from_class",
        "late",
        "absence",
        "poor_performance",
        "unprepared",
        "no_homework",
        "no_textbook",
        "no_materials",
        "no_equipment",
        "no_uniform",
        "breakfast",
        "lunch",
        "afternoon_sleep",
        "afternoon_snack",
      ]);
      
      let deletedCount = 0;
      
      // Изтрий всички badges, които нямат нов валиден тип
      for (const badge of badges) {
        if (!validTypes.has(badge.type)) {
          await ctx.runMutation(internal.migrateBadgesHelpers.deleteBadge, {
            badgeId: badge._id,
          });
          deletedCount++;
        }
      }
      
      console.log(`Изтрити ${deletedCount} стари badges`);
      
      return {
        deleted: deletedCount,
        message: `Миграцията е завършена успешно! Изтрити ${deletedCount} стари badges.`,
      };
    } catch (error) {
      console.error("Грешка при миграция:", error);
      throw error;
    }
  },
});
