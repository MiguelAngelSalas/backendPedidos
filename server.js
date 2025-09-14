const express = require('express');
const multer = require('multer');
const cors = require('cors');
const dotenv = require('dotenv');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Agregado para generar UUIDs

dotenv.config();
const app = express();
app.use(cors());
const PORT = process.env.PORT || 3001;

// Asegurarse de que la carpeta temporal exista
const tempPath = path.join(__dirname, 'temp');
if (!fs.existsSync(tempPath)) {
  fs.mkdirSync(tempPath);
}

// Configuración Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configuración multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'temp/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// Endpoint principal
app.post('/upload', upload.single('file'), async (req, res) => {
  const { paperType, clientName } = req.body;
  console.log('BODY:', req.body);
  console.log('FILE:', req.file);

  if (!req.file || !paperType) {
    return res.status(400).json({ message: 'Faltan datos: archivo o tipo de papel.' });
  }

  try {
    // Sanitizar nombre del cliente y usar UUID para garantizar unicidad
    const cleanName = (clientName || 'cliente').trim().replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    const uniqueName = cleanName + '-' + uuidv4(); // Generamos un UUID único

    const timestamp = Date.now();
    const publicId = `${uniqueName}-${paperType}-${timestamp}`;

    // Subir a Cloudinary con el nuevo nombre
    const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'auto',
        folder: 'pedidos',
        public_id: publicId,
        use_filename: false,   // No usar el nombre original
        unique_filename: false,  // Usamos un public_id personalizado
        overwrite: true,
    });

    // Eliminar archivo temporal
    fs.unlinkSync(req.file.path);

    // Crear la respuesta con la URL del archivo subido
    const pedido = {
      archivo: result.secure_url,
      tipoPapel: paperType,
      cliente: clientName || 'Sin nombre',
      nombreArchivo: result.public_id,
    };

    console.log('📦 Pedido recibido:', pedido);
    
    res.json({ message: 'Pedido recibido correctamente', pedido });
  } catch (error) {
    console.error('❌ Error al subir a Cloudinary:', error);
    res.status(500).json({ message: 'Error al procesar el archivo.' });
  }
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

app.listen(PORT, () => {
      console.log(`🚀 Servidor Express corriendo en http://localhost:${PORT}`);
    });
