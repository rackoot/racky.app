#!/bin/bash

# Racky Development Environment Startup Script
# This script starts MongoDB, RabbitMQ, Backend, and Frontend concurrently with unified logs

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_message "$RED" "❌ Error: Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to cleanup on exit
cleanup() {
    print_message "$YELLOW" "\n🛑 Stopping all services..."

    # Stop concurrently if it's running
    pkill -P $$ 2>/dev/null || true

    print_message "$GREEN" "✅ All services stopped"
    exit 0
}

# Trap Ctrl+C and other termination signals
trap cleanup SIGINT SIGTERM

# Main script starts here
print_message "$CYAN" "🚀 Starting Racky Development Environment"
print_message "$CYAN" "========================================="

# Check if Docker is running
check_docker

# Start MongoDB and RabbitMQ via Docker Compose
print_message "$BLUE" "📦 Starting MongoDB and RabbitMQ containers..."
docker compose -f docker-compose.dev.yml up -d

# Wait for MongoDB to be ready
print_message "$YELLOW" "⏳ Waiting for MongoDB to be ready..."
timeout=30
counter=0
until docker exec racky-mongodb-dev mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    sleep 1
    counter=$((counter + 1))
    if [ $counter -ge $timeout ]; then
        print_message "$RED" "❌ MongoDB failed to start within ${timeout} seconds"
        exit 1
    fi
done
print_message "$GREEN" "✅ MongoDB is ready"

# Check if RabbitMQ container exists in docker-compose.dev.yml
if docker compose -f docker-compose.dev.yml config --services 2>/dev/null | grep -q "rabbitmq"; then
    print_message "$YELLOW" "⏳ Waiting for RabbitMQ to be ready..."
    counter=0
    until docker exec racky-rabbitmq-dev rabbitmq-diagnostics ping > /dev/null 2>&1; do
        sleep 1
        counter=$((counter + 1))
        if [ $counter -ge $timeout ]; then
            print_message "$YELLOW" "⚠️  RabbitMQ check timed out, but continuing..."
            break
        fi
    done
    if [ $counter -lt $timeout ]; then
        print_message "$GREEN" "✅ RabbitMQ is ready"
    fi
else
    print_message "$YELLOW" "ℹ️  RabbitMQ not found in docker-compose.dev.yml, skipping..."
fi

print_message "$CYAN" ""
print_message "$CYAN" "========================================="
print_message "$CYAN" "🎯 Starting Backend and Frontend..."
print_message "$CYAN" "========================================="
print_message "$CYAN" ""

# Start Backend and Frontend concurrently with prefixed logs
npx concurrently \
  --names "BACKEND,FRONTEND" \
  --prefix-colors "blue,magenta" \
  --kill-others \
  --kill-others-on-fail \
  "cd server && npm run dev" \
  "cd client && npm run dev"

# If concurrently exits, cleanup
cleanup
