const express = require("express");
// Sacamos 'upload' y traemos la nueva función 'generarFirmaSubida'
const { crearPedido, generarFirmaSubida } = require("../controllers/pedidosController");

const router = express.Router();

// Ruta de prueba
router.get("/ping", (req, res) => {
  res.send("📡 Ruta /api/pedidos activa");
});

router.get("/", (req, res) => {
  res.send("✅ Backend conectado correctamente");
});

// 🚀 NUEVA RUTA: Genera el permiso (URL pre-firmada) para subir a Cloudflare R2
router.post("/firma-r2", generarFirmaSubida);

// 📦 RUTA ACTUALIZADA: Ya no usa multer, recibe directamente el JSON súper liviano
router.post("/", crearPedido);

module.exports = router;