// server/index.js
// Backend LobitosGames — Node.js + Express + MongoDB
// npm install express mongoose bcryptjs jsonwebtoken dotenv cors nodemailer

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

app.get("/api/health", (_, res) =>
  res.json({ status: "ok", time: new Date() }),
);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_, res) => res.status(404).json({ error: "Endpoint no encontrado" }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _, res, __) => {
  console.error("[Server Error]", err);
  res.status(500).json({ error: "Error interno del servidor" });
});

// ── Conectar MongoDB y levantar servidor ──────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/lobitosgames";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB conectado:", MONGO_URI);
    app.listen(PORT, () =>
      console.log(`🚀 Servidor en http://localhost:${PORT}`),
    );
  })
  .catch((err) => {
    console.error("❌ Error MongoDB:", err);
    process.exit(1);
  });
