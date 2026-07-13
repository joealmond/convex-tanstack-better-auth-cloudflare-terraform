import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'ConvexKit',
  description: 'Production-ready TanStack Start + Convex application scaffolder',
  base: process.env.DOCS_BASE ?? '/',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: [/^http:\/\/localhost/],
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/README' },
      { text: 'Examples', link: '/EXAMPLES' },
      { text: 'Deploy', link: '/PRODUCTION_DEPLOYMENT_CHECKLIST' },
      {
        text: 'GitHub',
        link: 'https://github.com/joealmond/convex-tanstack-better-auth-cloudflare-terraform',
      },
    ],
    sidebar: [
      {
        text: 'Get started',
        items: [
          { text: 'Overview', link: '/README' },
          { text: 'Architecture', link: '/ARCHITECTURE' },
          { text: 'Examples', link: '/EXAMPLES' },
          { text: 'Troubleshooting', link: '/TROUBLESHOOTING' },
        ],
      },
      {
        text: 'Build',
        items: [
          { text: 'Authentication', link: '/AUTH_SOLUTION' },
          { text: 'RBAC', link: '/RBAC' },
          { text: 'File uploads', link: '/FILE_UPLOADS' },
          { text: 'AI integration', link: '/AI_INTEGRATION' },
          { text: 'Stripe', link: '/STRIPE_PAYMENTS' },
          { text: 'Email', link: '/EMAIL_WITH_RESEND' },
        ],
      },
      {
        text: 'Operate',
        items: [
          { text: 'Preview checklist', link: '/PUBLIC_PREVIEW_CHECKLIST' },
          { text: 'Production checklist', link: '/PRODUCTION_DEPLOYMENT_CHECKLIST' },
          { text: 'Operations', link: '/OPERATIONS' },
          { text: 'CI/CD', link: '/CI_CD_OPTIONS' },
        ],
      },
    ],
    search: { provider: 'local' },
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/joealmond/convex-tanstack-better-auth-cloudflare-terraform',
      },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 ConvexKit contributors',
    },
  },
})
