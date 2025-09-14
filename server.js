const express = require('express');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

dotenv.config();
const app = express();

// Configuración CORS
app.use(cors({
  origin: "https://impresionesatucasa.vercel.app", // reemplazá con tu dominio real
  methods: ["GET", "POST"]
}));

const PORT = process.env.PORT || 3001;

// Crear carpeta temporal si no existe
const tempPath = path.join(__dirname, 'temp');
if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath);

// Configuración Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuración Multer para archivos temporales
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'temp/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// Endpoint para subir PDF
app.post('/upload', upload.single('file'), async (req, res) => {
  const { paperType, clientName } = req.body;

  if (!req.file || !paperType) {
    return res.status(400).json({ message: 'Faltan datos: archivo o tipo de papel.' });
  }

  // Verificar que sea PDF
  if (req.file.mimetype !== 'application/pdf') {
    fs.unlinkSync(req.file.path); // eliminar temporal
    return res.status(400).json({ message: 'Solo se permiten archivos PDF.' });
  }

  try {
    // Leer PDF y contar páginas
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const totalPages = pdfData.numpages;

    // Subir a Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: 'auto',
      folder: 'pedidos',
      public_id: `${Date.now()}-${paperType}`,
    });

    // Borrar archivo temporal
    fs.unlinkSync(req.file.path);

    // Enviar respuesta al frontend
    res.json({
      message: 'Pedido recibido correctamente',
      totalPages: totalPages,
      archivoURL: result.secure_url,
    });

  } catch (error) {
    console.error('Error al procesar el PDF:', error);
    fs.unlinkSync(req.file.path); // borrar temporal si hubo error
    res.status(500).json({ message: 'Error al procesar el archivo.' });
  }
});

// Endpoint de prueba
app.get("/ping", (req, res) => res.send("pong"));

// Levantar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});