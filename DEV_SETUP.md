# Development Setup Guide

This guide explains how to run the Racky development environment using the **hybrid approach**: Docker containers for databases and queues, local processes for backend and frontend.

## Prerequisites

- **Docker** installed and running
- **Node.js** v18 or higher
- **npm** installed

## Quick Start

### 1. Install Dependencies

First time setup:

```bash
npm run install:all
```

This will install dependencies for:
- Root project (concurrently)
- Backend (`/server`)
- Frontend (`/client`)

### 2. Start Development Environment

Run all services with a single command:

```bash
npm run dev
```

This will:
- ✅ Start MongoDB container (port 27017)
- ✅ Start RabbitMQ container (port 5672, Management UI: 15672)
- ✅ Start Backend API locally (port 5000)
- ✅ Start Frontend dev server locally (port 5173)
- ✅ Display all logs in a unified console with color-coded prefixes

**Why this approach?**
- Fast hot reload for backend and frontend code changes
- Isolated databases/queues in Docker for consistency
- Best developer experience with immediate feedback

### 3. Stop Development Environment

Press `Ctrl+C` in the terminal where `npm run dev` is running.

The script will automatically:
- Stop the Backend and Frontend processes
- Keep MongoDB and RabbitMQ containers running (for faster subsequent starts)

To fully stop Docker containers:

```bash
npm run dev:stop
```

To clean up everything (containers + volumes):

```bash
npm run dev:clean
```

This will prompt you to:
- Remove data volumes (MongoDB, RabbitMQ)
- Remove node_modules folders

## Available Scripts

### Main Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | 🚀 **PRIMARY**: Start all services (recommended) |
| `npm run dev:stop` | ⏸️ Stop Docker containers (preserves data) |
| `npm run dev:clean` | 🧹 Complete cleanup (removes containers, volumes, optionally node_modules) |

### Docker Management Scripts

| Script | Description |
|--------|-------------|
| `npm run docker:up` | Start only Docker services (MongoDB + RabbitMQ) |
| `npm run docker:down` | Stop Docker containers |
| `npm run docker:logs` | View Docker container logs |
| `npm run docker:restart` | Restart Docker containers |
| `npm run docker:full` | Start ALL services in Docker (including backend/frontend) |
| `npm run docker:full:build` | Build and start full Docker setup |
| `npm run docker:full:down` | Stop full Docker setup |

### Project Management Scripts

| Script | Description |
|--------|-------------|
| `npm run install:all` | Install dependencies for all projects |
| `npm run build` | Build both backend and frontend |
| `npm run typecheck` | Run TypeScript type checking on both projects |
| `npm run validate` | Run validation (typecheck) |

### Backend Scripts (in `/server`)

```bash
cd server
npm run dev          # Start backend with nodemon
npm run build        # Build TypeScript to JavaScript
npm run typecheck    # Check TypeScript types
npm run validate     # Run typecheck + tests
npm test             # Run Jest tests
```

### Frontend Scripts (in `/client`)

```bash
cd client
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run typecheck    # Check TypeScript types
npm run validate     # Run typecheck + lint
npm test             # Run Vitest unit tests
npm run e2e          # Run Playwright E2E tests
```

## Service URLs

When running `npm run dev`, you can access:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:5173 | React + Vite application |
| **Backend API** | http://localhost:5000 | Express REST API |
| **MongoDB** | mongodb://localhost:27017 | Database |
| **RabbitMQ AMQP** | amqp://localhost:5672 | Message queue |
| **RabbitMQ Management** | http://localhost:15672 | Web UI (user: `racky`, pass: `racky123`) |

## Log Output

The development script provides color-coded logs:

- 🔵 **BACKEND**: Backend API logs (blue)
- 🟣 **FRONTEND**: Frontend dev server logs (magenta)
- 📦 **Docker logs**: MongoDB and RabbitMQ container logs

## Development Approaches

### Hybrid Development (Recommended - Default)

**Command**: `npm run dev`

- MongoDB & RabbitMQ in Docker containers
- Backend & Frontend run locally
- **Best for**: Daily development, fast hot reload

### Full Docker Development

**Command**: `npm run docker:full`

- ALL services in Docker containers (MongoDB, RabbitMQ, Backend, Frontend)
- **Best for**: Testing containerized setup, CI/CD simulation

**When to use**:
- Testing Docker configuration
- Simulating production-like environment
- Debugging container-specific issues

## Troubleshooting

### Docker not running

```
❌ Error: Docker is not running. Please start Docker and try again.
```

**Solution**: Start Docker Desktop or Docker daemon before running `npm run dev`.

### Port already in use

If you see errors like "Port 5000 already in use" or "Port 5173 already in use":

**Solution**:
1. Stop any processes using those ports
2. Or modify ports in `.env` file:
   ```
   BACKEND_PORT=5001
   FRONTEND_PORT=5174
   ```

### MongoDB connection failed

**Solution**:
1. Ensure MongoDB container is running: `docker ps`
2. Restart Docker services: `npm run docker:restart`
3. Check logs: `npm run docker:logs`

### RabbitMQ connection failed

**Solution**:
1. Verify RabbitMQ is running: `docker ps | grep rabbitmq`
2. Check RabbitMQ logs: `docker logs racky-rabbitmq-dev`
3. Access management UI: http://localhost:15672 (user: `racky`, pass: `racky123`)

### Fresh start needed

To completely reset your development environment:

```bash
# Interactive cleanup with prompts
npm run dev:clean

# Or manual steps:
npm run docker:down
docker volume rm racky.app_mongodb_dev_data racky.app_rabbitmq_dev_data
npm run dev
```

### Backend compilation errors

If you see TypeScript errors in the backend:

```bash
cd server
npm run typecheck  # Check for type errors
npm run validate   # Run full validation
```

### Frontend not loading

If the frontend shows a blank page:

```bash
cd client
rm -rf node_modules .vite
npm install
npm run dev
```

## Development Workflow

### Typical workflow:

1. **Morning startup**:
   ```bash
   npm run dev
   ```

2. **Make code changes** - Hot reload is enabled for both frontend and backend

3. **Run tests**:
   ```bash
   # Backend tests
   cd server && npm test

   # Frontend tests
   cd client && npm test
   ```

4. **Before committing**:
   ```bash
   npm run validate  # Run type checking on both projects
   ```

5. **End of day**:
   - Press `Ctrl+C` to stop dev servers
   - Optionally run `npm run dev:stop` to stop Docker containers

6. **Weekly cleanup** (optional):
   ```bash
   npm run dev:clean  # Full cleanup to free disk space
   ```

## Environment Variables

The project uses a simplified environment variable structure:

### **`.env`** (Root - Infrastructure Config)
- Docker service ports (MongoDB, RabbitMQ, Backend, Frontend)
- RabbitMQ credentials
- Application URLs

### **`server/.env`** (Backend - Secrets & API Keys)
- MongoDB connection URI
- JWT secrets
- Stripe API keys
- OpenAI API key
- RabbitMQ connection URL

### **`client/.env.development`** (Frontend - Client Config)
- API URLs
- Stripe publishable key
- Development flags

**First time setup**:
1. Copy example files if they don't exist:
   ```bash
   cp .env.example .env
   cp server/.env.example server/.env
   cp client/.env.example client/.env.development
   ```
2. Update with your actual API keys and secrets

## Additional Resources

- **Backend API Documentation**: `/RACKY_BACKEND_API.md`
- **Project Documentation**: `/CLAUDE.md`
- **Postman Collection**: `/server/postman_collection.json`
- **Entity Relationship Diagram**: `/server/ER_DIAGRAM.md`

## Architecture Notes

### Why Hybrid Development?

The project uses a hybrid approach by default because:

1. **Fast Development Loop**: Local processes restart faster than containers
2. **Better Debugging**: Native debugger support in IDEs
3. **Hot Module Replacement**: Vite and nodemon work best locally
4. **Reduced CPU/Memory**: Fewer Docker containers = better laptop performance
5. **Isolated Data Layer**: Docker for databases ensures consistency across team

### When to Use Full Docker

Use `npm run docker:full` when:
- Testing the complete containerized application
- Debugging Docker-specific issues
- Simulating production environment
- Running CI/CD pipeline locally

## Need Help?

- Check the main `README.md` for project overview
- Review `CLAUDE.md` for development guidelines
- Check Docker container status: `docker ps`
- View container logs: `docker logs <container-name>`
- Clean slate: `npm run dev:clean` and start fresh
