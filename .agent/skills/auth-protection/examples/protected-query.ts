import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Protected Query with User Scoping
 *
 * This example shows how to:
 * 1. Verify authentication
 * 2. Scope data to the authenticated user
 * 3. Use indexes for efficient user-filtered queries
 */

export const getUserItems = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // 1. Require authentication
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // 2. Query with user filter using index
    let query = ctx.db
      .query("items")
      .withIndex("by_user", (q) => q.eq("userId", userId));

    // 3. Apply additional filters
    if (!args.includeArchived) {
      query = query.filter((q) =>
        q.neq(q.field("status"), "archived")
      );
    }

    return await query.collect();
  },
});

/**
 * Protected Single Item Query
 *
 * Verifies both authentication AND ownership
 */
export const getItemById = query({
  args: {
    id: v.id("items"),
  },
  handler: async (ctx, { id }) => {
    // 1. Require authentication
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // 2. Get the item
    const item = await ctx.db.get(id);

    // 3. Return null if not found (don't reveal existence)
    if (!item) {
      return null;
    }

    // 4. Verify ownership
    if (item.userId !== userId) {
      // Return null instead of "Forbidden" to not leak info
      return null;
    }

    return item;
  },
});

/**
 * Protected Mutation with Ownership Check
 *
 * Only allows users to modify their own items
 */
export const updateItem = mutation({
  args: {
    id: v.id("items"),
    name: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived")
      )
    ),
  },
  handler: async (ctx, args) => {
    // 1. Require authentication
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized");
    }

    // 2. Get existing item
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Item not found");
    }

    // 3. Verify ownership - critical security check!
    if (existing.userId !== userId) {
      throw new Error("Forbidden");
    }

    // 4. Apply updates
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      updates.name = args.name;
    }
    if (args.status !== undefined) {
      updates.status = args.status;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});
