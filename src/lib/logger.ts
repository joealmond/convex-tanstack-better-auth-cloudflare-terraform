/**
 * Centralized Logger with Optional Sentry Integration
 * =====================================================
 *
 * Provides structured logging across the frontend:
 * - **Development**: Rich formatted console output with timestamps
 * - **Production**: Errors → Sentry.captureException(), Warnings → Sentry.captureMessage()
 *
 * Sentry is optional — if `@sentry/react` isn't installed or `VITE_SENTRY_DSN` isn't set,
 * the logger gracefully falls back to console-only output.
 *
 * ## Usage
 *
 * ```ts
 * import { logger } from '@/lib/logger'
 *
 * logger.info('User signed in', { userId: '123' })
 * logger.warn('Slow query detected', { duration: 3200 })
 * logger.error('Failed to upload file', error, { fileId: 'abc' })
 * ```
 */

type LogLevel = 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

/** Cached Sentry module (loaded once on first error in prod) */
let _sentry: typeof import('@sentry/react') | null | undefined

/**
 * Attempt to import @sentry/react. Returns null if not available.
 * Caches the result so subsequent calls are synchronous.
 */
async function getSentry(): Promise<typeof import('@sentry/react') | null> {
  if (_sentry !== undefined) return _sentry
  try {
    _sentry = await import('@sentry/react')
    return _sentry
  } catch {
    _sentry = null
    return null
  }
}

class Logger {
  private log(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
    const timestamp = new Date().toISOString()

    if (import.meta.env.DEV) {
      // Development: formatted console output
      const args: unknown[] = [`[${timestamp}] ${level.toUpperCase()}: ${message}`]
      if (context) args.push(context)
      if (error) args.push(error)

      switch (level) {
        case 'info':
          console.info(...args)
          break
        case 'warn':
          console.warn(...args)
          break
        case 'error':
          console.error(...args)
          break
      }
    } else {
      // Production: Sentry dispatch (async, fire-and-forget)
      if (level === 'error') {
        console.error(JSON.stringify({ timestamp, level, message, context, error }))
        getSentry().then((Sentry) => {
          if (Sentry) {
            Sentry.captureException(error || new Error(message), {
              extra: context,
            })
          }
        })
      } else if (level === 'warn') {
        getSentry().then((Sentry) => {
          if (Sentry) {
            Sentry.captureMessage(message, {
              level: 'warning',
              extra: context,
            })
          }
        })
      }
      // info is silent in production (no noise)
    }
  }

  /** Log informational messages (dev console only, silent in prod) */
  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }

  /** Log warnings — dispatched to Sentry in production */
  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }

  /** Log errors — dispatched to Sentry.captureException() in production */
  error(message: string, error?: unknown, context?: LogContext) {
    this.log('error', message, context, error)
  }
}

export const logger = new Logger()
