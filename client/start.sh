#!/bin/sh
set -e

echo "========================================="
echo "Starting Racky Frontend"
echo "========================================="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Working directory: $(pwd)"
echo "========================================="

echo "Checking files..."
ls -la /app | head -20

echo "========================================="
echo "Checking if index.html exists..."
if [ -f "index.html" ]; then
    echo "✓ index.html found"
else
    echo "✗ index.html NOT found!"
    exit 1
fi

echo "Checking if src/main.tsx exists..."
if [ -f "src/main.tsx" ]; then
    echo "✓ src/main.tsx found"
else
    echo "✗ src/main.tsx NOT found!"
    exit 1
fi

echo "Checking if vite.config.ts exists..."
if [ -f "vite.config.ts" ]; then
    echo "✓ vite.config.ts found"
else
    echo "✗ vite.config.ts NOT found!"
    exit 1
fi

echo "========================================="
echo "Environment variables:"
env | grep -E '(NODE|VITE|NPM)' || echo "No relevant env vars"
echo "========================================="
echo "Checking node_modules/.bin/vite..."
if [ -f "node_modules/.bin/vite" ]; then
    echo "✓ vite binary found"
    ls -la node_modules/.bin/vite
else
    echo "✗ vite binary NOT found!"
    exit 1
fi

echo "========================================="
echo "Starting Vite development server..."
echo "========================================="

# Try to run vite directly first to see any errors
echo "Attempting to run vite directly..."
node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 --debug 2>&1 || {
    echo "Direct vite execution failed, trying npm run dev..."
    exec npm run dev 2>&1
}

