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
echo "Starting Vite development server..."
echo "========================================="

# Run vite with explicit output
exec npm run dev 2>&1

