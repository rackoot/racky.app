// Register module aliases only for production builds
if (process.env.NODE_ENV === "production") {
  require("module-alias/register");
}

// Import environment configuration (handles dotenv loading)
import getEnv from "@/common/config/env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import connectDB from "@/common/config/database";
import errorHandler from "@/common/middleware/errorHandler";

import authRoutes from "@/auth/routes/auth";
import connectionRoutes from "@/stores/routes/connections";
import marketplaceRoutes from "@/marketplaces/routes/marketplaces";
import productRoutes from "@/products/routes/products";
import dashboardRoutes from "@/dashboard/routes/dashboard";
import optimizationRoutes from "@/opportunities/routes/optimizations";
import opportunityRoutes from "@/opportunities/routes/opportunities";
import aiOptimizationRoutes from "@/opportunities/routes/ai-optimization";
import adminRoutes from "@/admin/routes/admin";
import planRoutes from "@/subscriptions/routes/plans";
import usageRoutes from "@/subscriptions/routes/usage";
import subscriptionRoutes from "@/subscriptions/routes/subscription";
import billingRoutes from "@/subscriptions/routes/billing";
import demoRoutes from "@/demo/routes/demo";
import workspaceRoutes from "./modules/workspaces/routes/workspaces";
import { initializeNotificationScheduler } from "@/notifications/services/notificationScheduler";
import { protect, requireWorkspace } from "@/common/middleware/auth";
import { stripeWebhookHandler } from "@/subscriptions/routes/billing";
import rabbitMQService from "@/common/services/rabbitMQService";
import { setupRabbitMQJobProcessors } from "@/jobs/rabbitMQJobSetup";
// import { healthMonitorService } from '@/common/services/healthMonitorService';

const app = express();

// Initialize notification scheduler and queue service after database connection
let notificationCleanup: (() => void) | undefined;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
});

app.use(helmet());
// Handle multiple CLIENT_URLs separated by commas
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

// Add CLIENT_URL(s) from environment
const clientUrl = getEnv().CLIENT_URL;
if (clientUrl) {
  const clientUrls = clientUrl.split(",").map((url) => url.trim());
  allowedOrigins.push(...clientUrls);
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Workspace-ID",
      "X-Requested-With",
    ],
    exposedHeaders: ["X-Total-Count"],
  })
);
app.use(morgan("tiny"));
app.use(limiter);

// Stripe webhook route (must be before JSON middleware and without auth)
app.post(
  "/api/billing/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes that don't require workspace context
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// Workspace management routes (protected but don't require workspace context)
app.use("/api/workspaces", protect, workspaceRoutes);

// Routes that require workspace context
app.use("/api/plans", protect, requireWorkspace, planRoutes);
app.use("/api/connections", protect, requireWorkspace, connectionRoutes);
app.use("/api/marketplaces", protect, requireWorkspace, marketplaceRoutes);
app.use("/api/products", protect, requireWorkspace, productRoutes);
app.use("/api/dashboard", protect, requireWorkspace, dashboardRoutes);
app.use("/api/optimizations", protect, requireWorkspace, optimizationRoutes);
app.use("/api/opportunities", protect, requireWorkspace, opportunityRoutes);
app.use("/api/videos", protect, requireWorkspace, require('./modules/videos/routes/videos').default);

app.use("/api/subscription", protect, subscriptionRoutes);
app.use("/api/usage", protect, usageRoutes);
app.use(
  "/api/opportunities/ai",
  protect,
  requireWorkspace,
  aiOptimizationRoutes
);

app.use("/api/billing", protect, requireWorkspace, billingRoutes);

app.use("/api/demo", protect, requireWorkspace, demoRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "OK", message: "Racky API is running with hot reload!" });
});

app.use(errorHandler);

// Start server only after database connection
const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();

    // Initialize RabbitMQ service conditionally
    const env = getEnv();
    if (env.USE_RABBITMQ) {
      try {
        await rabbitMQService.initialize();
        // Set up RabbitMQ job processors
        setupRabbitMQJobProcessors();
        console.log("✅ RabbitMQ initialized successfully");
      } catch (error) {
        console.error("❌ Failed to initialize RabbitMQ:", error.message);
        console.log("⚠️  Server will continue without queue system");
      }
    } else {
      console.log("🔴 RabbitMQ disabled - running without queue system");
    }

    // Start health monitoring service
    // healthMonitorService.start();

    const PORT = getEnv().PORT;
    const server = app.listen(PORT, () => {
      console.log(`🚀 Racky server running on port ${PORT}`);

      // Initialize notification scheduler after server starts
      setTimeout(() => {
        notificationCleanup = initializeNotificationScheduler();
      }, 1000);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async () => {
      console.log("Shutting down gracefully...");
      if (notificationCleanup) {
        notificationCleanup();
      }
      // healthMonitorService.stop();
      await rabbitMQService.shutdown();
      server.close(() => {
        console.log("Server closed.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
