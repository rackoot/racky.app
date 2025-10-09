#!/bin/sh
set -e

echo "========================================="
echo "Starting Racky Frontend"
echo "Node: $(node --version) | NPM: $(npm --version)"
echo "Environment: ${NODE_ENV:-production}"
echo "Backend: ${VITE_API_URL:-not set}"
echo "========================================="

# Start Vite development server
exec npm run dev

