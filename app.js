const express = require("express");
const cors = require("cors");
const pedidosRoutes = require("./src/routes/pedidos");
const errorHandler = require("./src/middlewares/errorHandler");

const app = express();

app.use(cors({
  origin: ["https://impresionesatucasa.com.ar", "http://localhost:5173"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use("/api/pedidos", pedidosRoutes);

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("🚀 Backend funcionando correctamente");
});

// Middleware de errores
app.use(errorHandler);

module.exports = app;
