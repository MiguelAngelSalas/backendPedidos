const express = require("express");
const cors = require("cors");
const pedidosRoutes = require("./src/routes/pedidos");
// CORREGIDO: "mercadopago" en minúsculas para que coincida exactamente con tu archivo src/routes/mercadopago.js
const notificacionMP = require("./src/routes/mercadoPago"); 
const errorHandler = require("./src/middlewares/errorHandler");

const app = express();

const allowedOrigins = [
  "https://impresionesatucasa.com.ar",
  "https://www.impresionesatucasa.com.ar", // Sumamos el www por seguridad
  "http://localhost:5173",
];

// ===== CONFIGURACIÓN CORS REFORZADA =====
app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como Postman o el propio servidor)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // El OPTIONS es el que destraba tu error
  allowedHeaders: ["Content-Type", "Authorization"]
}));
// ========================================

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