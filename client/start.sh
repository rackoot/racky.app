#!/bin/sh
set -e

echo "========================================="
echo "Starting Racky Frontend"
echo "Node: $(node --version) | NPM: $(npm --version)"
echo "Environment: ${NODE_ENV:-production}"
echo "Backend: ${VITE_API_URL:-not set}"
echo "========================================="

# Start Vite development server directly with node (no npm wrapper)
# This ensures Vite is PID 1 and signals are handled correctly
exec node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173

