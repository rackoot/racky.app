#!/bin/bash

# =============================================================================
# Development Environment Cleanup Script
# =============================================================================
# This script stops and cleans up all development Docker containers and volumes
# Usage: npm run dev:clean
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     🧹  Racky Development Environment Cleanup          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Stop development containers
echo -e "${YELLOW}⏸️  Stopping development containers...${NC}"
docker compose -f docker-compose.dev.yml down 2>/dev/null || true

# Remove development containers and networks
echo -e "${YELLOW}🗑️  Removing containers and networks...${NC}"
docker compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true

# Ask if user wants to remove volumes
echo ""
echo -e "${YELLOW}❓ Do you want to remove data volumes (MongoDB, RabbitMQ)?${NC}"
echo -e "${YELLOW}   This will DELETE all database data and message queues!${NC}"
read -p "   Remove volumes? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}🗑️  Removing volumes...${NC}"
    docker compose -f docker-compose.dev.yml down --volumes 2>/dev/null || true
    echo -e "${GREEN}✅ Volumes removed${NC}"
else
    echo -e "${GREEN}✅ Volumes preserved${NC}"
fi

# Clean up orphaned containers from old setup (racky-mongodb, racky-rabbitmq, racky-redis)
echo ""
echo -e "${YELLOW}🧹 Cleaning up orphaned containers...${NC}"
docker stop racky-mongodb racky-rabbitmq racky-redis 2>/dev/null || true
docker rm racky-mongodb racky-rabbitmq racky-redis 2>/dev/null || true

# Ask if user wants to remove node_modules
echo ""
echo -e "${YELLOW}❓ Do you want to remove node_modules folders?${NC}"
echo -e "${YELLOW}   This will require running npm install again.${NC}"
read -p "   Remove node_modules? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}🗑️  Removing node_modules...${NC}"
    rm -rf server/node_modules client/node_modules node_modules
    echo -e "${GREEN}✅ node_modules removed${NC}"
    echo -e "${BLUE}ℹ️  Run 'npm install' in root, server, and client directories${NC}"
else
    echo -e "${GREEN}✅ node_modules preserved${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ✨  Cleanup Complete!                               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}To start development again, run:${NC} npm run dev"
echo ""
