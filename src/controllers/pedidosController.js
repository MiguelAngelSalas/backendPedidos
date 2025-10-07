const multer = require("multer");
const crypto = require("crypto");
const cloudinary = require("../utilidades/cloudinary");

const upload = multer({ storage: multer.memoryStorage() });

const crearPedido = async (req, res, next) => {
  try {
    console.log("===== Datos recibidos en /api/pedidos =====");
    console.log("req.body:", req.body);
    console.log("req.files:", req.files);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No se enviaron archivos" });
    }

    const { cliente, telefono } = req.body;
    let tiposPapel = [];

    try {
      const pedido = JSON.parse(req.body.pedido || "{}");
      if (!pedido.items || !Array.isArray(pedido.items)) {
        return res.status(400).json({ error: "Pedido sin items válidos" });
      }
      tiposPapel = pedido.items
        .filter((item) => item.detalles?.tipo === "impresion")
        .map((item) => item.detalles.papel);
    } catch (err) {
      return res.status(400).json({ error: "Pedido mal formado" });
    }

    if (!cliente || !telefono) {
      return res.status(400).json({ error: "Faltan datos del cliente" });
    }

    if (typeof tiposPapel === "string") tiposPapel = [tiposPapel];

    if (!Array.isArray(tiposPapel)) {
      return res.status(400).json({ error: "Tipos de papel inválidos" });
    }

    if (tiposPapel.length !== req.files.length) {
      return res
        .status(400)
        .json({ error: "Cantidad de tipos de papel no coincide con archivos" });
    }

    const clienteNombre = cliente.trim().replace(/\s+/g, "_");
    const clienteTelefono = telefono.trim().replace(/\s+/g, "_");
    const fechaPedido = Date.now();
    const carpetaPedido = `pedidos/${clienteNombre}_${clienteTelefono}_${fechaPedido}`;

    const archivosSubidos = await Promise.all(
      req.files.map(async (file, idx) => {
        const tipoPapel = tiposPapel[idx] || "desconocido";

        if (file.mimetype !== "application/pdf") {
          throw new Error(`Archivo no permitido: ${file.originalname}`);
        }
        if (!file.buffer || file.buffer.length === 0) {
          throw new Error(`Archivo vacío: ${file.originalname}`);
        }

        const uuid = crypto.randomUUID();
        const nombreArchivoBase = `${clienteNombre}_${clienteTelefono}_${tipoPapel}_${fechaPedido}_${uuid}`;

        const result = await cloudinary.uploader.upload(file.buffer, {
          resource_type: "raw",
          folder: carpetaPedido,
          public_id: nombreArchivoBase,
          use_filename: false,
          unique_filename: true,
        });

        return {
          originalname: file.originalname,
          nombreSubido: result.public_id,
          secure_url: result.secure_url,
          format: result.format,
        };
      })
    );

    res.json({
      mensaje: "✅ Pedido recibido y archivos subidos correctamente",
      cliente: clienteNombre,
      telefono: clienteTelefono,
      carpeta: carpetaPedido,
      archivos: archivosSubidos,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { crearPedido, upload };
