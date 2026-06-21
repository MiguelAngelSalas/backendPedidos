const express = require("express");
const cors = require("cors");
const pedidosRoutes = require("./src/routes/pedidos");
// CORREGIDO: "mercadopago" en minúsculas para que coincida exactamente con tu archivo src/routes/mercadopago.js
const notificacionMP = require("./src/routes/mercadoPago"); 
const errorHandler = require("./src/middlewares/errorHandler");

const app = express();

const allowedOrigins = [
  "https://impresionesatucasa.com.ar",
  "http://localhost:5173",
];

// 👉 ACÁ ESTÁ LA MAGIA: Le pasamos la lista de dominios y habilitamos las credenciales
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

// ===== RUTAS DEL SISTEMA =====
app.use("/api/pedidos", pedidosRoutes);

// CORREGIDO: Volvemos a acoplar la ruta para escuchar los Webhooks de Mercado Pago
app.use("/api/mercadoPago", notificacionMP); 


app.get("/", (req, res) => {
  res.send("🚀 Backend funcionando correctamente");
});

// Middleware de errores
app.use(errorHandler);

module.exports = app;