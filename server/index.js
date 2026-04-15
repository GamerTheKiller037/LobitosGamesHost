// server/index.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const adminRoutes = require("./routes/admin");
// Microservicios
const catalogService = require("./routes/microservices/catalogService");
const notifyService = require("./routes/microservices/notifyService");
const analyticsService = require("./routes/microservices/analyticsService");

const app = express();
const isDev = process.env.NODE_ENV === "development";

// ── Logs de acceso ──────────────────────────────────────────────────────────
let logsDir = null;
if (isDev) {
  logsDir = path.join(__dirname, "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
  const accessLogStream = fs.createWriteStream(
    path.join(logsDir, "access.log"),
    { flags: "a" },
  );
  app.use(morgan("combined", { stream: accessLogStream }));
}
app.use(morgan("dev")); // Esto se ve en la consola de Railway

// ── Helmet ────────────────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://localhost:3000",
];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Origen no permitido por CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: "Demasiadas peticiones. Intenta en 15 minutos." },
});
app.use(globalLimiter);

// ── Middleware de seguridad corregido ──────────────────────────────────────────
app.use((req, res, next) => {
  const suspicious =
    req.path.includes("..") ||
    req.path.includes("<script") ||
    /['";<>]/.test(req.query?.toString() || "");
  if (suspicious) {
    console.warn(`⚠️ Intento sospechoso detectado: ${req.method} ${req.path}`);
    // Solo intentamos escribir archivo si estamos en local
    if (isDev && logsDir) {
      const secLog = path.join(logsDir, "security.log");
      fs.appendFileSync(
        secLog,
        `[${new Date().toISOString()}] SUSPICIOUS ${req.method} ${req.path}\n`,
      );
    }
    return res.status(400).json({ error: "Petición no permitida." });
  }
  next();
});

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/catalog", catalogService);
app.use("/api/notify", notifyService);
app.use("/api/analytics", analyticsService);

app.get("/api/health", (_, res) =>
  res.json({ status: "ok", env: process.env.NODE_ENV || "development" }),
);

app.disable("x-powered-by");

// ── 404 corregido ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  console.log(`404 - ${req.method} ${req.path}`);
  if (isDev && logsDir) {
    const secLog = path.join(logsDir, "security.log");
    fs.appendFileSync(
      secLog,
      `[${new Date().toISOString()}] 404 ${req.method} ${req.path}\n`,
    );
  }
  res.status(404).json({ error: "Endpoint no encontrado" });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("[Server Error]", err.message);
  res
    .status(500)
    .json({
      error: "Error interno del servidor",
      ...(isDev && { detail: err.message }),
    });
});

// ── Conexión ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/lobitosgames";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB conectado correctamente");
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
      if (isDev) console.log(`📋 Logs locales activados en: ${logsDir}`);
    });
  })
  .catch((err) => {
    console.error("❌ Error MongoDB:", err);
    process.exit(1);
  });
