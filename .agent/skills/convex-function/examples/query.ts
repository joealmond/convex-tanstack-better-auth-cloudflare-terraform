import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * List items for the authenticated user
 *
 * Features:
 * - Authentication required
 * - User-scoped data (only returns user's items)
 * - Uses index for efficient querying
 * - Sorted by creation date
 */
export const list = query({
  args: {
    status: v.optional(
      v.union(v.literal("draft"), v.literal("published"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Verify authentication
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // 2. Build query with user filter
    let itemsQuery = ctx.db
      .query("items")
      .withIndex("by_user", (q) => q.eq("userId", userId));

    // 3. Apply optional status filter
    if (args.status) {
      itemsQuery = itemsQuery.filter((q) =>
        q.eq(q.field("status"), args.status)
      );
    }

    // 4. Execute and collect results
    const items = await itemsQuery.order("desc").collect();

    // 5. Apply limit if specified
    if (args.limit) {
      return items.slice(0, args.limit);
    }

    return items;
  },
});

/**
 * Get a single item by ID
 *
 * Features:
 * - Authentication required
 * - Ownership verification (user can only get their own items)
 */
export const get = query({
  args: {
    id: v.id("items"),
  },
  handler: async (ctx, { id }) => {
    // 1. Verify authentication
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // 2. Get the item
    const item = await ctx.db.get(id);

    // 3. Verify ownership
    if (!item) return null;
    if (item.userId !== userId) throw new Error("Forbidden");

    return item;
  },
});
