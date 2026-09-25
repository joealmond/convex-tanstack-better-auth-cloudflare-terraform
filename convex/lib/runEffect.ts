import { Effect, Either } from 'effect'

/** Run an Effect at a Convex boundary without changing expected error values. */
export async function runEffect<A, E>(program: Effect.Effect<A, E>): Promise<A> {
  const result = await Effect.runPromise(Effect.either(program))
  if (Either.isLeft(result)) throw result.left
  return result.right
}
