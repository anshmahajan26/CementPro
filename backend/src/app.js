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
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
  "https://cementpro-frontend.onrender.com",
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

// Try multiple candidate paths — Render's runtime cwd may differ from build-time cwd.
const candidatePaths = [
  path.join(__dirname, "public", "dist"),              // backend/src/public/dist  (if cp'd)
  path.join(__dirname, "..", "public", "dist"),         // backend/public/dist
  path.join(__dirname, "..", "..", "frontend", "dist"), // frontend/dist  (direct — no copy needed)
  path.join(process.cwd(), "src", "public", "dist"),   // cwd()/src/public/dist
  path.join(process.cwd(), "public", "dist"),           // cwd()/public/dist
  path.join(process.cwd(), "..", "frontend", "dist"),   // cwd()/../frontend/dist  (Render monorepo)
];

let distPath = candidatePaths[0]; // default
for (const candidate of candidatePaths) {
  const indexFile = path.join(candidate, "index.html");
  if (fs.existsSync(indexFile)) {
    distPath = candidate;
    console.log(`✅ Frontend found at: ${candidate}`);
    break;
  } else {
    console.log(`❌ No index.html at: ${indexFile}`);
  }
}

app.use(express.static(distPath));

// SPA fallback — serves index.html for every GET request that didn't match
// an API route or a static file above.  This lets React Router handle
// client-side paths like /forecast, /admin, etc. on hard refresh.
app.get("*", (req, res) => {
  const indexHtml = path.join(distPath, "index.html");
  res.sendFile(indexHtml, (err) => {
    if (err) {
      console.error(`SPA fallback failed for ${req.originalUrl}: ${err.message} (tried: ${indexHtml})`);
      res.status(404).send("Frontend build not found. Redeploy may be needed.");
    }
  });
});

/* ---------- Global Error Handler ---------- */

app.use((error, req, res, next) => {
  const status = error.status || error.statusCode || 500;

  return res.status(status).json({
    success: false,
    message: error.message || "Internal Server Error"
  });
});