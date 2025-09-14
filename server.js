const express = require('express');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

dotenv.config();
const app = express();

// Configurar CORS para tu dominio
app.use(cors({
  origin: "https://impresionesatucasa.vercel.app", // Cambiá por tu dominio real
  methods: ["GET", "POST"]
}));

const PORT = process.env.PORT || 3001;

// Crear carpeta temporal si no existe
const tempPath = path.join(__dirname, 'temp');
if (!fs.existsSync(tempPath)) {
  fs.mkdirSync(tempPath);
}

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuración de multer para subir archivos temporalmente
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'temp/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// Endpoint principal de subida (solo PDF)
app.post('/upload', upload.single('file'), async (req, res) => {
  const { paperType, clientName } = req.body;

  if (!req.file || !paperType) {
    return res.status(400).json({ message: 'Faltan datos: archivo o tipo de papel.' });
  }

  // Verificar que el archivo sea PDF
  if (req.file.mimetype !== 'application/pdf') {
    // Eliminar archivo temporal
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'Solo se permiten archivos PDF.' });
  }

  try {
    // Sanitizar nombre del cliente y generar ID único
    const cleanName = (clientName || 'cliente').trim().replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const uniqueName = `${cleanName}-${uuidv4()}`;
    const timestamp = Date.now();
    const publicId = `${uniqueName}-${paperType}-${timestamp}`;

    // Subir a Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'auto',
        folder: 'pedidos',
        public_id: publicId,
        use_filename: false, 
        unique_filename: false, 
        overwrite: true,
    });

    // Eliminar archivo temporal
    fs.unlinkSync(req.file.path);

    // Placeholder: contar páginas PDF (aquí podrías agregar librería si quieres)
    const pages = 1;
    const price = pages * 10; // Precio ejemplo

    const pedido = {
      archivo: result.secure_url,
      tipoPapel: paperType,
      cliente: clientName || 'Sin nombre',
      nombreArchivo: result.public_id,
      pages,
      price,
    };

    console.log('📦 Pedido recibido:', pedido);
    
    res.json({ message: 'Pedido recibido correctamente', pedido });
  } catch (error) {
    console.error('❌ Error al subir a Cloudinary:', error);
    res.status(500).json({ message: 'Error al procesar el archivo.' });
  }
});

// Endpoint de prueba
app.get("/ping", (req, res) => {
  res.send("pong");
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express corriendo en http://localhost:${PORT}`);
});
