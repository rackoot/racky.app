#!/bin/sh

echo "========================================="
echo "Starting Racky Frontend"
echo "Node: $(node --version) | NPM: $(npm --version)"
echo "Environment: ${NODE_ENV:-production}"
echo "Backend: ${VITE_API_URL:-not set}"
echo "PWD: $(pwd)"
echo "========================================="

# Check if vite exists
echo "Checking for Vite..."
if [ -f "node_modules/vite/bin/vite.js" ]; then
    echo "✓ Vite binary found"
else
    echo "✗ ERROR: Vite binary NOT found"
    echo "Looking for vite installation..."
    find node_modules -name "vite.js" -type f 2>/dev/null | head -5
    exit 1
fi

# Check if package.json exists
if [ -f "package.json" ]; then
    echo "✓ package.json found"
else
    echo "✗ ERROR: package.json NOT found"
    exit 1
fi

echo "========================================="
echo "Starting Vite server..."
echo "========================================="

# Try to run Vite and capture any errors
echo "Executing: node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173"

# Run without exec first to see errors, redirect all output
node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 2>&1

# If we get here, Vite exited
echo "Vite process ended with exit code: $?"

