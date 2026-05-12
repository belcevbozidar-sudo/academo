import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// ROOMS
export const listRooms = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const rooms = args.schoolId
      ? await ctx.db
          .query("rooms")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("rooms").collect();

    // Sort by floor and name
    rooms.sort((a, b) => {
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.name.localeCompare(b.name);
    });

    // Enrich with asset count
    const enrichedRooms = await Promise.all(
      rooms.map(async (room) => {
        const assets = await ctx.db
          .query("assets")
          .withIndex("by_room", (q) => q.eq("roomId", room._id))
          .collect();

        return {
          ...room,
          assetCount: assets.length,
        };
      })
    );

    return enrichedRooms;
  },
});

export const createRoom = mutation({
  args: {
    name: v.string(),
    floor: v.number(),
    capacity: v.optional(v.number()),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<Id<"rooms">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.db.insert("rooms", args);
  },
});

export const updateRoom = mutation({
  args: {
    id: v.id("rooms"),
    name: v.optional(v.string()),
    floor: v.optional(v.number()),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteRoom = mutation({
  args: { id: v.id("rooms") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    await ctx.db.delete(args.id);
  },
});

// ASSETS
export const listAssets = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    roomId: v.optional(v.id("rooms")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    let assets;
    if (args.roomId) {
      assets = await ctx.db
        .query("assets")
        .withIndex("by_room", (q) => q.eq("roomId", args.roomId!))
        .collect();
    } else if (args.schoolId) {
      assets = await ctx.db
        .query("assets")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
        .collect();
    } else {
      assets = await ctx.db.query("assets").collect();
    }

    // Enrich with room and supplier names
    const enrichedAssets = await Promise.all(
      assets.map(async (asset) => {
        const room = asset.roomId ? await ctx.db.get(asset.roomId) : null;
        const supplier = asset.supplierId
          ? await ctx.db.get(asset.supplierId)
          : null;

        return {
          ...asset,
          roomName: room?.name,
          supplierName: supplier?.name,
        };
      })
    );

    return enrichedAssets;
  },
});

export const createAsset = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    roomId: v.optional(v.id("rooms")),
    quantity: v.number(),
    unit: v.string(),
    schoolId: v.id("schools"),
    supplierId: v.optional(v.id("suppliers")),
    accountNumber: v.optional(v.string()),
    purchaseDate: v.optional(v.number()),
    value: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"assets">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.db.insert("assets", args);
  },
});

export const updateAsset = mutation({
  args: {
    id: v.id("assets"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    roomId: v.optional(v.id("rooms")),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    supplierId: v.optional(v.id("suppliers")),
    accountNumber: v.optional(v.string()),
    value: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteAsset = mutation({
  args: { id: v.id("assets") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    await ctx.db.delete(args.id);
  },
});

// SUPPLIERS
export const listSuppliers = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const suppliers = args.schoolId
      ? await ctx.db
          .query("suppliers")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("suppliers").collect();

    return suppliers;
  },
});

export const createSupplier = mutation({
  args: {
    name: v.string(),
    contact: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<Id<"suppliers">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.db.insert("suppliers", args);
  },
});

export const updateSupplier = mutation({
  args: {
    id: v.id("suppliers"),
    name: v.optional(v.string()),
    contact: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteSupplier = mutation({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    await ctx.db.delete(args.id);
  },
});
