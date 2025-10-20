const multer = require("multer");
const fs = require("fs");
const { default: pLimit } = require("p-limit");
const crypto = require("crypto");
const { Readable } = require("stream");
const cloudinary = require("../utilidades/cloudinary");
const notificarTelegram = require("../utilidades/notifiTelegram");

// Guardar temporalmente los archivos en disco
const upload = multer({ dest: "uploads/" });

// Limitar a 3 subidas simultáneas
const limit = pLimit(3);

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
      req.files.map((file, idx) =>
        limit(
          () =>
            new Promise((resolve, reject) => {
              const tipoPapel = tiposPapel[idx] || "desconocido";

              if (file.mimetype !== "application/pdf") {
                fs.unlink(file.path, () => {});
                return reject(
                  new Error(`Archivo no permitido: ${file.originalname}`)
                );
              }

              const uuid = crypto.randomUUID();
              const nombreArchivoBase = `${clienteNombre}_${clienteTelefono}_${tipoPapel}_${fechaPedido}_${uuid}`;

              const uploadStream = cloudinary.uploader.upload_stream(
                {
                  resource_type: "raw",
                  folder: carpetaPedido,
                  public_id: nombreArchivoBase,
                  use_filename: false,
                  unique_filename: true,
                },
                (err, result) => {
                  fs.unlink(file.path, () => {}); // borrar archivo temporal
                  if (err) return reject(err);
                  resolve({
                    originalname: file.originalname,
                    nombreSubido: result.public_id,
                    secure_url: result.secure_url,
                    format: result.format,
                  });
                }
              );

              // Subir usando stream desde el archivo local
              fs.createReadStream(file.path).pipe(uploadStream);
            })
        )
      )
    );
    await notificarTelegram({
      cliente: clienteNombre,
      telefono: clienteTelefono,
      carpeta: carpetaPedido,
      archivos: archivosSubidos,
    });

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
