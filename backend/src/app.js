import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import dataRoutes from "./routes/dataRoutes.js";
import forecastRoutes from "./routes/forecastRoutes.js";
import procurementRoutes from "./routes/procurementRoutes.js";
import carbonRoutes from "./routes/carbonRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, curl, mobile apps)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend is running",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/forecast", forecastRoutes);
app.use("/api/procurement", procurementRoutes);
app.use("/api/carbon", carbonRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);

/* ---------- React Frontend ---------- */

app.use(express.static(path.join(__dirname, "public/dist")));

// SPA fallback — only for non-API routes so missing /api/* paths get a proper 404
app.get(/^(?!\/api\/).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, "public/dist/index.html"));
});

/* ---------- Global Error Handler ---------- */

app.use((error, req, res, next) => {
  const status = error.status || error.statusCode || 500;

  return res.status(status).json({
    success: false,
    message: error.message || "Internal Server Error"
  });
});