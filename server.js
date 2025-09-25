// backend/index.js

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

// ✅ Middleware CORS (ajustá dominios si necesitás)
app.use(cors({
  origin: ['http://localhost:3000', 'https://impresionesatucasa.com.ar'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// ✅ Middleware JSON
app.use(express.json());

// ✅ Endpoint de prueba
app.get("/", (req, res) => {
  res.send("🟢 Backend funcionando correctamente");
});

// ✅ Crear carpeta temporal si no existe
const tempPath = path.join(__dirname, 'temp');
if (!fs.existsSync(tempPath)) {
  fs.mkdirSync(tempPath);
}

// ✅ Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Configurar Multer para subir archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'temp/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ✅ Contar páginas PDF
const contarPaginas = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.numpages;
};

// ✅ Endpoint: subir archivo individual
app.post('/upload', upload.single('file'), async (req, res) => {
  const { paperType, clientName, telefonoCliente, paginas } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ message: 'Falta el archivo PDF.' });
  if (!paperType) return res.status(400).json({ message: 'Falta el tipo de papel.' });
  if (!telefonoCliente) return res.status(400).json({ message: 'Falta el teléfono del cliente.' });

  const filePath = file.path;

  try {
    const totalPaginas = paginas || await contarPaginas(filePath);

    const cleanName = (clientName || 'cliente')
      .trim().replace(/\s+/g, '_').replace(/[^\w\-]/g, '');

    const cleanPhone = telefonoCliente
      .trim().replace(/\s+/g, '_').replace(/[^\w\-]/g, '');

    const uniqueName = `${cleanName}-${cleanPhone}-${uuidv4()}`;
    const timestamp = Date.now();
    const publicId = `${uniqueName}-${paperType}-${timestamp}`;

    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: 'auto',
      folder: 'pedidos',
      public_id: publicId,
      context: `telefono=${telefonoCliente}`,
      use_filename: false,
      unique_filename: false,
      overwrite: true,
    });

    // Borrar archivo temporal
    fs.unlink(filePath, (err) => {
      if (err) console.warn('⚠️ No se pudo borrar el archivo temporal:', err);
    });

    const pedido = {
      archivo: result.secure_url,
      tipoPapel: paperType,
      cliente: clientName || 'Sin nombre',
      telefono: telefonoCliente,
      nombreArchivo: result.public_id,
      paginas: totalPaginas,
    };

    console.log('📦 Pedido individual recibido:', pedido);
    res.json({ mensaje: 'Pedido recibido correctamente', pedido });

  } catch (error) {
    console.error('❌ Error al procesar el archivo:', error);
    res.status(500).json({ mensaje: 'Error al procesar el archivo.' });
  }
});

// ✅ Endpoint: recibir carrito completo
app.post('/api/pedidos', async (req, res) => {
  const { cliente, items, total, fecha } = req.body;

  console.log("📥 Pedido recibido:", req.body); // log completo del pedido recibido

  if (!cliente || !items || !Array.isArray(items)) {
    return res.status(400).json({ message: 'Faltan datos del pedido.' });
  }

  try {
    const resumen = {
      id: uuidv4(),
      cliente,
      items,
      total,
      fecha: fecha || new Date().toISOString(),
    };

    console.log("🛒 Pedido completo recibido:", resumen);

    // Aquí podrías guardar en una base de datos si tenés una

    res.json({ mensaje: 'Pedido completo recibido correctamente ✅', pedido: resumen });
  } catch (error) {
    console.error("❌ Error al guardar pedido:", error);
    res.status(500).json({ message: 'Error al guardar el pedido.' });
  }
});

// ✅ Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
