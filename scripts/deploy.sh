#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Convex + TanStack + Cloudflare Deployment Script${NC}"
echo "=================================================="

# Check for required tools
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm is required but not installed.${NC}"; exit 1; }
command -v npx >/dev/null 2>&1 || { echo -e "${RED}npx is required but not installed.${NC}"; exit 1; }

# Check for .env.local
if [ ! -f .env.local ]; then
  echo -e "${YELLOW}⚠️  .env.local not found. Copying from .env.example...${NC}"
  cp .env.example .env.local
  echo -e "${RED}Please fill in .env.local with your values and run this script again.${NC}"
  exit 1
fi

# Load environment variables
export $(grep -v '^#' .env.local | xargs)

# Validate required env vars
if [ -z "$VITE_CONVEX_URL" ]; then
  echo -e "${RED}VITE_CONVEX_URL is required in .env.local${NC}"
  exit 1
fi

# Parse arguments
ENVIRONMENT=${1:-production}

echo ""
echo -e "📦 Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo ""

# Step 1: Install dependencies
echo -e "${GREEN}Step 1/4: Installing dependencies...${NC}"
npm ci

# Step 2: Deploy Convex
echo -e "${GREEN}Step 2/4: Deploying Convex backend...${NC}"
if [ "$ENVIRONMENT" = "production" ]; then
  npx convex deploy --yes
else
  npx convex dev --once
fi

# Step 3: Build frontend
echo -e "${GREEN}Step 3/4: Building frontend...${NC}"
if [ "$ENVIRONMENT" = "production" ]; then
  CLOUDFLARE_ENV=production npm run build:prod
else
  CLOUDFLARE_ENV=preview npm run build:preview
fi

# Step 4: Deploy to Cloudflare
echo -e "${GREEN}Step 4/4: Deploying to Cloudflare Workers...${NC}"
npx wrangler deploy --env "$ENVIRONMENT"

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Your app is now live. Check your Cloudflare dashboard for the URL."
