#!/usr/bin/env bash
set -euo pipefail

case "${1:-preview}" in
  preview) npm run deploy:preview ;;
  production) npm run deploy:prod ;;
  *) echo 'Usage: ./scripts/deploy.sh [preview|production]' >&2; exit 2 ;;
esac
