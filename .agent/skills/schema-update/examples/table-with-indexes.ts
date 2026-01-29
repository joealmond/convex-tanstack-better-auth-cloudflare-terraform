/**
 * Example Convex Schema with Indexes
 *
 * This file shows a complete schema definition with:
 * - Multiple tables
 * - Various field types
 * - Proper indexes
 * - Foreign key relationships
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // =========================================================================
  // Users Table (managed by Better Auth)
  // =========================================================================
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    role: v.optional(v.union(
      v.literal("user"),
      v.literal("admin"),
      v.literal("moderator")
    )),
    emailVerified: v.optional(v.boolean()),
  })
    .index("by_email", ["email"]),

  // =========================================================================
  // Projects Table
  // =========================================================================
  projects: defineTable({
    // Basic fields
    name: v.string(),
    description: v.optional(v.string()),
    slug: v.string(), // URL-friendly identifier

    // Status enum
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("archived")
    ),

    // Visibility
    isPublic: v.boolean(),

    // Owner reference
    ownerId: v.id("users"),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Optional metadata object
    settings: v.optional(v.object({
      color: v.optional(v.string()),
      icon: v.optional(v.string()),
      notificationsEnabled: v.optional(v.boolean()),
    })),
  })
    // Indexes for common queries
    .index("by_owner", ["ownerId"])
    .index("by_slug", ["slug"])
    .index("by_status", ["status"])
    .index("by_owner_and_status", ["ownerId", "status"]),

  // =========================================================================
  // Tasks Table (belongs to Project)
  // =========================================================================
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),

    // Status with more options
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
      v.literal("cancelled")
    ),

    // Priority enum
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),

    // Foreign keys
    projectId: v.id("projects"),
    assigneeId: v.optional(v.id("users")),
    createdById: v.id("users"),

    // Optional due date
    dueDate: v.optional(v.number()),

    // Tags as array
    tags: v.array(v.string()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_assignee", ["assigneeId"])
    .index("by_project_and_status", ["projectId", "status"])
    .index("by_due_date", ["dueDate"]),

  // =========================================================================
  // Comments Table (belongs to Task)
  // =========================================================================
  comments: defineTable({
    content: v.string(),

    // Foreign keys
    taskId: v.id("tasks"),
    authorId: v.id("users"),

    // Reply threading
    parentId: v.optional(v.id("comments")),

    // Soft delete
    deletedAt: v.optional(v.number()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_author", ["authorId"])
    .index("by_parent", ["parentId"]),

  // =========================================================================
  // Project Members (many-to-many)
  // =========================================================================
  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(
      v.literal("viewer"),
      v.literal("editor"),
      v.literal("admin")
    ),
    invitedAt: v.number(),
    joinedAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_and_user", ["projectId", "userId"]),

  // =========================================================================
  // Activity Log (audit trail)
  // =========================================================================
  activityLog: defineTable({
    action: v.string(), // e.g., "task.created", "project.updated"
    entityType: v.string(), // e.g., "task", "project"
    entityId: v.string(), // ID of the affected entity
    userId: v.id("users"), // Who performed the action
    metadata: v.optional(v.any()), // Additional context
    createdAt: v.number(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_user", ["userId"])
    .index("by_action", ["action"]),
});
