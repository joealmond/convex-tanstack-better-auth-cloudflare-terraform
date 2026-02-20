# Convex Functions

This project uses **custom function wrappers** from `lib/customFunctions.ts` for type-safe auth injection and global error handling. Always import from there — NOT from `_generated/server`.

See https://docs.convex.dev/functions for Convex basics.

## Available Wrappers

| Wrapper            | Auth          | Use Case                          |
| ------------------ | ------------- | --------------------------------- |
| `publicQuery`      | None          | Public reads, SSR loaders         |
| `publicMutation`   | None          | Anonymous writes (e.g. guest msg) |
| `authQuery`        | Required      | Authenticated reads               |
| `authMutation`     | Required      | Authenticated writes              |
| `adminQuery`       | Admin only    | Admin dashboards                  |
| `adminMutation`    | Admin only    | Admin operations                  |
| `internalQuery`    | None (callee) | Internal reads (crons, actions)   |
| `internalMutation` | None (callee) | Internal writes (side effects)    |
| `internalAction`   | None (callee) | Internal actions (external APIs)  |

## Query Example

```ts
import { publicQuery } from './lib/customFunctions'
import { v } from 'convex/values'

export const myQueryFunction = publicQuery({
  args: {
    first: v.number(),
    second: v.string(),
  },
  handler: async (ctx, args) => {
    const documents = await ctx.db.query('tablename').collect()
    console.log(args.first, args.second)
    return documents
  },
})
```

Using this query function in a React component looks like:

```ts
const data = useQuery(api.myFunctions.myQueryFunction, {
  first: 10,
  second: 'hello',
})
```

## Mutation Example (Authenticated)

```ts
import { authMutation } from './lib/customFunctions'
import { v } from 'convex/values'

export const myMutationFunction = authMutation({
  args: {
    first: v.string(),
    second: v.string(),
  },
  handler: async (ctx, args) => {
    // ctx.user and ctx.userId are auto-injected
    const message = { body: args.first, author: ctx.user.name }
    const id = await ctx.db.insert('messages', message)
    return await ctx.db.get(id)
  },
})
```

Using this mutation function in a React component looks like:

```ts
const mutation = useMutation(api.myFunctions.myMutationFunction)
function handleButtonPress() {
  mutation({ first: 'Hello!', second: 'me' })
}
```

Use the Convex CLI to push your functions to a deployment. See everything
the Convex CLI can do by running `npx convex -h` in your project root
directory. To learn more, launch the docs with `npx convex docs`.
