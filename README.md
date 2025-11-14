# Racky - Multi-Marketplace Management Platform

Racky is a **multi-tenant SaaS platform** that allows businesses to manage multiple e-commerce marketplaces from a single unified interface. Connect to Shopify, Amazon, VTEX, MercadoLibre, and more.

## 🚀 Quick Start

### Prerequisites

- Docker Desktop installed and running
- Node.js v18+ and npm
- Git

### Setup & Run

```bash
# 1. Clone the repository
git clone <repository-url>
cd racky.app

# 2. Install dependencies
npm run install:all

# 3. Start development environment
npm run dev
```

That's it! The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **RabbitMQ Management**: http://localhost:15672

### First Time Setup

Create the super admin user and subscription plans:

```bash
# In a new terminal (while dev environment is running)
cd server
node scripts/setup.js
```

**Default Admin Credentials:**
- Email: `admin@racky.app`
- Password: `admin123!`

## 📖 Documentation

- **[Development Setup Guide](DEV_SETUP.md)** - Complete development environment documentation
- **[Backend API Documentation](RACKY_BACKEND_API.md)** - REST API endpoints reference
- **[Project Guidelines](CLAUDE.md)** - Development guidelines and architecture

## 🛠 Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all services (primary dev command) |
| `npm run dev:stop` | Stop Docker containers |
| `npm run dev:clean` | Complete cleanup (containers + volumes) |
| `npm run validate` | Run TypeScript checks on both projects |
| `npm run build` | Build backend and frontend for production |

See [DEV_SETUP.md](DEV_SETUP.md) for complete command reference.

## 🏗 Architecture

### Tech Stack

**Frontend:**
- React 19 + TypeScript
- Vite for blazing fast development
- Tailwind CSS + shadcn/ui components
- React Router for navigation

**Backend:**
- Node.js + Express + TypeScript
- MongoDB for data persistence
- RabbitMQ for async job processing
- JWT authentication

**Infrastructure:**
- Docker for local development
- Multi-tenant architecture with complete data isolation
- Role-based access control (USER, SUPERADMIN)

### Project Structure

```
racky.app/
├── client/              # React frontend application
├── server/              # Node.js backend API
├── dev.sh              # Development startup script
├── dev-clean.sh        # Cleanup script
├── docker-compose.dev.yml       # Hybrid development (recommended)
├── docker-compose.full.yml      # Full containerization
└── .env                # Infrastructure configuration
```

## 🎯 Features

### For Users
- **Multi-Marketplace Connection**: Shopify, Amazon, VTEX, MercadoLibre, WooCommerce, Facebook Shop, Google Shopping
- **Unified Product Management**: Sync and manage products across all connected marketplaces
- **AI-Powered Optimization**: Automatic product description enhancement and SEO optimization
- **Real-time Sync**: Bidirectional synchronization with marketplace APIs
- **Analytics Dashboard**: Track performance across all marketplaces

### For Admins
- **User Management**: Activate/deactivate accounts, manage roles
- **Subscription Management**: Control user plans and limits
- **Platform Analytics**: Monitor usage and system health
- **Data Administration**: Safe user data deletion with cascading cleanup

## 🔧 Development Workflow

### Daily Development

```bash
# Start development environment
npm run dev

# Make code changes (hot reload enabled)

# Run tests
cd server && npm test
cd client && npm test

# Before committing
npm run validate
```

### Environment Variables

The project uses three main environment files:

1. **`.env`** (Root) - Infrastructure config (ports, RabbitMQ)
2. **`server/.env`** - Backend secrets (JWT, Stripe, OpenAI)
3. **`client/.env.development`** - Frontend config (API URLs, Stripe public key)

Copy from `.env.example` files and update with your actual values.

## 🧪 Testing

### Backend Tests

```bash
cd server
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Frontend Tests

```bash
cd client
npm test              # Unit tests
npm run e2e           # E2E tests with Playwright
npm run test:ui       # Interactive test UI
```

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Check what's using the port
lsof -i :5000
# Or modify ports in .env file
```

**Docker containers not starting:**
```bash
# Check Docker is running
docker ps
# Restart containers
npm run docker:restart
```

**Fresh start needed:**
```bash
npm run dev:clean  # Interactive cleanup
```

See [DEV_SETUP.md](DEV_SETUP.md) for complete troubleshooting guide.

## 📦 Deployment

### Production Build

```bash
npm run build
```

This creates optimized builds in:
- `server/dist/` - Backend JavaScript
- `client/dist/` - Frontend static files

### Docker Production

```bash
docker compose -f docker-compose.full.yml up --build
```

## 🤝 Contributing

1. Follow the development guidelines in [CLAUDE.md](CLAUDE.md)
2. Run `npm run validate` before committing
3. Write tests for new features
4. Update documentation as needed

## 📄 License

MIT

## 🆘 Need Help?

- Check [DEV_SETUP.md](DEV_SETUP.md) for detailed setup instructions
- Review [CLAUDE.md](CLAUDE.md) for development patterns
- Check [RACKY_BACKEND_API.md](RACKY_BACKEND_API.md) for API documentation
- View container logs: `docker logs <container-name>`

---

**Developed with ❤️ using Claude Code**
