import { v } from "convex/values";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

/**
 * Role-Based Access Control (RBAC) Patterns
 *
 * This example shows:
 * 1. Helper function for role checks
 * 2. Admin-only functions
 * 3. Role-based query filtering
 */

// =============================================================================
// Helper: Get authenticated user with role
// =============================================================================

type UserRole = "user" | "admin" | "moderator";

interface AuthenticatedUser {
  _id: Id<"users">;
  role: UserRole;
  email?: string;
}

async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx
): Promise<AuthenticatedUser | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;

  const user = await ctx.db.get(userId);
  if (!user) return null;

  return {
    _id: user._id,
    role: (user.role as UserRole) || "user",
    email: user.email,
  };
}

async function requireRole(
  ctx: QueryCtx | MutationCtx,
  allowedRoles: UserRole[]
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(ctx);

  if (!user) {
    throw new Error("Unauthorized");
  }

  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return user;
}

// =============================================================================
// Admin-Only Query
// =============================================================================

/**
 * List all users (admin only)
 */
export const listAllUsers = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Only admins can list all users
    await requireRole(ctx, ["admin"]);

    const users = await ctx.db.query("users").take(args.limit || 100);

    // Strip sensitive fields before returning
    return users.map((user) => ({
      _id: user._id,
      email: user.email,
      role: user.role,
      createdAt: user._creationTime,
    }));
  },
});

// =============================================================================
// Admin-Only Mutation
// =============================================================================

/**
 * Update user role (admin only)
 */
export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    newRole: v.union(
      v.literal("user"),
      v.literal("admin"),
      v.literal("moderator")
    ),
  },
  handler: async (ctx, { userId, newRole }) => {
    // Only admins can change roles
    const admin = await requireRole(ctx, ["admin"]);

    // Prevent self-demotion (optional safety)
    if (userId === admin._id && newRole !== "admin") {
      throw new Error("Cannot change your own admin role");
    }

    // Get target user
    const targetUser = await ctx.db.get(userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    // Update role
    await ctx.db.patch(userId, { role: newRole });

    return { success: true, userId, newRole };
  },
});

// =============================================================================
// Moderator+ Functions
// =============================================================================

/**
 * Moderate content (admin or moderator)
 */
export const moderateItem = mutation({
  args: {
    itemId: v.id("items"),
    action: v.union(
      v.literal("approve"),
      v.literal("reject"),
      v.literal("flag")
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { itemId, action, reason }) => {
    // Admins and moderators can moderate
    const moderator = await requireRole(ctx, ["admin", "moderator"]);

    const item = await ctx.db.get(itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    // Apply moderation action
    const updates: Record<string, unknown> = {
      moderatedAt: Date.now(),
      moderatedBy: moderator._id,
      moderationAction: action,
    };

    if (action === "reject" || action === "flag") {
      updates.moderationReason = reason || "Policy violation";
    }

    if (action === "approve") {
      updates.status = "published";
    } else if (action === "reject") {
      updates.status = "rejected";
    }

    await ctx.db.patch(itemId, updates);

    return { success: true, action };
  },
});

// =============================================================================
// Role-Conditional Data
// =============================================================================

/**
 * Get item with role-based visibility
 *
 * - Admins see everything
 * - Moderators see public + flagged
 * - Users see only public + their own
 */
export const getItemWithRoleVisibility = query({
  args: {
    itemId: v.id("items"),
  },
  handler: async (ctx, { itemId }) => {
    const user = await getAuthenticatedUser(ctx);
    const item = await ctx.db.get(itemId);

    if (!item) return null;

    // Admins see everything
    if (user?.role === "admin") {
      return item;
    }

    // Moderators see public and flagged items
    if (user?.role === "moderator") {
      if (item.status === "published" || item.status === "flagged") {
        return item;
      }
    }

    // Users see published items or their own
    if (item.status === "published") {
      return item;
    }

    if (user && item.userId === user._id) {
      return item;
    }

    return null;
  },
});
