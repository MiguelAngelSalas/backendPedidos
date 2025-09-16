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

// CORS: permitir solo tu frontend
app.use(cors({
  origin: "https://impresionesatucasa.vercel.app",
  methods: ["POST"]
}));

// Crear carpeta temporal si no existe
const tempPath = path.join(__dirname, 'temp');
if (!fs.existsSync(tempPath)) {
  fs.mkdirSync(tempPath);
}

// Configuración Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuración Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'temp/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// Función para contar páginas PDF
const contarPaginas = async (filePath, extension) => {
  if (extension === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.numpages;
  }
  return 1;
};

// Endpoint principal
app.post('/upload', upload.single('file'), async (req, res) => {
  console.log("📥 req.body:", req.body);
  console.log("📎 req.file:", req.file);

  const { paperType, clientName, telefonoCliente, paginas } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ message: 'Falta el archivo PDF.' });
  if (!paperType) return res.status(400).json({ message: 'Falta el tipo de papel.' });
  if (!telefonoCliente) return res.status(400).json({ message: 'Falta el teléfono del cliente.' });

  const filePath = file.path;
  const ext = path.extname(file.originalname).toLowerCase();

  try {
    const totalPaginas = paginas || await contarPaginas(filePath, ext);

    const cleanName = (clientName || 'cliente')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]/g, '');

    const cleanPhone = (telefonoCliente || 'sin_telefono')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]/g, '');

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

    fs.unlink(filePath, (err) => {
      if (err) console.warn('⚠️ No se pudo borrar el archivo temporal:', err);
    });

    const pedido = {
      archivo: result.secure_url,
      tipoPapel: paperType,
      cliente: clientName || 'Sin nombre',
      telefono: telefonoCliente || 'Sin teléfono',
      nombreArchivo: result.public_id,
      paginas: totalPaginas,
    };

    console.log('📦 Pedido recibido:', pedido);
    res.json({ message: 'Pedido recibido correctamente', pedido });
  } catch (error) {
    console.error('❌ Error al procesar el archivo:', error);
    res.status(500).json({ message: 'Error al procesar el archivo.' });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express corriendo en http://localhost:${PORT}`);
});
