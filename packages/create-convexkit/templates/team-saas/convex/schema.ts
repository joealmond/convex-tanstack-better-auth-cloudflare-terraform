import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  organizations: defineTable({ name: v.string(), slug: v.string(), createdBy: v.string() }).index('by_slug', ['slug']),
  organizationMembers: defineTable({
    organizationId: v.id('organizations'), userId: v.string(),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
  }).index('by_organization_user', ['organizationId', 'userId']).index('by_user', ['userId']),
  organizationInvitations: defineTable({
    organizationId: v.id('organizations'), email: v.string(),
    role: v.union(v.literal('admin'), v.literal('member')), invitedBy: v.string(), expiresAt: v.number(),
  }).index('by_organization_email', ['organizationId', 'email']),
})
