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

const REPOSITORY =
  'https://github.com/joealmond/convex-tanstack-better-auth-cloudflare-terraform.git'
const ALL_EXAMPLES = ['chat', 'files', 'admin', 'forms', 'todos', 'ai', 'billing', 'email']
const VALID_AUTH = ['better-auth', 'clerk']
const VALID_DEPLOY = ['cloudflare', 'vercel', 'netlify']
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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

function usage() {
  return `create-convexkit

Usage:
  npm create convexkit@latest my-app
  npm create convexkit@latest my-app -- --yes --examples chat,todos,forms

Options:
  --auth <better-auth|clerk>       Authentication provider (default: better-auth)
  --deploy <cloudflare|vercel|netlify>  Deployment target (default: cloudflare)
  --examples <all|none|csv>        Feature examples (default: all)
  --terraform, --no-terraform      Include Terraform (default: no)
  --install, --no-install          Install dependencies (default: install)
  --template-dir <path>            Use a local template checkout (testing/contributing)
  --template-ref <ref>             Git branch or tag (default: main)
  --yes, -y                        Accept defaults without prompts
  --help, -h                       Show this help
`
}

function parseArgs(argv) {
  const result = { install: true, terraform: false, yes: false, templateRef: 'main' }
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
      ['--auth', '--deploy', '--examples', '--template-dir', '--template-ref'].includes(arg)
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
    parsed.examples ||= await ask(`Examples: all, none, or CSV [${ALL_EXAMPLES.join(', ')}]`, 'all')
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
  options.selectedExamples = parseExamples(options.examples)
  options.target = resolve(options.project)
  if (options.target === resolve('.')) throw new Error('Choose a new project directory')
  if (existsSync(options.target) && readdirSync(options.target).length > 0) {
    throw new Error(`Target directory is not empty: ${options.target}`)
  }
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`)
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
      filter: (path) =>
        !['.git', '.env.local', 'node_modules', 'coverage', 'output', 'playwright-report'].includes(
          basename(path)
        ),
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
  writeFileSync(path, source.replace(pattern, ''))
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
  }
  pkg.scripts['test:cli'] = undefined

  if (options.auth === 'clerk') {
    delete pkg.dependencies['better-auth']
    delete pkg.dependencies['@convex-dev/better-auth']
    pkg.dependencies['@clerk/tanstack-react-start'] = '^1.4.17'
  }
  if (options.deploy !== 'cloudflare') {
    delete pkg.dependencies['@cloudflare/vite-plugin']
    delete pkg.devDependencies.wrangler
    delete pkg.scripts['cf-typegen']
    delete pkg.scripts['sync:wrangler-config']
    delete pkg.scripts['deploy:preview']
    delete pkg.scripts['deploy:prod']
  }
  if (options.deploy === 'vercel') {
    pkg.dependencies.nitro = '3.0.260610-beta'
    pkg.scripts.deploy = 'npm run build && npx vercel --prod'
  }
  if (options.deploy === 'netlify') {
    pkg.devDependencies['@netlify/vite-plugin-tanstack-start'] = '1.3.16'
    // The current Netlify plugin transitively pins pre-fix OpenTelemetry and
    // esbuild releases. Keep these narrow until upstream dependency ranges move.
    pkg.overrides = {
      ...(pkg.overrides ?? {}),
      '@opentelemetry/core': '2.9.0',
      '@opentelemetry/resources': '2.9.0',
      '@opentelemetry/sdk-trace-base': '2.9.0',
      '@opentelemetry/sdk-trace-node': '2.9.0',
      '@netlify/edge-bundler': { esbuild: '0.28.1' },
      '@netlify/zip-it-and-ship-it': { esbuild: '0.28.1' },
    }
    pkg.scripts.deploy = 'npm run build && npx netlify deploy --prod'
  }
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
}

function configureClerkGeneratedApi(target) {
  const path = join(target, 'convex/_generated/api.d.ts')
  if (!existsSync(path)) return
  const source = readFileSync(path, 'utf8')
    .replace(/import type \* as auth from [^;]+;\n/, '')
    .replace(/ {2}auth: typeof auth;\n/, '')
    .replace(/ {2}betterAuth: import\([^\n]+\n/, '')
  writeFileSync(path, source)
}

function configureClerkEnv(target) {
  const path = join(target, '.env.example')
  if (!existsSync(path)) return
  const source = readFileSync(path, 'utf8')
  const replacement = `# --------------- Clerk Auth ---------------\n+# Create an application at https://dashboard.clerk.com. These values are read by\n+# Clerk's TanStack Start middleware; do not prefix the secret with VITE_.\n+CLERK_PUBLISHABLE_KEY=pk_test_replace_me\n+CLERK_SECRET_KEY=sk_test_replace_me\n+CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-domain.clerk.accounts.dev\n+\n+`
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
  ].join('\n\n')
  const retentionConstant = chat ? 'const MESSAGE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000\n' : ''
  const now = files || chat ? '    const now = Date.now()\n' : ''
  return `import { v } from 'convex/values'\nimport { internal } from './_generated/api'\nimport { internalMutation } from './_generated/server'\n\n${retentionConstant}const BATCH_SIZE = 100\n\nexport const deleteExpiredData = internalMutation({\n  args: {},\n  handler: async (ctx) => {\n${now}${expiryWork}\n    if (intents.length === BATCH_SIZE || expiredMessages.length === BATCH_SIZE) await ctx.scheduler.runAfter(0, internal.maintenance.deleteExpiredData)\n  },\n})\n\nexport const deleteUserDataBatch = internalMutation({\n  args: { userId: v.string() },\n  handler: async (ctx, { userId }) => {\n${userWork}\n    if (files.length === BATCH_SIZE || messages.length === BATCH_SIZE || intents.length === BATCH_SIZE) await ctx.scheduler.runAfter(0, internal.maintenance.deleteUserDataBatch, { userId })\n  },\n})\n`
}

function compose(options) {
  remove(options.target, ['.git', 'packages/create-convexkit', 'coverage', 'output'])
  if (!options.terraform || options.deploy !== 'cloudflare')
    remove(options.target, ['infrastructure'])

  if (options.auth === 'clerk') {
    copyOverlay('clerk', options.target)
    remove(options.target, [
      'src/lib/auth-client.ts',
      'src/lib/auth-server.ts',
      'src/routes/api/auth',
      'convex/auth.ts',
      'convex/testUtils.ts',
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
  }
  if (options.auth === 'better-auth' && !options.selectedExamples.includes('email')) {
    const authPath = join(options.target, 'convex/auth.ts')
    writeFileSync(
      authPath,
      readFileSync(authPath, 'utf8').replace(
        "import { components, internal } from './_generated/api'",
        "import { components } from './_generated/api'"
      )
    )
  }
  if (!options.selectedExamples.includes('chat'))
    remove(options.target, ['convex/seed.ts', 'convex/seed.test.ts'])
  if (!options.selectedExamples.includes('chat') || !options.selectedExamples.includes('files')) {
    remove(options.target, ['convex/maintenance.test.ts'])
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
  if (!options.selectedExamples.includes('files') && !options.selectedExamples.includes('admin')) {
    remove(options.target, ['src/routes/_authenticated.tsx'])
  }
  writeFileSync(
    join(options.target, 'src/routes/examples.index.tsx'),
    renderExamplesIndex(options.selectedExamples)
  )

  if (options.deploy !== 'cloudflare') {
    remove(options.target, ['wrangler.jsonc', '.github/workflows/deploy.yml'])
    copyOverlay(options.deploy, options.target)
  }
  configurePackage(options.target, options)
  writeFileSync(
    join(options.target, '.convexkit.json'),
    `${JSON.stringify({ version: 1, ...options, target: undefined, templateDir: undefined }, null, 2)}\n`
  )
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
  compose(options)

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
