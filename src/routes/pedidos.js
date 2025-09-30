const express = require("express");
const { crearPedido, upload } = require("../controllers/pedidosController");

const router = express.Router();

router.post("/", upload.any(), crearPedido);

module.exports = router;
