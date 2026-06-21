const express = require("express");
const router = express.Router();

// Importamos los controladores
const { generarFirmaSubida, crearPedido } = require("../controllers/pedidosController");

// =======================================================
// RUTAS DE PEDIDOS (/api/pedidos)
// =======================================================

// 1. Ruta para autorizar la subida directa a Cloudflare R2
router.post("/firma-r2", generarFirmaSubida);

// 2. Ruta para procesar el JSON livianito, crear el Google Sheet y Mercado Pago
router.post("/", crearPedido);

module.exports = router;