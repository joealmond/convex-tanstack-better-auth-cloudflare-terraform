import { afterEach, describe, expect, it, vi } from 'vitest'
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import schema from '../schema'
import { modules } from '../test.utils'
import {
  publicQuery,
  publicMutation,
  publicAction,
  internalQuery,
  internalMutation,
  internalAction,
  authQuery,
  adminMutation,
} from './customFunctions'

const secret = 'private database connection details'
afterEach(() => vi.restoreAllMocks())

describe('function error boundaries', () => {
  for (const [name, kind, builder] of [
    ['publicQuery', 'query', publicQuery],
    ['publicMutation', 'mutation', publicMutation],
    ['publicAction', 'action', publicAction],
    ['internalQuery', 'query', internalQuery],
    ['internalMutation', 'mutation', internalMutation],
    ['internalAction', 'action', internalAction],
  ] as const) {
    it(`sanitizes handler errors in ${name}`, async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      const t = convexTest(schema, {
        ...modules,
        './errorBoundary.ts': async () => ({
          fail: builder({
            args: {},
            handler: async () => {
              throw new Error(secret)
            },
          }),
        }),
      })
      const result =
        kind === 'query'
          ? t.query(makeFunctionReference<'query'>('errorBoundary:fail'))
          : kind === 'mutation'
            ? t.mutation(makeFunctionReference<'mutation'>('errorBoundary:fail'))
            : t.action(makeFunctionReference<'action'>('errorBoundary:fail'))
      await expect(result).rejects.toMatchObject({
        data: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          errorId: expect.any(String),
        },
      })
      expect(log).toHaveBeenCalledOnce()
      const logged = JSON.parse(log.mock.calls[0]![0] as string)
      expect(logged).toMatchObject({ context: name, message: secret })
    })
  }

  it('preserves intentional errors and inferred return values', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const t = convexTest(schema, {
      ...modules,
      './errorBoundary.ts': async () => ({
        intentional: publicQuery({
          handler: () => {
            throw new ConvexError('Not allowed')
          },
        }),
        double: publicMutation({
          args: { value: v.number() },
          returns: v.number(),
          handler: (_ctx, { value }) => value * 2,
        }),
      }),
    })
    await expect(
      t.query(makeFunctionReference<'query'>('errorBoundary:intentional'))
    ).rejects.toMatchObject({ data: 'Not allowed' })
    expect(
      await t.mutation(makeFunctionReference<'mutation'>('errorBoundary:double'), { value: 4 })
    ).toBe(8)
    expect(log).not.toHaveBeenCalled()
  })

  it('catches handler failures after authentication and rejects unauthorized callers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const auth = await import('./authHelpers')
    const requireAuth = vi
      .spyOn(auth, 'requireAuth')
      .mockResolvedValue({ _id: 'user', name: 'User', email: 'user@example.com' })
    vi.spyOn(auth, 'requireAdmin').mockRejectedValue(new ConvexError('Admin access required'))
    const t = convexTest(schema, {
      ...modules,
      './errorBoundary.ts': async () => ({
        authenticated: authQuery({
          handler: () => {
            throw new Error(secret)
          },
        }),
        restricted: adminMutation({ handler: () => 'never' }),
      }),
    })
    await expect(
      t.query(makeFunctionReference<'query'>('errorBoundary:authenticated'))
    ).rejects.toMatchObject({ data: { code: 'INTERNAL_ERROR' } })
    requireAuth.mockRejectedValueOnce(new Error(secret))
    await expect(
      t.query(makeFunctionReference<'query'>('errorBoundary:authenticated'))
    ).rejects.toMatchObject({
      data: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    })
    requireAuth.mockRejectedValueOnce(new ConvexError('Authentication required'))
    await expect(
      t.query(makeFunctionReference<'query'>('errorBoundary:authenticated'))
    ).rejects.toMatchObject({ data: 'Authentication required' })
    await expect(
      t.mutation(makeFunctionReference<'mutation'>('errorBoundary:restricted'))
    ).rejects.toMatchObject({ data: 'Admin access required' })
  })
})
