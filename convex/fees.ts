import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

// GET /fees - List all fees
export const list = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args): Promise<Array<Doc<"fees"> & {
    assignmentCount: number;
    paidCount: number;
    readCount: number;
    totalCollected: number;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const fees = args.schoolId
      ? await ctx.db
          .query("fees")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("fees").collect();

    const enriched = await Promise.all(
      fees.map(async (fee) => {
        const assignments = await ctx.db
          .query("feeAssignments")
          .withIndex("by_fee", (q) => q.eq("feeId", fee._id))
          .collect();

        const paidCount = assignments.filter((a) => a.status === "paid").length;
        const readCount = assignments.filter((a) => a.status === "read" || a.status === "paid").length;
        const totalCollected = assignments
          .filter((a) => a.status === "paid")
          .reduce((sum, a) => sum + a.paidAmount, 0);

        return {
          ...fee,
          assignmentCount: assignments.length,
          paidCount,
          readCount,
          totalCollected,
        };
      })
    );

    return enriched;
  },
});

// GET /fees/:id - Get fee by ID
export const getById = query({
  args: { id: v.id("fees") },
  handler: async (ctx, args): Promise<Doc<"fees"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    return await ctx.db.get(args.id);
  },
});

// GET /fees/:id/installments - Get installments for a fee
export const getInstallments = query({
  args: { feeId: v.id("fees") },
  handler: async (ctx, args): Promise<Doc<"feeInstallments">[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const installments = await ctx.db
      .query("feeInstallments")
      .withIndex("by_fee", (q) => q.eq("feeId", args.feeId))
      .collect();

    return installments.sort((a, b) => a.index - b.index);
  },
});

// GET /fees/:id/assignments - Get assignments for a fee
export const getAssignments = query({
  args: { feeId: v.id("fees") },
  handler: async (ctx, args): Promise<Array<Doc<"feeAssignments"> & {
    userName: string;
    userRole: string;
    className?: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const assignments = await ctx.db
      .query("feeAssignments")
      .withIndex("by_fee", (q) => q.eq("feeId", args.feeId))
      .collect();

    const enriched = await Promise.all(
      assignments.map(async (assignment) => {
        const user = await ctx.db.get(assignment.userId);
        let className: string | undefined;

        if (user?.role === "student") {
          const student = await ctx.db
            .query("students")
            .withIndex("by_user", (q) => q.eq("userId", assignment.userId))
            .first();

          if (student) {
            const classDoc = await ctx.db.get(student.classId);
            className = classDoc?.name;
          }
        }

        return {
          ...assignment,
          userName: user?.name ?? "Неизвестен",
          userRole: user?.role ?? "unknown",
          className,
        };
      })
    );

    return enriched;
  },
});

// POST /fees - Create fee with installments and assignments
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    currency: v.union(v.literal("BGN"), v.literal("EUR"), v.literal("USD")),
    amount: v.number(),
    discountAmount: v.optional(v.number()),
    discountValidUntil: v.optional(v.number()),
    dueDate: v.number(),
    methods: v.object({
      cash: v.boolean(),
      online: v.boolean(),
      bank: v.boolean(),
    }),
    installmentsCount: v.number(),
    installments: v.array(
      v.object({
        index: v.number(),
        amount: v.number(),
        dueDate: v.number(),
      })
    ),
    assignToUserIds: v.array(v.id("users")),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<Id<"fees">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Validation: installmentsCount >= 1
    if (args.installmentsCount < 1) {
      throw new ConvexError({
        message: "Броят вноски трябва да бъде поне 1",
        code: "BAD_REQUEST",
      });
    }

    // Validation: sum of installments must equal total amount
    const totalAmount = args.discountAmount ?? args.amount;
    const installmentsSum = args.installments.reduce(
      (sum, inst) => sum + inst.amount,
      0
    );

    if (Math.abs(installmentsSum - totalAmount) > 0.01) {
      throw new ConvexError({
        message: "Сумата на вноските трябва да е равна на общата сума",
        code: "BAD_REQUEST",
      });
    }

    // Validation: if online payment is enabled, require payment provider config
    if (args.methods.online) {
      // TODO: Check for payment provider configuration
      // For now, just a placeholder check
    }

    // Validation: if bank transfer is enabled, require IBAN
    if (args.methods.bank) {
      const bankAccounts = await ctx.db
        .query("bankAccounts")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
        .collect();

      if (bankAccounts.length === 0) {
        throw new ConvexError({
          message:
            "Банково плащане изисква поне една банкова сметка в модул \"Банкови сметки\"",
          code: "BAD_REQUEST",
        });
      }
    }

    // Create fee
    const { installments, assignToUserIds, ...feeData } = args;
    const feeId = await ctx.db.insert("fees", {
      ...feeData,
      createdBy: user._id,
      createdDate: Date.now(),
    });

    // Create installments
    for (const installment of installments) {
      await ctx.db.insert("feeInstallments", {
        feeId,
        index: installment.index,
        amount: installment.amount,
        dueDate: installment.dueDate,
      });
    }

    // Create assignments
    for (const userId of assignToUserIds) {
      await ctx.db.insert("feeAssignments", {
        feeId,
        userId,
        installmentsCount: args.installmentsCount,
        totalAmount,
        paidAmount: 0,
        status: "unread",
        assignedDate: Date.now(),
      });
    }

    return feeId;
  },
});

// POST /fees/:id/payments - Record payment
export const recordPayment = mutation({
  args: {
    feeId: v.id("fees"),
    userId: v.id("users"),
    amount: v.number(),
    method: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Find assignment
    const assignments = await ctx.db
      .query("feeAssignments")
      .withIndex("by_fee", (q) => q.eq("feeId", args.feeId))
      .collect();

    const assignment = assignments.find((a) => a.userId === args.userId);

    if (!assignment) {
      throw new ConvexError({
        message: "Fee assignment not found",
        code: "NOT_FOUND",
      });
    }

    // Create payment record
    await ctx.db.insert("payments", {
      feeId: args.feeId,
      userId: args.userId,
      amount: args.amount,
      paymentDate: Date.now(),
      method: args.method,
      status: "paid",
      notes: args.notes,
    });

    // Update assignment
    const newPaidAmount = assignment.paidAmount + args.amount;
    const isPaid = newPaidAmount >= assignment.totalAmount;

    await ctx.db.patch(assignment._id, {
      paidAmount: newPaidAmount,
      status: isPaid ? "paid" : assignment.status === "unread" ? "read" : assignment.status,
    });
  },
});

// PATCH /fees/:id - Update fee
export const update = mutation({
  args: {
    id: v.id("fees"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// DELETE /fees/:id - Delete fee
export const remove = mutation({
  args: { id: v.id("fees") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Delete all related records
    const installments = await ctx.db
      .query("feeInstallments")
      .withIndex("by_fee", (q) => q.eq("feeId", args.id))
      .collect();

    for (const inst of installments) {
      await ctx.db.delete(inst._id);
    }

    const assignments = await ctx.db
      .query("feeAssignments")
      .withIndex("by_fee", (q) => q.eq("feeId", args.id))
      .collect();

    for (const assign of assignments) {
      await ctx.db.delete(assign._id);
    }

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_fee", (q) => q.eq("feeId", args.id))
      .collect();

    for (const payment of payments) {
      await ctx.db.delete(payment._id);
    }

    await ctx.db.delete(args.id);
  },
});

// GET /bank-accounts - List bank accounts
export const listBankAccounts = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    return args.schoolId
      ? await ctx.db
          .query("bankAccounts")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("bankAccounts").collect();
  },
});

// POST /bank-accounts - Create bank account
export const createBankAccount = mutation({
  args: {
    name: v.string(),
    iban: v.string(),
    bank: v.string(),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<Id<"bankAccounts">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const accountId = await ctx.db.insert("bankAccounts", {
      name: args.name,
      iban: args.iban,
      bank: args.bank,
      schoolId: args.schoolId,
    });

    return accountId;
  },
});

// GET /bank-accounts/:id - Get bank account by ID
export const getBankAccount = query({
  args: { id: v.id("bankAccounts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    return await ctx.db.get(args.id);
  },
});

// PATCH /bank-accounts/:id - Update bank account
export const updateBankAccount = mutation({
  args: {
    id: v.id("bankAccounts"),
    name: v.string(),
    iban: v.string(),
    bank: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// DELETE /bank-accounts/:id - Delete bank account
export const removeBankAccount = mutation({
  args: { id: v.id("bankAccounts") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    await ctx.db.delete(args.id);
  },
});
