# AI Streaming

The working example lives at `/examples/ai` with backend code in `convex/ai.ts`.

## Configure

Keep provider credentials in Convex; never use a `VITE_` variable for them.

```bash
npx convex env set OPENAI_API_KEY "sk-..."
npx convex env set OPENAI_MODEL "gpt-5.4-mini"
```

`OPENAI_MODEL` is optional. Choose a model your account can access and review its cost/latency
tradeoffs before production use.

## How it works

1. An authenticated mutation validates the prompt, applies the `aiStart` rate limit, creates an
   `aiRuns` row, and schedules an internal action.
2. The action calls the OpenAI Responses API with `stream: true`.
3. It consumes `response.output_text.delta` SSE events and flushes bounded batches through internal
   mutations instead of writing once per token.
4. Convex subscriptions deliver persisted output and status changes to the browser in realtime.
5. Provider errors become a safe run-level error; secrets and response internals are not returned.

## Guardrails included

- Authentication before spend
- Server-only API key and configurable model
- Prompt and output length limits
- Conservative rate limiting
- Bounded response-body and delta buffering
- Batched database writes
- Clear queued, streaming, completed, and error states

For production, add per-plan quotas, usage telemetry, moderation appropriate to your product, and a
provider timeout/cancellation policy. The example deliberately avoids pretending that a UI rate
limit is a billing control.

## Test

`convex/integrations.test.ts` verifies the scheduled failure path when the provider key is absent.
Use a separate provider test account for live integration tests; do not put real keys in pull
request workflows.
