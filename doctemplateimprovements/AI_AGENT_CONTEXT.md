# AI Agent System Context

This document provides comprehensive context for AI coding agents working on this project. Use this as the foundational knowledge base when assisting with development.

---

## 🎯 Project Mission

Build the **G-Matrix** application (gluten-free product rating platform) in this repository (`g-convex-v2`) while documenting template improvements.

### Two Objectives:
1. **Implement**: Full feature parity with source app (`g-convex`)
2. **Document**: Record template issues in `doctemplateimprovements/`

---

## 🏗️ Architecture Overview

### Stack Summary

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| **Framework** | TanStack Start | ^1.154.12 | SSR React framework |
| **Router** | TanStack Router | ^1.154.12 | File-based routing |
| **Data** | TanStack Query | ^5.90.12 | Server state management |
| **Backend** | Convex | ^1.31.6 | Real-time serverless |
| **Auth** | Better Auth | 1.4.9 | Self-hosted auth |
| **Edge** | Cloudflare Workers | - | Production deployment |
| **Styling** | Tailwind CSS | ^4.1.18 | v4 with new syntax |
| **Language** | TypeScript | ^5.9.2 | Strict mode |
| **Runtime** | Node.js | >=22.0.0 | Required version |

### Application Type: G-Matrix
A **community-driven gluten-free product rating** platform featuring:
- 2D quadrant visualization (Safety × Taste)
- Weighted voting (registered vs anonymous)
- Gamification (points, badges, streaks)
- AI-powered image analysis (Gemini)
- Multi-language support

---

## 📁 Project Structure

```
g-convex-v2/
├── convex/                    # Backend
│   ├── _generated/            # Auto-generated types (DO NOT EDIT)
│   ├── lib/
│   │   ├── authHelpers.ts     # RBAC utilities
│   │   ├── config.ts          # Backend config
│   │   └── gamification.ts    # Points/badges logic (TO ADD)
│   ├── schema.ts              # Database schema
│   ├── auth.ts                # Better Auth setup
│   ├── auth.config.ts         # Auth configuration
│   ├── http.ts                # HTTP endpoints
│   ├── users.ts               # User queries
│   ├── messages.ts            # Messages (demo, to replace)
│   ├── files.ts               # File storage
│   ├── products.ts            # Products (TO ADD)
│   ├── votes.ts               # Voting logic (TO ADD)
│   └── ai.ts                  # Gemini integration (TO ADD)
│
├── src/
│   ├── components/
│   │   ├── ui/                # shadcn/ui components (TO ADD)
│   │   ├── layout/            # Layout components (TO ADD)
│   │   └── dashboard/         # Chart components (TO ADD)
│   ├── hooks/
│   │   ├── use-admin.ts       # Admin check
│   │   ├── use-impersonate.tsx
│   │   └── index.ts
│   ├── lib/
│   │   ├── auth-client.ts     # Better Auth client
│   │   ├── auth-server.ts     # Better Auth server
│   │   ├── env.ts             # Environment validation
│   │   ├── utils.ts           # Utilities
│   │   └── i18n.ts            # Translations (TO ADD)
│   ├── routes/
│   │   ├── __root.tsx         # Root layout
│   │   ├── index.tsx          # Home (G-Matrix)
│   │   ├── files.tsx          # File demo (to replace)
│   │   ├── login.tsx          # Login page (TO ADD)
│   │   ├── profile.tsx        # User profile (TO ADD)
│   │   ├── admin.tsx          # Admin dashboard (TO ADD)
│   │   └── product/
│   │       └── $name.tsx      # Product detail (TO ADD)
│   ├── locales/
│   │   ├── en.json            # English (TO ADD)
│   │   └── hu.json            # Hungarian (TO ADD)
│   └── styles/
│       └── globals.css        # Tailwind + theme
│
├── doctemplateimprovements/   # Template feedback docs
├── docs/                      # Original template docs
├── infrastructure/            # Terraform IaC
└── scripts/                   # Utility scripts
```

---

## 🔐 Authentication System

### Provider: Better Auth
- **Type**: Self-hosted OAuth
- **Storage**: Convex database (via adapter)
- **Providers**: Google OAuth

### Key Files
- `convex/auth.ts` - Server-side auth setup
- `convex/auth.config.ts` - Provider configuration
- `src/lib/auth-client.ts` - Client-side auth
- `src/lib/auth-server.ts` - SSR auth utilities

### Auth Flow
```
User → Google OAuth → Better Auth Callback → Session in Convex → Authenticated
```

### Usage Pattern
```typescript
// Client-side
import { authClient } from '@/lib/auth-client'
const { data: session } = authClient.useSession()

// Server-side (Convex)
const user = await ctx.auth.getUserIdentity()
```

---

## 🗄️ Database Schema (Target)

### Required Tables

```typescript
// convex/schema.ts
export default defineSchema({
  // Better Auth tables (auto-managed)
  user: defineTable({ /* managed by better-auth */ }),
  session: defineTable({ /* managed by better-auth */ }),
  account: defineTable({ /* managed by better-auth */ }),

  // Application tables
  products: defineTable({
    name: v.string(),
    imageUrl: v.optional(v.string()),
    ingredients: v.optional(v.array(v.string())),
    avgSafety: v.number(),           // 0-100
    avgTaste: v.number(),            // 0-100
    avgPrice: v.optional(v.number()), // 1-5
    totalVotes: v.number(),
    registeredVotes: v.number(),
    anonymousVotes: v.number(),
    lastUpdated: v.number(),
    createdBy: v.optional(v.id('user')),
    createdAt: v.number(),
  })
    .index('by_name', ['name'])
    .index('by_created', ['createdAt']),

  votes: defineTable({
    productId: v.id('products'),
    userId: v.optional(v.id('user')),
    anonymousId: v.optional(v.string()),
    isAnonymous: v.boolean(),
    safety: v.number(),
    taste: v.number(),
    price: v.optional(v.number()),
    storeName: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_product', ['productId'])
    .index('by_user', ['userId'])
    .index('by_anonymous', ['anonymousId']),

  profiles: defineTable({
    userId: v.id('user'),
    points: v.number(),
    badges: v.array(v.string()),
    streak: v.number(),
    lastVoteDate: v.optional(v.string()),
    totalVotes: v.number(),
  })
    .index('by_user', ['userId']),
})
```

---

## 🎨 UI Components Needed

### From shadcn/ui
```bash
# Initialize shadcn
npx shadcn@latest init

# Add required components
npx shadcn@latest add button card dialog input label \
  select slider tabs toast form avatar badge \
  dropdown-menu popover tooltip
```

### Custom Components to Build
1. **MatrixChart** - 2D quadrant visualization
2. **CoordinateGrid** - Draggable voting interface
3. **ProductList** - Sidebar product listing
4. **VotingPanel** - Quick vote buttons
5. **FineTunePanel** - Slider-based precise voting
6. **ScoutCard** - Gamification popup
7. **LanguageSwitcher** - i18n toggle
8. **AdminToolbar** - Floating admin controls (exists)

---

## 🎮 Gamification System

### Points Configuration
```typescript
export const POINTS = {
  VOTE: 10,
  NEW_PRODUCT: 25,
  ADD_PRICE: 5,
  TAG_STORE: 10,
  ADD_GPS: 5,
  STREAK_BONUS: 15,  // 3+ day streak
}
```

### Badges
```typescript
export const BADGES = [
  { id: 'first_scout', name: 'First Scout', threshold: 1 },
  { id: 'trailblazer', name: 'Trailblazer', threshold: 10 },
  { id: 'location_pro', name: 'Location Pro', threshold: 5 },  // GPS votes
  { id: 'store_hunter', name: 'Store Hunter', threshold: 5 },  // Store tags
  { id: 'century_scout', name: 'Century Scout', threshold: 100 },
  { id: 'streak_master', name: 'Streak Master', threshold: 7 }, // 7-day streak
]
```

---

## 🤖 AI Integration (Gemini)

### Purpose
Extract product info from photos:
- Product name
- Safety score estimate
- Taste score estimate
- Ingredient list

### Implementation
```typescript
// convex/ai.ts
import { GoogleGenerativeAI } from '@google/generative-ai'

export const analyzeProductImage = action({
  args: { imageBase64: v.string() },
  handler: async (ctx, { imageBase64 }) => {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64
        }
      },
      `Analyze this gluten-free product image and extract:
       1. Product name
       2. Estimated safety score (0-100) for celiac safety
       3. Estimated taste appeal (0-100)
       4. List of visible ingredients
       Return as JSON.`
    ])

    return JSON.parse(result.response.text())
  }
})
```

---

## 🌍 Internationalization

### Pattern
```typescript
// src/lib/i18n.ts
import en from '@/locales/en.json'
import hu from '@/locales/hu.json'

const locales = { en, hu }
type Locale = keyof typeof locales

export function useTranslation() {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale
    if (saved && locales[saved]) setLocale(saved)
  }, [])

  const t = (key: string) => {
    const keys = key.split('.')
    let value: any = locales[locale]
    for (const k of keys) {
      value = value?.[k]
    }
    return value || key
  }

  return { t, locale, setLocale }
}
```

### Example Translations
```json
// locales/en.json
{
  "nav": {
    "home": "Home",
    "profile": "Profile",
    "admin": "Admin"
  },
  "voting": {
    "safe": "Safe",
    "sketchy": "Sketchy",
    "unsafe": "Unsafe",
    "yummy": "Yummy",
    "meh": "Meh",
    "gross": "Gross"
  },
  "quadrants": {
    "holyGrail": "Holy Grail",
    "survivorFood": "Survivor Food",
    "russianRoulette": "Russian Roulette",
    "theBin": "The Bin"
  }
}
```

---

## 📊 G-Matrix Visualization

### Quadrant Logic
```
        100 │ Survivor Food │  Holy Grail  │
  Safety    │   (safe but   │   (best of   │
            │   not tasty)  │    both!)    │
         50 ├───────────────┼──────────────┤
            │   The Bin     │   Russian    │
            │   (avoid)     │   Roulette   │
          0 └───────────────┴──────────────┘
              0            50            100
                        Taste →
```

### Color Coding
```typescript
const QUADRANT_COLORS = {
  holyGrail: '#22c55e',      // Green - top right
  survivorFood: '#eab308',   // Yellow - top left
  russianRoulette: '#f97316', // Orange - bottom right
  theBin: '#ef4444',         // Red - bottom left
}

function getQuadrant(safety: number, taste: number): string {
  if (safety >= 50 && taste >= 50) return 'holyGrail'
  if (safety >= 50 && taste < 50) return 'survivorFood'
  if (safety < 50 && taste >= 50) return 'russianRoulette'
  return 'theBin'
}
```

---

## 🔧 Development Commands

```bash
# Start development
npm run dev                 # Runs Vite + Convex dev

# Individual services
npm run dev:web            # Only frontend
npm run dev:convex         # Only Convex backend

# Type checking
npm run typecheck          # Check TypeScript

# Linting/Formatting
npm run lint               # ESLint
npm run format             # Prettier

# Deployment
npm run deploy:preview     # Deploy to preview environment
npm run deploy:prod        # Deploy to production
```

---

## ⚠️ Important Patterns

### 1. Always Use Convex Indexes
```typescript
// Good - uses index
.query('votes').withIndex('by_product', q => q.eq('productId', id))

// Bad - full table scan
.query('votes').filter(q => q.eq(q.field('productId'), id))
```

### 2. Validate Inputs with Zod
```typescript
const productSchema = z.object({
  name: z.string().min(1).max(100),
  safety: z.number().min(0).max(100),
  taste: z.number().min(0).max(100),
})
```

### 3. Handle Anonymous Users
```typescript
const userId = (await ctx.auth.getUserIdentity())?._id
const voterId = userId ?? args.anonymousId

if (!voterId) throw new Error('User or anonymous ID required')
```

### 4. Use Optimistic Updates
```typescript
const { mutate } = useMutation(api.votes.cast, {
  optimisticUpdate: (localStore) => {
    // Update local state immediately
    localStore.setQuery(api.products.list, {}, (current) => {
      // Optimistically update product scores
    })
  }
})
```

---

## 📝 When Adding New Features

1. **Schema First**: Update `convex/schema.ts` with new tables/fields
2. **Backend Functions**: Add queries/mutations in `convex/`
3. **Types**: Export types from `src/lib/types.ts`
4. **Components**: Build UI in `src/components/`
5. **Route**: Add page in `src/routes/`
6. **Document**: Note any template issues in `doctemplateimprovements/`

---

## 🚨 Known Limitations

1. **Cloudflare Workers**: No Node.js APIs (use Web APIs)
2. **Convex Actions**: For external API calls only (rate limited)
3. **File Storage**: 20MB limit per file in Convex
4. **SSR**: Some hooks don't work during server render

---

## 📚 Reference Links

- [TanStack Start Docs](https://tanstack.com/start)
- [TanStack Router Docs](https://tanstack.com/router)
- [Convex Docs](https://docs.convex.dev)
- [Better Auth Docs](https://better-auth.dev)
- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Recharts Docs](https://recharts.org)
- [Google Gemini API](https://ai.google.dev)

---

## ✅ Quick Reference Checklist

When starting a task:
- [ ] Read relevant existing code
- [ ] Check schema for data structure
- [ ] Look for similar patterns in codebase
- [ ] Consider mobile responsiveness
- [ ] Add proper TypeScript types
- [ ] Handle loading/error states
- [ ] Test with both auth and anonymous users
- [ ] Document any template issues found
