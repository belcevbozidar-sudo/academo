"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";

// Internal action to hash a password (requires Node.js runtime)
export const hashPassword = internalAction({
  args: { password: v.string() },
  handler: async (_ctx, args): Promise<string> => {
    return await bcrypt.hash(args.password, 10);
  },
});

// Internal action to verify a password (requires Node.js runtime)
export const verifyPassword = internalAction({
  args: { 
    password: v.string(),
    hashedPassword: v.string(),
  },
  handler: async (_ctx, args): Promise<boolean> => {
    return await bcrypt.compare(args.password, args.hashedPassword);
  },
});
