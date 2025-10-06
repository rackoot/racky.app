#!/bin/bash

echo "🚀 Starting local development environment..."
echo ""

# Check if MongoDB and RabbitMQ containers are running
echo "📦 Checking Docker containers..."
if ! docker ps | grep -q racky-mongodb; then
    echo "   Starting MongoDB..."
    docker compose up -d mongodb
fi

if ! docker ps | grep -q racky-rabbitmq; then
    echo "   Starting RabbitMQ..."
    docker compose up -d rabbitmq
fi

echo ""
echo "✅ Docker containers ready!"
echo ""
echo "   MongoDB:  http://localhost:27017"
echo "   RabbitMQ: http://localhost:15672 (user: racky, pass: racky123)"
echo ""
echo "Now you can run:"
echo "   Terminal 1: cd server && npm run dev"
echo "   Terminal 2: cd client && npm run dev"
echo ""
