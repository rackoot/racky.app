# Development Setup Guide

This guide explains how to run the Racky development environment with all services running concurrently.

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
- ✅ Start Backend API (port 5000)
- ✅ Start Frontend dev server (port 5173)
- ✅ Display all logs in a unified console with color-coded prefixes

### 3. Stop All Services

Press `Ctrl+C` in the terminal where `npm run dev` is running.

The script will automatically:
- Stop the Backend and Frontend processes
- Keep MongoDB and RabbitMQ containers running (for faster subsequent starts)

To fully stop and remove Docker containers:

```bash
npm run docker:down
```

## Available Scripts

### Root Level Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | 🚀 Start all services (MongoDB, RabbitMQ, Backend, Frontend) |
| `npm run dev:simple` | Alternative dev start without Docker logs |
| `npm run docker:up` | Start only Docker services (MongoDB + RabbitMQ) |
| `npm run docker:down` | Stop and remove Docker containers |
| `npm run docker:logs` | View Docker container logs |
| `npm run docker:restart` | Restart Docker containers |
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
# Stop all containers
npm run docker:down

# Remove all volumes (⚠️ This deletes all data!)
docker volume rm racky.app_mongodb_dev_data racky.app_rabbitmq_dev_data

# Start fresh
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
   - Optionally run `npm run docker:down` to stop Docker containers

## Environment Variables

The project uses multiple environment files:

- **`.env`**: Root level environment variables for Docker ports
- **`.env.docker`**: Environment variables for Docker Compose services
- **`server/.env`**: Backend-specific environment variables (JWT secrets, API keys, etc.)

Make sure to create these files based on the `.env.example` templates.

## Additional Resources

- **Backend API Documentation**: `/RACKY_BACKEND_API.md`
- **Project Documentation**: `/CLAUDE.md`
- **Postman Collection**: `/server/postman_collection.json`
- **Entity Relationship Diagram**: `/server/ER_DIAGRAM.md`

## Need Help?

- Check the main `README.md` for project overview
- Review `CLAUDE.md` for development guidelines
- Check Docker container status: `docker ps`
- View container logs: `docker logs <container-name>`
