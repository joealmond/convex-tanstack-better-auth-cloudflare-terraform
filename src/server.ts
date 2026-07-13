import handler from '@tanstack/react-start/server-entry'
import { applySecurityHeaders } from './lib/security-headers'

export default {
  async fetch(request: Request) {
    const response = await handler.fetch(request)
    return applySecurityHeaders(response, request)
  },
}
