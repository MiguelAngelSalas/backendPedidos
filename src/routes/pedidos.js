const express = require("express");
const { crearPedido, upload } = require("../controllers/pedidosController");

const router = express.Router();

// Ruta de prueba
router.get("/ping", (req, res) => {
  res.send("📡 Ruta /api/pedidos activa");
});

router.post("/", upload.any(), crearPedido);

module.exports = router;
