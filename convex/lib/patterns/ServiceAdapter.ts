/**
 * Service Adapter Pattern Example
 * ================================
 * 
 * Wrap external services to abstract implementation details and enable swapping.
 * 
 * Benefits:
 * - Easy to swap implementations (Resend → SendGrid)
 * - Testable (use mock in tests)
 * - Rate limiting in one place
 * - Consistent error handling
 * 
 * Usage:
 * ```typescript
 * import { EmailService } from './lib/patterns/ServiceAdapter'
 * 
 * export const registerUser = mutation({
 *   handler: async (ctx, args) => {
 *     const emailService = new EmailService(ctx)
 *     await emailService.sendWelcome(args.email, args.name)
 *   },
 * })
 * ```
 */

import type { MutationCtx } from '../_generated/server'

/**
 * Email Service Interface
 * Define the contract that all email implementations must follow
 */
export interface IEmailService {
  sendWelcome(to: string, name: string): Promise<void>
  sendPasswordReset(to: string, token: string): Promise<void>
  sendNotification(to: string, subject: string, message: string): Promise<void>
}

/**
 * Production Email Service (using Resend or similar)
 * 
 * To use with @convex-dev/resend:
 * 1. npm install @convex-dev/resend
 * 2. Configure in convex.config.ts
 * 3. Pass resend component to constructor
 */
export class EmailService implements IEmailService {
  constructor(private ctx: MutationCtx) {}

  async sendWelcome(to: string, name: string) {
    // In production, use @convex-dev/resend component:
    // await this.resend.send(ctx, { ... })
    
    console.log(`[EMAIL] Welcome email to ${to} (${name})`)
    
    // Example with manual implementation:
    // await this.send({
    //   to,
    //   subject: `Welcome, ${name}!`,
    //   html: this.renderWelcomeTemplate(name),
    // })
  }

  async sendPasswordReset(to: string, token: string) {
    const resetUrl = `${process.env.SITE_URL}/reset-password?token=${token}`
    console.log(`[EMAIL] Password reset to ${to}`)
    
    // await this.send({
    //   to,
    //   subject: 'Reset your password',
    //   html: this.renderResetTemplate(resetUrl),
    // })
  }

  async sendNotification(to: string, subject: string, message: string) {
    console.log(`[EMAIL] Notification to ${to}: ${subject}`)
    
    // await this.send({
    //   to,
    //   subject,
    //   html: `<p>${message}</p>`,
    // })
  }

  private renderWelcomeTemplate(name: string): string {
    return `
      <h1>Welcome, ${name}!</h1>
      <p>Thanks for joining our platform.</p>
      <p>Get started by exploring your dashboard.</p>
    `
  }

  private renderResetTemplate(resetUrl: string): string {
    return `
      <h1>Reset your password</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link expires in 1 hour.</p>
    `
  }
}

/**
 * Mock Email Service for Testing
 * Use this in development or tests to avoid sending real emails
 */
export class MockEmailService implements IEmailService {
  public sentEmails: Array<{
    to: string
    type: 'welcome' | 'password_reset' | 'notification'
    data: any
  }> = []

  async sendWelcome(to: string, name: string) {
    this.sentEmails.push({
      to,
      type: 'welcome',
      data: { name },
    })
  }

  async sendPasswordReset(to: string, token: string) {
    this.sentEmails.push({
      to,
      type: 'password_reset',
      data: { token },
    })
  }

  async sendNotification(to: string, subject: string, message: string) {
    this.sentEmails.push({
      to,
      type: 'notification',
      data: { subject, message },
    })
  }

  /** Get all sent emails (for testing assertions) */
  getSentEmails() {
    return this.sentEmails
  }

  /** Clear sent emails */
  clear() {
    this.sentEmails = []
  }
}

/**
 * Payment Service Interface
 */
export interface IPaymentService {
  createCheckoutSession(userId: string, priceId: string): Promise<{ url: string }>
  createCustomerPortal(userId: string): Promise<{ url: string }>
  hasActiveSubscription(userId: string): Promise<boolean>
}

/**
 * Stripe Payment Service Adapter
 * 
 * To use with @convex-dev/stripe:
 * 1. npm install @convex-dev/stripe
 * 2. Configure in convex.config.ts
 * 3. Pass stripe component to constructor
 */
export class StripePaymentService implements IPaymentService {
  constructor(private ctx: MutationCtx) {}

  async createCheckoutSession(userId: string, priceId: string) {
    // In production with @convex-dev/stripe:
    // const url = await stripe.subscribe(ctx, {
    //   userId,
    //   priceId,
    //   successUrl: `${process.env.SITE_URL}/success`,
    //   cancelUrl: `${process.env.SITE_URL}/cancel`,
    // })
    
    console.log(`[PAYMENT] Create checkout for user ${userId}, price ${priceId}`)
    return { url: '/checkout-placeholder' }
  }

  async createCustomerPortal(userId: string) {
    // In production:
    // const url = await stripe.portal(ctx, { userId })
    
    console.log(`[PAYMENT] Create portal for user ${userId}`)
    return { url: '/portal-placeholder' }
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    // In production:
    // const subscription = await ctx.db
    //   .query('subscriptions')
    //   .filter((q) => q.eq(q.field('userId'), userId))
    //   .first()
    // return subscription?.status === 'active'
    
    return false
  }
}

/**
 * Mock Payment Service for Testing
 */
export class MockPaymentService implements IPaymentService {
  public checkouts: Array<{ userId: string; priceId: string }> = []
  public activeSubscriptions = new Set<string>()

  async createCheckoutSession(userId: string, priceId: string) {
    this.checkouts.push({ userId, priceId })
    return { url: `https://checkout.test/${userId}` }
  }

  async createCustomerPortal(userId: string) {
    return { url: `https://portal.test/${userId}` }
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    return this.activeSubscriptions.has(userId)
  }

  setActiveSubscription(userId: string, active: boolean) {
    if (active) {
      this.activeSubscriptions.add(userId)
    } else {
      this.activeSubscriptions.delete(userId)
    }
  }
}

/**
 * Service Factory
 * Create service instances based on environment
 */
export class ServiceFactory {
  constructor(private ctx: MutationCtx) {}

  /** Get appropriate email service based on environment */
  getEmailService(): IEmailService {
    const isDevelopment = process.env.NODE_ENV === 'development'
    return isDevelopment ? new MockEmailService() : new EmailService(this.ctx)
  }

  /** Get appropriate payment service based on environment */
  getPaymentService(): IPaymentService {
    const isDevelopment = process.env.NODE_ENV === 'development'
    return isDevelopment ? new MockPaymentService() : new StripePaymentService(this.ctx)
  }
}
