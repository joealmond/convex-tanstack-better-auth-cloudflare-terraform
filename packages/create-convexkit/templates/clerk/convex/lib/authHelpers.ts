import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server'
import { ConvexError } from 'convex/values'
import { ADMIN_EMAILS } from './config'

type AuthContext = QueryCtx | MutationCtx | ActionCtx

export interface AuthUser {
  _id: string
  name: string
  email: string
  image?: string | null
  role?: string | null
}

export async function getAuthUser(ctx: AuthContext): Promise<AuthUser | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  const claims = identity as Record<string, unknown>
  return {
    _id: identity.subject,
    name: identity.name ?? identity.nickname ?? 'User',
    email: identity.email ?? '',
    image: identity.pictureUrl,
    role: typeof claims.role === 'string' ? claims.role : null,
  }
}

export async function getAuthUserSafe(ctx: AuthContext): Promise<AuthUser | null> {
  try {
    return await getAuthUser(ctx)
  } catch {
    return null
  }
}

export async function requireAuth(ctx: AuthContext): Promise<AuthUser> {
  const user = await getAuthUser(ctx)
  if (!user) throw new ConvexError('Authentication required')
  return user
}

export function isAdmin(user: AuthUser): boolean {
  return ADMIN_EMAILS.includes(user.email) || user.role === 'admin'
}

export async function requireAdmin(ctx: AuthContext): Promise<AuthUser> {
  const user = await requireAuth(ctx)
  if (!isAdmin(user)) throw new ConvexError('Admin access required')
  return user
}
