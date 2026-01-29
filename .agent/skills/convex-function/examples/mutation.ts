import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Create a new item
 *
 * Features:
 * - Authentication required
 * - Input validation
 * - Automatic userId and timestamp
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("published"))
    ),
  },
  handler: async (ctx, args) => {
    // 1. Verify authentication
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // 2. Validate input
    if (!args.name.trim()) {
      throw new Error("Name is required");
    }

    // 3. Insert with defaults
    const itemId = await ctx.db.insert("items", {
      name: args.name.trim(),
      description: args.description?.trim() || "",
      status: args.status || "draft",
      userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return itemId;
  },
});

/**
 * Update an existing item
 *
 * Features:
 * - Authentication required
 * - Ownership verification
 * - Partial updates
 */
export const update = mutation({
  args: {
    id: v.id("items"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("published"))
    ),
  },
  handler: async (ctx, args) => {
    // 1. Verify authentication
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // 2. Get existing item
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Item not found");

    // 3. Verify ownership
    if (existing.userId !== userId) {
      throw new Error("Forbidden");
    }

    // 4. Build update object (only provided fields)
    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) {
      if (!args.name.trim()) throw new Error("Name cannot be empty");
      updates.name = args.name.trim();
    }
    if (args.description !== undefined) {
      updates.description = args.description.trim();
    }
    if (args.status !== undefined) {
      updates.status = args.status;
    }

    // 5. Apply update
    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

/**
 * Delete an item
 *
 * Features:
 * - Authentication required
 * - Ownership verification
 * - Soft delete option (uncomment if needed)
 */
export const remove = mutation({
  args: {
    id: v.id("items"),
  },
  handler: async (ctx, { id }) => {
    // 1. Verify authentication
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // 2. Get existing item
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Item not found");

    // 3. Verify ownership
    if (existing.userId !== userId) {
      throw new Error("Forbidden");
    }

    // 4. Hard delete
    await ctx.db.delete(id);

    // Alternative: Soft delete
    // await ctx.db.patch(id, { deletedAt: Date.now() });

    return id;
  },
});
