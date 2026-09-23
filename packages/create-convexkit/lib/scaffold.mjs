import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { format, resolveConfig } from 'prettier'

const REPOSITORY =
  'https://github.com/joealmond/convex-tanstack-better-auth-cloudflare-terraform.git'
const ALL_EXAMPLES = ['chat', 'files', 'admin', 'forms', 'todos', 'ai', 'billing', 'email']
const VALID_AUTH = ['better-auth', 'clerk']
const VALID_DEPLOY = ['cloudflare', 'vercel', 'netlify']
const VALID_PRESETS = ['personal', 'team-saas']
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cliVersion = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version
const defaultTemplateRef = `create-convexkit-v${cliVersion}`

const featureFiles = {
  chat: [
    'src/routes/examples.chat.tsx',
    'src/components/examples/RealtimeChatExample.tsx',
    'convex/messages.ts',
    'convex/messages.test.ts',
    'convex/messages.mutations.test.ts',
  ],
  files: [
    'src/routes/examples.files.tsx',
    'src/routes/_authenticated/files.tsx',
    'src/components/examples/FileUploadsExample.tsx',
    'convex/files.ts',
    'convex/files.test.ts',
  ],
  admin: [
    'src/routes/examples.admin.tsx',
    'src/routes/_authenticated/dashboard.tsx',
    'src/components/examples/AdminRbacExample.tsx',
  ],
  forms: ['src/routes/examples.forms.tsx', 'src/components/ExampleForm.tsx'],
  todos: [
    'src/routes/examples.todos.tsx',
    'src/components/examples/TodosExample.tsx',
    'src/components/examples/TodosExample.test.tsx',
    'convex/todos.ts',
    'convex/todos.test.ts',
  ],
  ai: [
    'src/routes/examples.ai.tsx',
    'src/components/examples/AiStreamingExample.tsx',
    'convex/ai.ts',
  ],
  billing: [
    'src/routes/examples.billing.tsx',
    'src/components/examples/BillingExample.tsx',
    'convex/billing.ts',
    'convex/stripe.ts',
  ],
  email: [
    'src/routes/examples.email.tsx',
    'src/components/examples/EmailExample.tsx',
    'convex/emails.ts',
    'convex/emailActions.ts',
  ],
}

const exportKindsByFeature = {
  chat: ['messages'],
  files: ['files', 'uploadIntents', 'fileUsage'],
  todos: ['todos'],
  ai: ['aiRuns'],
  email: ['emailDeliveries'],
  billing: ['billingSubscriptions'],
}

function usage() {
  return `create-convexkit

Usage:
  npm create convexkit@latest my-app
  npm create convexkit@latest my-app -- --yes --examples chat,todos,forms

Options:
  --auth <better-auth|clerk>       Authentication provider (default: better-auth)
  --deploy <cloudflare|vercel|netlify>  Deployment target (default: cloudflare)
  --preset <personal|team-saas>    App foundation (default: personal)
  --examples <all|none|csv>        Feature examples (default: none)
  --terraform, --no-terraform      Include Terraform (default: no)
  --install, --no-install          Install dependencies (default: install)
  --template-dir <path>            Use a local template checkout (testing/contributing)
  --template-ref <ref>             Git branch or tag (default: ${defaultTemplateRef})
  --yes, -y                        Accept defaults without prompts
  --help, -h                       Show this help
`
}

function parseArgs(argv) {
  const result = { install: true, terraform: false, yes: false, templateRef: defaultTemplateRef }
  const positional = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('-')) {
      positional.push(arg)
      continue
    }
    if (arg === '--help' || arg === '-h') result.help = true
    else if (arg === '--yes' || arg === '-y') result.yes = true
    else if (arg === '--terraform') result.terraform = true
    else if (arg === '--no-terraform') result.terraform = false
    else if (arg === '--install') result.install = true
    else if (arg === '--no-install') result.install = false
    else if (
      ['--auth', '--deploy', '--preset', '--examples', '--template-dir', '--template-ref'].includes(
        arg
      )
    ) {
      const value = argv[++index]
      if (!value || value.startsWith('-')) throw new Error(`${arg} requires a value`)
      result[arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value
    } else throw new Error(`Unknown option: ${arg}`)
  }
  result.project = positional[0]
  if (positional.length > 1) throw new Error('Only one project directory may be provided')
  return result
}

function parseExamples(value) {
  if (!value || value === 'all') return [...ALL_EXAMPLES]
  if (value === 'none') return []
  const examples = [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ]
  const invalid = examples.filter((item) => !ALL_EXAMPLES.includes(item))
  if (invalid.length) throw new Error(`Unknown examples: ${invalid.join(', ')}`)
  return examples
}

async function collectOptions(parsed) {
  if (parsed.help) return parsed
  const rl = readline.createInterface({ input: stdin, output: stdout })
  const ask = async (label, fallback) => {
    if (parsed.yes) return fallback
    const answer = (await rl.question(`${label} (${fallback}): `)).trim()
    return answer || fallback
  }
  try {
    parsed.project ||= await ask('Project directory', 'my-convexkit-app')
    parsed.auth ||= await ask('Auth: better-auth or clerk', 'better-auth')
    parsed.deploy ||= await ask('Deploy: cloudflare, vercel, or netlify', 'cloudflare')
    parsed.preset ||= await ask('Preset: personal or team-saas', 'personal')
    parsed.examples ||= await ask(
      `Examples: all, none, or CSV [${ALL_EXAMPLES.join(', ')}]`,
      'none'
    )
    if (!parsed.yes) {
      const answer = (await rl.question('Include Terraform? [y/N]: ')).trim().toLowerCase()
      parsed.terraform = answer === 'y' || answer === 'yes'
    }
  } finally {
    rl.close()
  }
  return parsed
}

function validateOptions(options) {
  if (!VALID_AUTH.includes(options.auth)) throw new Error(`Invalid auth provider: ${options.auth}`)
  if (!VALID_DEPLOY.includes(options.deploy))
    throw new Error(`Invalid deploy target: ${options.deploy}`)
  options.preset ||= 'personal'
  if (!VALID_PRESETS.includes(options.preset)) throw new Error(`Invalid preset: ${options.preset}`)
  options.selectedExamples = parseExamples(options.examples || 'none')
  if (options.preset === 'team-saas' && options.auth !== 'better-auth')
    throw new Error('team-saas currently requires Better Auth')
  if (options.preset === 'team-saas' && options.selectedExamples.length)
    throw new Error('team-saas currently requires --examples none')
  options.target = resolve(options.project)
  if (options.target === resolve('.')) throw new Error('Choose a new project directory')
  if (existsSync(options.target) && readdirSync(options.target).length > 0) {
    throw new Error(`Target directory is not empty: ${options.target}`)
  }
}

function renderProjectReadme(options) {
  const appName = basename(options.target)
  const previewWorker = `${workerBaseName(options.target)}-preview`
  const preset = options.preset === 'team-saas' ? 'Team SaaS' : 'Personal app'
  const examples = options.selectedExamples.length ? options.selectedExamples.join(', ') : 'none'
  const deploy =
    options.deploy === 'cloudflare'
      ? `\n## Preview deployment\n\nAfter logging in to Convex and Cloudflare, run \`npm run infra:bootstrap -- --worker-name ${previewWorker} --app-url https://YOUR-PREVIEW-ORIGIN\`, then \`npm run deploy:preview\`. Use your exact Workers or Custom Domain URL for \`--app-url\`. Add GitHub secrets \`CLOUDFLARE_API_TOKEN\`, \`CLOUDFLARE_ACCOUNT_ID\`, \`VITE_CONVEX_URL_PREVIEW\`, \`VITE_CONVEX_SITE_URL_PREVIEW\`, and \`CONVEX_DEPLOY_KEY_PREVIEW\`. Set repository variables \`CLOUDFLARE_WORKER_NAME_PREVIEW=${previewWorker}\` and \`APP_URL_PREVIEW\` to that URL, then set \`AUTO_DEPLOY_ENABLED=true\`. Production uses matching \`_PROD\` values, \`CONVEX_DEPLOY_KEY_PROD\`, \`CLOUDFLARE_WORKER_NAME_PROD=${workerBaseName(options.target)}-production\`, and \`APP_URL_PROD\`.${options.auth === 'clerk' ? ' For Clerk, also set `CLERK_SECRET_KEY` as a GitHub Environment Secret and `CLERK_PUBLISHABLE_KEY` plus `CLERK_JWT_ISSUER_DOMAIN` as environment variables for both preview and production.' : ''}\n`
      : '\n## Deployment\n\nAdd the values from `.env.example` in your hosting provider. Keep non-`VITE_` values server-side.\n'
  return `# ${appName}\n\n${preset} generated with ConvexKit.\n\n## Start\n\nnpm install\nnpm run setup\nnpm run dev\n\nSee [configuration](docs/CONFIGURATION.md) before inviting users.\n\n## Selected examples\n\n${examples}\n${deploy}`
}

function renderConfigurationGuide(options) {
  const auth =
    options.auth === 'clerk'
      ? 'Set `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `CLERK_JWT_ISSUER_DOMAIN` as described in [Clerk setup](CLERK_SETUP.md).'
      : 'Run `npm run setup`; it creates a local auth secret and can set backend values on Convex.'
  const team =
    options.preset === 'team-saas'
      ? '\n## Team SaaS\n\n`convex/organizations.ts` owns organization creation, membership roles, invitations, and organization-scoped authorization. The `/teams` page manages teams and invitations. Invitation acceptance requires a verified email; configure verification delivery for email/password accounts before production. `/account` exports the user’s account-linked data; define a separate organization export policy before adding product-owned tables. Add product tables with an `organizationId` and call `requireOrganizationRole` before reading or changing them.\n'
      : ''
  return `# Configuration\n\n## Local development\n\nCopy no secrets by hand: ${auth}\n\nRequired browser values: VITE_CONVEX_URL and VITE_CONVEX_SITE_URL. SITE_URL is a backend value and must equal the URL users open.\n\n## Production\n\nUse distinct Convex deployments and auth secrets for preview and production. Set SITE_URL on each Convex deployment to its public Worker or hosting URL. Never prefix a secret with VITE_. ${options.auth === 'better-auth' ? 'Configure [account verification and recovery email](AUTH_EMAIL.md) before production.' : 'Configure Clerk production keys and verified domains before production.'}\n${team}`
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`)
}

function workerBaseName(target) {
  const slug = basename(target)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return (slug && /^[a-z]/.test(slug) ? slug : `app-${slug}`).slice(0, 48).replace(/-+$/, '')
}

function configureWorkerNames(target) {
  const path = join(target, 'wrangler.jsonc')
  const base = workerBaseName(target)
  const source = readFileSync(path, 'utf8')
  writeFileSync(
    path,
    source
      .replace('"name": "convexkit"', `"name": "${base}"`)
      .replace('"name": "convexkit-preview"', `"name": "${base}-preview"`)
      .replace('"name": "convexkit-production"', `"name": "${base}-production"`)
  )
}

// Local template copies must never carry credentials, deployment state or caches.
function isTemplatePath(source, path) {
  if (path === source) return true
  const name = basename(path)
  if (
    [
      '.git',
      '.agent',
      '.agents',
      '.codex',
      '.convex',
      '.wrangler',
      '.terraform',
      '.tanstack',
      '.output',
      '.netlify',
      '.vercel',
      'node_modules',
      'dist',
      'cache',
      'coverage',
      'output',
      'playwright-report',
      'test-results',
      '.DS_Store',
    ].includes(name)
  )
    return false
  if ((name.startsWith('.env') && name !== '.env.example') || name.startsWith('.dev.vars'))
    return false
  return !/\.tfstate(?:\.|$)|\.tfvars$|\.log$|\.tgz$/.test(name)
}

function acquireTemplate(options) {
  mkdirSync(dirname(options.target), { recursive: true })
  if (options.templateDir) {
    const source = resolve(options.templateDir)
    if (!existsSync(join(source, 'package.json')))
      throw new Error('Invalid local template directory')
    mkdirSync(options.target, { recursive: true })
    cpSync(source, options.target, {
      recursive: true,
      filter: (path) => isTemplatePath(source, path),
    })
    return
  }
  runCommand('git', [
    'clone',
    '--depth',
    '1',
    '--branch',
    options.templateRef,
    REPOSITORY,
    options.target,
  ])
}

function remove(target, paths) {
  for (const path of paths) rmSync(join(target, path), { recursive: true, force: true })
}

function replaceFeatureBlock(path, feature) {
  if (!existsSync(path)) return
  const source = readFileSync(path, 'utf8')
  const pattern = new RegExp(
    `^[\\t ]*// <convexkit:${escapeRegExp(feature)}>\\n[\\s\\S]*?^[\\t ]*// </convexkit:${escapeRegExp(feature)}>\\n?`,
    'gm'
  )
  const jsxPattern = new RegExp(
    `^[\\t ]*\\{/\\* <convexkit:${escapeRegExp(feature)}> \\*/\\}\\n[\\s\\S]*?^[\\t ]*\\{/\\* </convexkit:${escapeRegExp(feature)}> \\*/\\}\\n?`,
    'gm'
  )
  writeFileSync(path, source.replace(pattern, '').replace(jsxPattern, ''))
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function pruneGeneratedApi(target, feature) {
  const path = join(target, 'convex/_generated/api.d.ts')
  if (!existsSync(path)) return
  const modules =
    feature === 'billing'
      ? ['billing', 'stripe']
      : feature === 'email'
        ? ['emailActions', 'emails']
        : [feature === 'chat' ? 'messages' : feature]
  let source = readFileSync(path, 'utf8')
  for (const module of modules) {
    source = source
      .replace(new RegExp(`import type \\* as ${module} from [^;]+;\\n`), '')
      .replace(new RegExp(`  ${module}: typeof ${module};\\n`), '')
  }
  writeFileSync(path, source)
}

const cards = {
  chat: ['Realtime Chat', 'Public realtime messages with rate limits.', '/examples/chat'],
  files: ['File Uploads', 'Convex storage with owner-only deletion.', '/examples/files'],
  admin: ['Admin / RBAC', 'Protected routes and role-aware controls.', '/examples/admin'],
  forms: ['Forms', 'React Hook Form with Zod validation.', '/examples/forms'],
  todos: ['Todos', 'Optimistic updates, pagination, and TanStack Table.', '/examples/todos'],
  ai: ['AI Streaming', 'Realtime persisted LLM output.', '/examples/ai'],
  billing: ['Stripe Billing', 'Checkout, portal, and idempotent webhooks.', '/examples/billing'],
  email: ['Transactional Email', 'Queued Resend delivery with status.', '/examples/email'],
}

function renderExamplesIndex(selected) {
  if (!selected.length)
    return `import { createFileRoute, Link } from '@tanstack/react-router'
export const Route = createFileRoute('/examples/')({ component: ExamplesPage })
function ExamplesPage() {
  return <main className="container mx-auto px-4 py-10"><h1 className="text-3xl font-bold">Feature Examples</h1><p className="my-4">No examples selected. Your application is ready for your own features.</p><Link to="/">Back home</Link></main>
}
`
  const data = selected.map((key) => cards[key])
  return `import { createFileRoute, Link } from '@tanstack/react-router'\n\nexport const Route = createFileRoute('/examples/')({ component: ExamplesPage })\n\nconst examples = ${JSON.stringify(data, null, 2)} as const\n\nfunction ExamplesPage() {\n  return (\n    <main className="container mx-auto min-h-screen px-4 py-10">\n      <div className="flex items-center justify-between gap-4">\n        <div><p className="text-sm text-muted-foreground">ConvexKit</p><h1 className="text-3xl font-bold">Feature Examples</h1></div>\n        <Link to="/" className="rounded-md bg-secondary px-4 py-2 text-sm font-medium">Back home</Link>\n      </div>\n      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">\n        {examples.map(([title, description, href]) => (\n          <Link key={title} to={href} className="rounded-lg border border-border bg-card p-5 shadow-sm hover:border-primary/60">\n            <h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{description}</p>\n          </Link>\n        ))}\n      </div>\n    </main>\n  )\n}\n`
}

function copyOverlay(name, target) {
  const source = join(packageRoot, 'templates', name)
  if (!existsSync(source)) throw new Error(`Missing generator overlay: ${name}`)
  cpSync(source, target, { recursive: true, force: true })
}

function configurePackage(target, options) {
  const path = join(target, 'package.json')
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  pkg.name = basename(target)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
  pkg.version = '0.1.0'
  pkg.private = true
  pkg.convexkit = {
    auth: options.auth,
    deploy: options.deploy,
    examples: options.selectedExamples,
    terraform: options.terraform,
    preset: options.preset,
    cliVersion,
    templateRef: options.templateDir ? 'local' : options.templateRef,
  }
  delete pkg.scripts['test:cli']
  delete pkg.scripts['test:scaffold']
  delete pkg.scripts['test:e2e:local-auth']
  delete pkg.scripts['test:setup']
  delete pkg.scripts['test:guardrails']
  delete pkg.scripts['docs:dev']
  delete pkg.scripts['docs:build']
  delete pkg.scripts['docs:preview']
  delete pkg.devDependencies.vitepress
  for (const [feature, dependencies] of Object.entries({
    billing: ['stripe'],
    email: ['resend'],
    todos: ['@tanstack/react-table'],
    forms: ['@hookform/resolvers', 'react-hook-form'],
  })) {
    if (!options.selectedExamples.includes(feature))
      for (const name of dependencies) delete pkg.dependencies[name]
  }
  pkg.scripts.check = [
    'npm run format:check',
    'npm run lint -- --max-warnings=0',
    'npm run test',
    ...(options.deploy === 'cloudflare' ? ['npm run test:infra'] : []),
    'npm run check:convex-imports',
    'npm run typecheck',
    'npm run build',
  ].join(' && ')
  // The generated dependency graph differs from the repository template.
  // npm install updates the retained lockfile using exact direct versions.

  if (options.auth === 'clerk') {
    delete pkg.dependencies['better-auth']
    delete pkg.dependencies['@convex-dev/better-auth']
    pkg.dependencies['@clerk/tanstack-react-start'] = '1.5.12'
  }
  if (options.deploy !== 'cloudflare') {
    delete pkg.dependencies['@cloudflare/vite-plugin']
    delete pkg.devDependencies.wrangler
    delete pkg.scripts['cf-typegen']
    delete pkg.scripts['sync:wrangler-config']
    delete pkg.scripts['deploy:preview']
    delete pkg.scripts['deploy:prod']
    delete pkg.scripts['infra:bootstrap']
    delete pkg.scripts['preflight:deploy']
    delete pkg.scripts['smoke:preview']
    delete pkg.scripts['release:record']
    delete pkg.scripts['test:infra']
    const buildOutput = options.deploy === 'vercel' ? '.vercel/output' : 'dist'
    pkg.scripts.build = `vite build && node scripts/sanitize-build-output.mjs ${buildOutput}`
    pkg.scripts['build:preview'] =
      `vite build --mode preview && node scripts/sanitize-build-output.mjs ${buildOutput}`
    pkg.scripts['build:prod'] =
      `vite build --mode production && node scripts/sanitize-build-output.mjs ${buildOutput}`
    pkg.scripts.preview = 'vite preview'
  }
  if (options.deploy === 'vercel') {
    pkg.dependencies.nitro = '3.0.260903-beta'
    pkg.scripts.deploy = 'npm run build && npx vercel --prod'
  }
  if (options.deploy === 'netlify') {
    pkg.dependencies.nitro = '3.0.260903-beta'
    pkg.scripts.deploy = 'npm run build && npx netlify deploy --prod'
  }
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
}

function configureClerkGeneratedApi(target) {
  const path = join(target, 'convex/_generated/api.d.ts')
  if (!existsSync(path)) return
  const source = readFileSync(path, 'utf8')
    .replace(/import type \* as auth from [^;]+;\n/, '')
    .replace(/import type \* as authEmails from [^;]+;\n/, '')
    .replace(/ {2}auth: typeof auth;\n/, '')
    .replace(/ {2}authEmails: typeof authEmails;\n/, '')
    .replace(/ {2}betterAuth: import\([^\n]+\n/, '')
  writeFileSync(path, source)
}

function configureTeamGeneratedApi(target) {
  const path = join(target, 'convex/_generated/api.d.ts')
  const source = readFileSync(path, 'utf8')
    .replace(
      'import type * as users from "../users.js";',
      'import type * as organizations from "../organizations.js";\nimport type * as users from "../users.js";'
    )
    .replace(
      '  users: typeof users;',
      '  organizations: typeof organizations;\n  users: typeof users;'
    )
  writeFileSync(path, source)
}

function configureClerkEnv(target) {
  const path = join(target, '.env.example')
  if (!existsSync(path)) return
  const source = readFileSync(path, 'utf8')
  const replacement = `# --------------- Clerk Auth ---------------\n# Create an application at https://dashboard.clerk.com. These values are read by\n# Clerk's TanStack Start middleware; do not prefix the secret with VITE_.\nCLERK_PUBLISHABLE_KEY=pk_test_replace_me\nCLERK_SECRET_KEY=sk_test_replace_me\nCLERK_JWT_ISSUER_DOMAIN=https://your-clerk-domain.clerk.accounts.dev\n\n`
  writeFileSync(
    path,
    source.replace(
      /# --------------- Better Auth ---------------[\s\S]*?(?=# --------------- Cloudflare)/,
      replacement
    )
  )
}

function renderMaintenance(selected) {
  const files = selected.includes('files')
  const chat = selected.includes('chat')
  const expiryWork = [
    files
      ? `    const intents = await ctx.db.query('uploadIntents').withIndex('by_expiry', (query) => query.lt('expiresAt', now)).take(BATCH_SIZE)\n    for (const intent of intents) await ctx.db.delete(intent._id)`
      : '    const intents: Array<never> = []',
    chat
      ? `    const oldestMessages = await ctx.db.query('messages').order('asc').take(BATCH_SIZE)\n    const expiredMessages = oldestMessages.filter((message) => message._creationTime < now - MESSAGE_RETENTION_MS)\n    for (const message of expiredMessages) await ctx.db.delete(message._id)`
      : '    const expiredMessages: Array<never> = []',
  ].join('\n\n')
  const userWork = [
    files
      ? `    const files = await ctx.db.query('files').withIndex('by_uploader', (query) => query.eq('uploadedBy', userId)).take(BATCH_SIZE)\n    for (const file of files) { await ctx.storage.delete(file.storageId); await ctx.db.delete(file._id) }\n    const intents = await ctx.db.query('uploadIntents').withIndex('by_user', (query) => query.eq('userId', userId)).take(BATCH_SIZE)\n    for (const intent of intents) await ctx.db.delete(intent._id)\n    const usage = await ctx.db.query('fileUsage').withIndex('by_user', (query) => query.eq('userId', userId)).unique()\n    if (usage) await ctx.db.delete(usage._id)`
      : '    const files: Array<never> = []\n    const intents: Array<never> = []',
    chat
      ? `    const messages = await ctx.db.query('messages').withIndex('by_author', (query) => query.eq('authorId', userId)).take(BATCH_SIZE)\n    for (const message of messages) await ctx.db.delete(message._id)`
      : '    const messages: Array<never> = []',
    ...['todos', 'aiRuns', 'emailDeliveries', 'billingSubscriptions'].map((table) => {
      const feature =
        table === 'aiRuns'
          ? 'ai'
          : table === 'emailDeliveries'
            ? 'email'
            : table === 'billingSubscriptions'
              ? 'billing'
              : 'todos'
      return selected.includes(feature)
        ? `    const ${table} = await ctx.db.query('${table}').withIndex('by_owner', (query) => query.eq('ownerId', userId)).take(BATCH_SIZE)\n    for (const item of ${table}) await ctx.db.delete(item._id)`
        : `    const ${table}: Array<never> = []`
    }),
  ].join('\n\n')
  const retentionConstant = chat ? 'const MESSAGE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000\n' : ''
  const now = files || chat ? '    const now = Date.now()\n' : ''
  return `import { v } from 'convex/values'\nimport { internal } from './_generated/api'\nimport { internalMutation } from './_generated/server'\n\n${retentionConstant}const BATCH_SIZE = 100\n\nexport const deleteExpiredData = internalMutation({\n  args: {},\n  handler: async (ctx) => {\n${now}${expiryWork}\n    if (intents.length === BATCH_SIZE || expiredMessages.length === BATCH_SIZE) await ctx.scheduler.runAfter(0, internal.maintenance.deleteExpiredData)\n  },\n})\n\nexport const deleteUserDataBatch = internalMutation({\n  args: { userId: v.string(), email: v.optional(v.string()) },\n  handler: async (ctx, { userId }) => {\n${userWork}\n    if ([files, messages, intents, todos, aiRuns, emailDeliveries, billingSubscriptions].some((items) => items.length === BATCH_SIZE)) await ctx.scheduler.runAfter(0, internal.maintenance.deleteUserDataBatch, { userId })\n  },\n})\n`
}

function compose(options) {
  remove(options.target, [
    '.git',
    'packages/create-convexkit',
    'coverage',
    'output',
    '.github',
    'AGENTS.md',
    'CHANGELOG.md',
    'CODE_OF_CONDUCT.md',
    'CONTRIBUTING.md',
    'ROADMAP.md',
    'SECURITY.md',
    '.release-please-manifest.json',
    'release-please-config.json',
    'docs/.vitepress',
    'docs/assets',
    'docs/index.md',
    'docs/README.md',
    'scripts/validate-scaffold.mjs',
    'scripts/validate-local-auth.mjs',
    'scripts/setup.node-test.mjs',
    'scripts/sanitize-build-output.test.mjs',
    'scripts/check-convex-runtime-imports.test.mjs',
  ])
  if (!options.terraform || options.deploy !== 'cloudflare')
    remove(options.target, ['infrastructure'])

  if (options.auth === 'clerk') {
    copyOverlay('clerk', options.target)
    remove(options.target, [
      'src/lib/auth-client.ts',
      'src/components/AuthControls.test.tsx',
      'src/lib/auth-server.ts',
      'src/routes/reset-password.tsx',
      'src/routes/api/auth',
      'convex/auth.ts',
      'convex/auth.config.test.ts',
      'convex/auth-flow.test.ts',
      'convex/authEmails.ts',
      'convex/authEmails.test.ts',
      'convex/userExport.test.ts',
      'docs/AUTH_EMAIL.md',
      'convex/test.utils.ts',
      'convex/lib/customFunctions.test.ts',
      'convex/files.test.ts',
      'convex/integrations.test.ts',
      'convex/maintenance.test.ts',
      'convex/messages.test.ts',
      'convex/messages.mutations.test.ts',
      'convex/seed.test.ts',
      'convex/todos.test.ts',
      'convex/users.test.ts',
    ])
    configureClerkGeneratedApi(options.target)
    configureClerkEnv(options.target)
  }

  for (const feature of ALL_EXAMPLES) {
    if (options.selectedExamples.includes(feature)) continue
    remove(options.target, featureFiles[feature])
    replaceFeatureBlock(join(options.target, 'convex/schema.ts'), feature)
    replaceFeatureBlock(join(options.target, 'convex/auth.ts'), feature)
    replaceFeatureBlock(join(options.target, 'convex/http.ts'), feature)
    replaceFeatureBlock(join(options.target, 'convex/userExport.ts'), feature)
    replaceFeatureBlock(
      join(options.target, 'src/components/examples/RealtimeChatExample.tsx'),
      feature
    )
    pruneGeneratedApi(options.target, feature)
  }
  if (
    !['chat', 'files', 'todos', 'ai', 'billing', 'email'].some((feature) =>
      options.selectedExamples.includes(feature)
    )
  ) {
    writeFileSync(
      join(options.target, 'convex/schema.ts'),
      "import { defineSchema } from 'convex/server'\n\nexport default defineSchema({})\n"
    )
    const exportPath = join(options.target, 'convex/userExport.ts')
    writeFileSync(
      exportPath,
      readFileSync(exportPath, 'utf8')
        .replace('const PAGE_SIZE = 100\n\n', '')
        .replace('handler: async (ctx, { kind, cursor })', 'handler: async (ctx, { kind })')
        .replace('    const paginationOpts = { cursor: cursor ?? null, numItems: PAGE_SIZE }\n', '')
    )
  }
  if (!options.selectedExamples.includes('chat')) {
    remove(options.target, ['convex/seed.ts', 'convex/seed.test.ts'])
    pruneGeneratedApi(options.target, 'seed')
  }
  if (
    !['chat', 'files', 'todos', 'ai', 'billing', 'email'].every((feature) =>
      options.selectedExamples.includes(feature)
    )
  ) {
    remove(options.target, ['convex/maintenance.test.ts', 'convex/userExport.test.ts'])
  }
  if (!options.selectedExamples.includes('chat')) remove(options.target, ['convex/users.test.ts'])
  if (!['ai', 'billing', 'email'].every((feature) => options.selectedExamples.includes(feature))) {
    remove(options.target, ['convex/integrations.test.ts'])
  }
  writeFileSync(
    join(options.target, 'convex/maintenance.ts'),
    renderMaintenance(options.selectedExamples)
  )
  if (!options.selectedExamples.includes('chat')) copyOverlay('no-chat', options.target)
  if (options.preset === 'team-saas') {
    copyOverlay('team-saas', options.target)
    configureTeamGeneratedApi(options.target)
  }
  const exportKinds =
    options.preset === 'team-saas'
      ? [
          'account',
          'organizations',
          'organizationMembers',
          'organizationInvitations',
          'sentInvitations',
          'organizationAuditEvents',
        ]
      : [
          'account',
          ...options.selectedExamples.flatMap((feature) => exportKindsByFeature[feature] || []),
        ]
  writeFileSync(
    join(options.target, 'src/lib/export-kinds.ts'),
    `export const exportKinds = ${JSON.stringify(exportKinds)} as const\n`
  )
  writeFileSync(
    join(options.target, 'src/routes/examples.index.tsx'),
    renderExamplesIndex(options.selectedExamples)
  )

  if (options.deploy !== 'cloudflare') {
    remove(options.target, [
      'wrangler.jsonc',
      'worker-configuration.d.ts',
      '.github/workflows/deploy.yml',
      'scripts/infra-bootstrap.mjs',
      'scripts/deploy-preflight.mjs',
      'scripts/deploy-preview.mjs',
      'scripts/deploy-production.mjs',
      'scripts/deploy.sh',
      'scripts/infra-utils.mjs',
      'scripts/infra-utils.node-test.mjs',
      'scripts/smoke-preview.mjs',
      'scripts/write-release-record.mjs',
      'scripts/generate-wrangler-config.mjs',
    ])
    copyOverlay(options.deploy, options.target)
  } else configureWorkerNames(options.target)
  configurePackage(options.target, options)
  configureGeneratedChecks(options)
  writeFileSync(join(options.target, 'README.md'), renderProjectReadme(options))
  writeFileSync(join(options.target, 'docs/CONFIGURATION.md'), renderConfigurationGuide(options))
  writeFileSync(
    join(options.target, 'docs/README.md'),
    `# ${basename(options.target)} documentation\n\n- [Configuration](CONFIGURATION.md)\n${options.auth === 'better-auth' ? '- [Account email](AUTH_EMAIL.md)\n' : ''}- [Deployment](${options.deploy === 'cloudflare' ? 'PRODUCTION_DEPLOYMENT_CHECKLIST.md' : options.deploy === 'vercel' ? 'VERCEL_SETUP.md' : 'NETLIFY_SETUP.md'})\n- [Project accelerators](PROJECT_ACCELERATORS.md)\n`
  )
  writeFileSync(
    join(options.target, '.convexkit.json'),
    `${JSON.stringify({ version: 1, preset: options.preset, auth: options.auth, deploy: options.deploy, examples: options.selectedExamples, terraform: options.terraform, cliVersion, templateRef: options.templateDir ? 'local' : options.templateRef }, null, 2)}\n`
  )
}

function configureGeneratedChecks(options) {
  const workflowDir = join(options.target, '.github/workflows')
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(
    join(workflowDir, 'ci.yml'),
    `name: CI
on: [push, pull_request]
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    env:
      VITE_CONVEX_URL: https://example.convex.cloud
      VITE_CONVEX_SITE_URL: https://example.convex.site
      VITE_APP_ENV: preview
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: '24'
          cache: npm
      - run: npm ci
      - run: npm run generate:routes
      - run: npm run check
      - run: npm audit --audit-level=low
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e:public
`
  )
  // Keep the deployment workflow only for the target it actually supports.
  if (options.deploy === 'cloudflare') {
    // The original workflow is saved before repository-only workflows are removed.
    if (options.deployWorkflow)
      writeFileSync(join(workflowDir, 'deploy.yml'), options.deployWorkflow)
  }
  // Browser smoke tests must only reference routes selected by the caller.
  const smoke = `import { expect, test } from '@playwright/test'

test('generated application renders its example catalog', async ({ page }) => {
  await page.goto('/examples')
  await expect(page.getByRole('heading', { name: 'Feature Examples' })).toBeVisible()
${options.selectedExamples.map((feature) => `  await expect(page.getByRole('heading', { name: ${JSON.stringify(cards[feature][0])}, exact: true })).toBeVisible()`).join('\n')}
})
`
  writeFileSync(join(options.target, 'e2e/public-smoke.spec.ts'), smoke)
  if (
    options.auth !== 'better-auth' ||
    !['chat', 'files'].every((f) => options.selectedExamples.includes(f))
  ) {
    remove(options.target, ['e2e/authenticated-flow.spec.ts'])
    const path = join(options.target, 'package.json')
    const pkg = JSON.parse(readFileSync(path, 'utf8'))
    delete pkg.scripts['test:e2e:auth']
    const deployPath = join(workflowDir, 'deploy.yml')
    if (existsSync(deployPath)) {
      const deployWorkflow = readFileSync(deployPath, 'utf8').replace(
        / {6}- name: Install Playwright Chromium[\s\S]*?(?= {6}- name: Deployment summary)/,
        ''
      )
      writeFileSync(deployPath, deployWorkflow)
    }
    writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n')
  }
}

async function formatGeneratedFiles(target) {
  for (const relative of [
    'convex/schema.ts',
    'convex/auth.ts',
    'convex/http.ts',
    'convex/maintenance.ts',
    'convex/userExport.ts',
    'src/components/examples/RealtimeChatExample.tsx',
    'src/routes/examples.index.tsx',
    'src/lib/export-kinds.ts',
    'e2e/public-smoke.spec.ts',
    '.convexkit.json',
  ]) {
    const path = join(target, relative)
    if (!existsSync(path)) continue
    const config = (await resolveConfig(path)) || {}
    writeFileSync(path, await format(readFileSync(path, 'utf8'), { ...config, filepath: path }))
  }
}

export async function run(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv)
  if (parsed.help) {
    console.log(usage())
    return
  }
  const options = await collectOptions(parsed)
  validateOptions(options)

  console.log(`\nCreating ConvexKit app in ${options.target}`)
  acquireTemplate(options)
  const workflow = join(options.target, '.github/workflows/deploy.yml')
  if (existsSync(workflow)) options.deployWorkflow = readFileSync(workflow, 'utf8')
  compose(options)
  await formatGeneratedFiles(options.target)

  if (options.install) {
    runCommand('npm', ['install'], options.target)
    runCommand('npm', ['run', 'generate:routes'], options.target)
  }

  console.log('\nConvexKit is ready.')
  console.log(`  cd ${options.project}`)
  if (!options.install) console.log('  npm install && npm run generate:routes')
  console.log('  npm run setup')
  console.log('  npm run dev')
}
