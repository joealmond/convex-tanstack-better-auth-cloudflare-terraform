/// <reference types="vite/client" />

import { convexTest, type TestConvex } from 'convex-test'
import betterAuthTest from '@convex-dev/better-auth/test'
import rateLimiterTest from '@convex-dev/rate-limiter/test'
import type { UserIdentity } from 'convex/server'
import { components } from './_generated/api'
import schema from './schema'

export const modules = import.meta.glob('./**/*.*s')

export function createTestBackend() {
  const t = convexTest(schema, modules)
  betterAuthTest.register(t)
  rateLimiterTest.register(t)
  return t
}

export async function createAuthenticatedTest(user: { name?: string; email?: string } = {}) {
  const t = createTestBackend()
  const now = Date.now()
  const email = user.email ?? 'person@example.com'
  const createdUser = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: 'user',
      data: {
        name: user.name ?? 'Test Person',
        email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    },
  })
  const userId = createdUser._id as string
  const createdSession = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: 'session',
      data: {
        userId,
        token: `test-session-${userId}`,
        expiresAt: now + 60 * 60 * 1_000,
        createdAt: now,
        updatedAt: now,
      },
    },
  })
  const sessionId = createdSession._id as string
  const identity = {
    subject: userId,
    email,
    name: user.name ?? 'Test Person',
    sessionId,
  } as Partial<UserIdentity>

  return {
    t,
    asUser: t.withIdentity(identity),
    userId,
    sessionId,
  }
}

export type TestBackend = TestConvex<typeof schema>
