#!/bin/bash

# Quick test script to verify development setup

echo "🧪 Testing Racky Development Setup"
echo "=================================="
echo ""

# Check Docker
echo "1. Checking Docker..."
if docker info > /dev/null 2>&1; then
    echo "   ✅ Docker is running"
else
    echo "   ❌ Docker is not running"
    exit 1
fi

# Check if dev.sh exists and is executable
echo "2. Checking dev.sh script..."
if [ -x "./dev.sh" ]; then
    echo "   ✅ dev.sh is executable"
else
    echo "   ❌ dev.sh is not executable"
    exit 1
fi

# Check if docker-compose.dev.yml exists
echo "3. Checking docker-compose.dev.yml..."
if [ -f "./docker-compose.dev.yml" ]; then
    echo "   ✅ docker-compose.dev.yml exists"
else
    echo "   ❌ docker-compose.dev.yml not found"
    exit 1
fi

# Verify docker-compose.dev.yml syntax
echo "4. Validating docker-compose configuration..."
if docker compose -f docker-compose.dev.yml config > /dev/null 2>&1; then
    echo "   ✅ docker-compose.dev.yml is valid"
else
    echo "   ❌ docker-compose.dev.yml has errors"
    exit 1
fi

# Check for required directories
echo "5. Checking project structure..."
if [ -d "./server" ] && [ -d "./client" ]; then
    echo "   ✅ server/ and client/ directories exist"
else
    echo "   ❌ Missing server/ or client/ directory"
    exit 1
fi

# Check for package.json files
echo "6. Checking package.json files..."
missing=0
for dir in "." "server" "client"; do
    if [ ! -f "$dir/package.json" ]; then
        echo "   ❌ Missing $dir/package.json"
        missing=1
    fi
done
if [ $missing -eq 0 ]; then
    echo "   ✅ All package.json files exist"
fi

# Check if concurrently is installed
echo "7. Checking concurrently..."
if [ -f "./node_modules/.bin/concurrently" ]; then
    echo "   ✅ concurrently is installed"
else
    echo "   ⚠️  concurrently not found - run 'npm install' first"
fi

# Check if server dependencies are installed
echo "8. Checking server dependencies..."
if [ -d "./server/node_modules" ]; then
    echo "   ✅ Server dependencies installed"
else
    echo "   ⚠️  Server dependencies not installed - run 'npm run install:all'"
fi

# Check if client dependencies are installed
echo "9. Checking client dependencies..."
if [ -d "./client/node_modules" ]; then
    echo "   ✅ Client dependencies installed"
else
    echo "   ⚠️  Client dependencies not installed - run 'npm run install:all'"
fi

echo ""
echo "=================================="
echo "✅ Setup verification complete!"
echo ""
echo "Next steps:"
echo "  1. If any warnings appeared, run: npm run install:all"
echo "  2. Start development: npm run dev"
echo ""
