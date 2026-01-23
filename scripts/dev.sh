#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🔧 Starting Development Environment${NC}"
echo "===================================="

# Check for .env.local
if [ ! -f .env.local ]; then
  echo -e "${YELLOW}⚠️  .env.local not found. Copying from .env.example...${NC}"
  cp .env.example .env.local
  echo -e "${YELLOW}Please fill in .env.local with your values.${NC}"
  echo ""
fi

# Load environment variables
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo -e "${GREEN}Installing dependencies...${NC}"
  npm install
fi

# Generate Convex types first
echo -e "${GREEN}Generating Convex types...${NC}"
npx convex dev --once 2>/dev/null || true

echo ""
echo -e "${GREEN}Starting dev servers...${NC}"
echo "  📦 Convex: Syncing functions"
echo "  🌐 Vite: http://localhost:3000"
echo ""

# Run both Convex and Vite dev servers
npm run dev
