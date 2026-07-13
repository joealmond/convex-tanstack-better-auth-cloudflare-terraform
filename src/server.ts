import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { applySecurityHeaders } from './lib/security-headers'

export default createServerEntry({
  async fetch(request: Request) {
    const response = await handler.fetch(request)
    return applySecurityHeaders(response, request)
  },
})
