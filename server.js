const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { Readable } = require("stream");
const path = require("path");
const crypto = require("crypto");

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: "https://impresionesatucasa.com.ar",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/pedidos", upload.any(), async (req, res) => {
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
      const pedido = JSON.parse(req.body.pedido);
      tiposPapel = pedido.items
        .filter((item) => item.detalles?.tipo === "impresion")
        .map((item) => item.detalles.papel);
    } catch (err) {
      return res.status(400).json({ error: "Pedido mal formado" });
    }

    if (!cliente || !telefono) {
      return res.status(400).json({ error: "Faltan datos del cliente" });
    }

    if (typeof tiposPapel === "string") {
      tiposPapel = [tiposPapel];
    }

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
      req.files.map((file, idx) => {
        const tipoPapel = tiposPapel[idx] || "desconocido";

        if (file.mimetype !== "application/pdf") {
          throw new Error(`Archivo no permitido: ${file.originalname}`);
        }

        if (!file.buffer || file.buffer.length === 0) {
          throw new Error(`Archivo vacío: ${file.originalname}`);
        }

        const uuid = crypto.randomUUID();
        const nombreArchivoBase = `${clienteNombre}_${clienteTelefono}_${tipoPapel}_${fechaPedido}_${uuid}`;

        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type: "raw",
              folder: carpetaPedido,
              public_id: nombreArchivoBase,
              use_filename: false,
              unique_filename: true,
            },
            (err, result) => {
              if (err) {
                console.error("❌ Error subiendo archivo:", err);
                return reject(err);
              }
              console.log(`📄 Subido: ${file.originalname} como ${tipoPapel}`);
              resolve({
                originalname: file.originalname,
                nombreSubido: result.public_id,
                secure_url: result.secure_url,
                public_id: result.public_id,
                format: result.format,
              });
            }
          );

          const readable = new Readable();
          readable._read = () => {};
          readable.push(file.buffer);
          readable.push(null);
          readable.pipe(uploadStream);
        });
      })
    );

    return res.json({
      mensaje: "✅ Pedido recibido y archivos subidos correctamente",
      cliente: clienteNombre,
      telefono: clienteTelefono,
      carpeta: carpetaPedido,
      archivos: archivosSubidos,
    });
  } catch (err) {
    console.error("❌ Error en /api/pedidos:", err);
    return res.status(500).json({ error: "Error procesando pedido" });
  }
});

app.listen(PORT,"0.0.0.0", () => {
  console.log(`🚀 Backend listo. Railway lo expone públicamente en su dominio.`);
});
