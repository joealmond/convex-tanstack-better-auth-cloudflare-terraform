import { StartClient } from '@tanstack/react-start'
import { hydrateRoot } from 'react-dom/client'
import { getRouter } from './router'

// Initialize Sentry for error tracking (production only)
const initSentry = async () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.log('[Sentry] Disabled: No VITE_SENTRY_DSN configured')
    }
    return
  }

  try {
    const Sentry = await import('@sentry/react')
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_APP_ENV || 'development',
      enabled: import.meta.env.PROD,
      // Minimal config for template - extend as needed
      tracesSampleRate: 0, // Disable performance tracing to keep it simple
    })
    console.log('[Sentry] Initialized')
  } catch (error) {
    console.warn('[Sentry] Failed to initialize:', error)
  }
}

// Initialize Sentry, then hydrate
initSentry().then(() => {
  const router = getRouter()
  hydrateRoot(document, <StartClient router={router} />)
})
