#!/bin/sh

echo "========================================="
echo "Starting Racky Frontend"
echo "Node: $(node --version) | NPM: $(npm --version)"
echo "Environment: ${NODE_ENV:-production}"
echo "Backend: ${VITE_API_URL:-not set}"
echo "========================================="

# Check write permissions
echo "Testing write permissions..."
touch /app/.test-write && rm /app/.test-write && echo "✓ Write OK" || echo "✗ Write FAILED"

# Check node_modules/.vite
if [ -d "node_modules/.vite" ]; then
    echo "Removing old .vite cache..."
    rm -rf node_modules/.vite
fi

echo "========================================="
echo "Starting Vite with full output..."
echo "========================================="

# Start Vite development server with explicit logging
NODE_ENV=development DEBUG=vite:* exec node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 2>&1

