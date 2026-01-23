# CI/CD Options & Best Practices

This document covers CI/CD options and enhancements for the template.

## Current CI Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Lint** | ✅ | ESLint check |
| **Type Check** | ✅ | TypeScript verification |
| **Format Check** | ✅ | Prettier verification |
| **Security Audit** | ✅ | npm audit (non-blocking) |
| **Build** | ✅ | Build verification |
| **Artifact Upload** | ✅ | 7-day retention |
| **Concurrency Control** | ✅ | Cancels old runs |
| **Parallel Jobs** | ✅ | Faster CI |

---

## Additional Options

### 1. Dependabot (Dependency Updates)

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    groups:
      development:
        patterns:
          - "@types/*"
          - "eslint*"
          - "prettier"
          - "typescript"
      tanstack:
        patterns:
          - "@tanstack/*"
      cloudflare:
        patterns:
          - "@cloudflare/*"
          - "wrangler"
```

### 2. CodeQL (Security Scanning)

Add `.github/workflows/codeql.yml`:

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: typescript
      
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
```

### 3. Preview Deployments

Add preview deploys on PRs:

```yaml
# Add to .github/workflows/ci.yml
preview-deploy:
  name: Preview Deploy
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  needs: build
  steps:
    - uses: actions/checkout@v4
    
    - uses: actions/download-artifact@v4
      with:
        name: build-${{ github.sha }}
        path: dist/
    
    # Cloudflare
    - name: Deploy Preview
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        command: deploy --env preview
    
    - name: Comment PR
      uses: actions/github-script@v7
      with:
        script: |
          github.rest.issues.createComment({
            issue_number: context.issue.number,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: '🚀 Preview deployed!'
          })
```

### 4. Slack/Discord Notifications

```yaml
# Add at end of deploy.yml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    fields: repo,message,commit,author,action,eventName,ref,workflow
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 5. Matrix Builds (Multiple Node Versions)

```yaml
strategy:
  matrix:
    node-version: [22, 24]
steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
```

### 6. Test Job (When Adding Tests)

```yaml
test:
  name: Test
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - uses: actions/setup-node@v4
      with:
        node-version: '24'
        cache: 'npm'
    
    - run: npm ci
    
    # Generate Convex types first
    - run: npx convex dev --once --typecheck=disable
      env:
        CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
    
    # Unit tests
    - name: Run Vitest
      run: npm run test
    
    # E2E tests
    - name: Install Playwright
      run: npx playwright install --with-deps
    
    - name: Run Playwright
      run: npm run test:e2e
    
    - name: Upload test results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: test-results
        path: |
          coverage/
          playwright-report/
```

---

## Deploy Workflow Features

| Feature | Cloudflare | Vercel | Netlify |
|---------|------------|--------|---------|
| Auto-deploy on push | ✅ | ✅ | ✅ |
| Preview deploys | ✅ | ✅ | ✅ |
| Environment selection | ✅ | ✅ | ✅ |
| Convex Cloud support | ✅ | ✅ | ✅ |
| Self-hosted Convex | ✅ | ✅ | ✅ |

---

## Secrets Management

### Required Secrets

| Secret | All Targets | Description |
|--------|-------------|-------------|
| `VITE_CONVEX_URL` | ✅ | Convex preview URL |
| `VITE_CONVEX_URL_PROD` | ✅ | Convex production URL |

### Cloudflare Secrets

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | API token with Workers:Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID |

### Vercel Secrets

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Personal access token |
| `VERCEL_ORG_ID` | Organization ID |
| `VERCEL_PROJECT_ID` | Project ID |

### Netlify Secrets

| Secret | Description |
|--------|-------------|
| `NETLIFY_AUTH_TOKEN` | Personal access token |
| `NETLIFY_SITE_ID` | Site ID |

---

## Best Practices

1. **Use concurrency control** - Prevents wasted runs
2. **Cache dependencies** - npm cache speeds up installs
3. **Parallel jobs** - Lint, test, typecheck in parallel
4. **Fail fast** - Don't continue if core checks fail
5. **Artifact retention** - Keep builds for debugging
6. **Security scanning** - CodeQL for vulnerabilities
7. **Dependency updates** - Dependabot for security patches
