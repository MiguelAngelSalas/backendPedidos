const crypto = require("crypto");
const notificarTelegram = require("../utilidades/notifiTelegram");

// LIBRERÍAS PARA AWS S3 / CLOUDFLARE R2
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// LIBRERÍAS PARA GOOGLE SHEETS
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

// LIBRERÍAS PARA MERCADO PAGO
const { MercadoPagoConfig, Preference } = require("mercadopago");

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// =======================================================
// CONFIGURACIÓN DE CLOUDFLARE R2
// =======================================================
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  // 1. Fuerza el formato de URL que le gusta a Cloudflare
  forcePathStyle: true, 
  // 2. Apaga el bug de la firma de archivo vacío ("AAAAAA==")
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

// =======================================================
// 1. CONTROLADOR: GENERAR FIRMA DE SUBIDA (R2)
// =======================================================
const generarFirmaSubida = async (req, res) => {
  try {
    const { nombreArchivo, tipoArchivo } = req.body;

    if (!nombreArchivo || !tipoArchivo) {
      return res.status(400).json({ error: "Faltan datos del archivo." });
    }

    const nombreLimpio = nombreArchivo.replace(/\s+/g, '_');
    const fileKey = `pedidos/${Date.now()}_${nombreLimpio}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: tipoArchivo,
    });

    const urlFirma = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    res.status(200).json({ urlFirma, fileKey });
  } catch (error) {
    console.error("❌ [R2 ERROR] Error al generar firma:", error);
    res.status(500).json({ error: "Hubo un problema al autorizar la subida." });
  }
};

// =======================================================
// FUNCIÓN AUXILIAR: GOOGLE SHEETS
// =======================================================
const guardarEnGoogleSheets = async (archivosSubidos, clienteNombre, clienteTelefono) => {
  try {
    console.log("\n📊 [SHEETS] Iniciando inserción en Google Sheets...");
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; 

    console.log(`📊 [SHEETS] Conectado. Procesando ${archivosSubidos.length} archivo(s)...`);

    for (const archivo of archivosSubidos) {
      const idPedido = crypto.randomUUID(); 

      console.log(`✍️ [SHEETS] Agregando fila para el cliente: ${clienteNombre} | ID: ${idPedido}`);
      
      await sheet.addRow({
        ID_Pedido: idPedido,
        Cliente: clienteNombre,
        Telefono: clienteTelefono,
        Tipo_Papel: archivo.tipoPapel, // Ahora lo sacamos directo del objeto limpio
        Estado_Pago: "PENDIENTE", 
        Estado_Pedido: "RECIBIDO", 
        Fecha: new Date().toLocaleDateString("es-AR"),
        Archivo_URL: archivo.secure_url
      });
    }
    console.log("✅ [SHEETS] Pedido registrado exitosamente\n");
  } catch (error) {
    console.error("❌ [SHEETS ERROR] Error al escribir en Google Sheets:", error);
  }
};

// =======================================================
// 2. CONTROLADOR: CREAR PEDIDO
// =======================================================
const crearPedido = async (req, res, next) => {
  try {
    console.log("\n=======================================================");
    console.log("📦 [NUEVO PEDIDO] Petición liviana recibida en /api/pedidos");
    console.log("=======================================================");

    // LOG DE DEPURACIÓN CLAVE: Verificamos qué está llegando exactamente
    console.log("🔍 BODY COMPLETO RECIBIDO:", req.body);

    const { cliente, telefono, pedido } = req.body;

    if (!cliente || !telefono || !pedido) {
      console.log("⚠️ [ALERTA] Faltan datos obligatorios.");
      return res.status(400).json({ error: "Faltan datos del cliente o pedido." });
    }

    console.log(`👤 Cliente: "${cliente}" | Teléfono: "${telefono}"`);

    // El frontend ahora nos manda un JSON listo, pero atajamos por si llega como string
    let itemsCarrito = [];
    if (typeof pedido === 'string') {
      itemsCarrito = JSON.parse(pedido).items || [];
    } else {
      itemsCarrito = pedido.items || [];
    }

    if (itemsCarrito.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío." });
    }

    console.log(`🛒 Items detectados en carrito: ${itemsCarrito.length}`);

    // Normalización de datos para el reporte
    const clienteNombre = cliente.trim().replace(/\s+/g, "_");
    const clienteTelefono = telefono.trim().replace(/\s+/g, "_");
    const carpetaPedido = `pedidos_${clienteNombre}_${Date.now()}`;

    // Armamos el arreglo de archivos basado en las rutas que devolvió Cloudflare (fileKey)
    const archivosSubidos = itemsCarrito
      .filter((item) => item.detalles?.tipo === "impresion")
      .map((item) => {
        const fileKey = item.detalles.archivo; // Ej: "pedidos/123_apunte.pdf"
        return {
          originalname: fileKey.split('/').pop(),
          fileKey: fileKey,
          tipoPapel: item.detalles.papel || "desconocido",
          // Nota: Reemplazá 'pub-xxx.r2.dev' por tu dominio público de R2 si lo activaste
          secure_url: `pub-fc415dccb44a4362a6b9e0e64bafd4b4.r2.dev/${fileKey}`
        };
      });

    console.log("✉️ [TELEGRAM] Enviando reporte al bot...");
    await notificarTelegram({
      cliente: clienteNombre,
      telefono: clienteTelefono,
      carpeta: carpetaPedido,
      archivos: archivosSubidos,
    });
    console.log("✅ [TELEGRAM] Notificación enviada.");

    // MAPEAR ITEMS PARA MERCADO PAGO
    console.log("💳 [MERCADO PAGO] Estructurando items de la pasarela...");
    const itemsMercadoPago = itemsCarrito.map((item) => {
      let precioFinalUnitario = item.price || item.precioUnitario || 0; 
      const cantidad = item.cantidad || 1;

      return {
        id: item.id || "impresion",
        title: item.name || "Servicio de impresion",
        quantity: cantidad,
        unit_price: Number(precioFinalUnitario),
        currency_id: "ARS",
      };
    });

    // INYECTAR DATOS EN GOOGLE SHEETS
    await guardarEnGoogleSheets(archivosSubidos, clienteNombre, clienteTelefono);

    // PREFERENCIA DE MERCADO PAGO
    console.log("🔗 [MERCADO PAGO] Solicitando creación de preferencia...");
    const preference = new Preference(client);
    
    const responseMP = await preference.create({
      body: {
        items: itemsMercadoPago,
        payer: {
          name: clienteNombre,
          phone: {
            number: clienteTelefono,
          },
        },
        // ===== ACÁ ESTÁ LA MAGIA DE PRODUCCIÓN =====
        back_urls: {
          success: "https://impresionesatucasa.com.ar",
          failure: "https://impresionesatucasa.com.ar",
          pending: "https://impresionesatucasa.com.ar",
        },
        auto_return: "approved", 
        notification_url: "https://backendpedidos.onrender.com/api/mercadoPago/webhooks/mercadopago",
        // ===========================================
        metadata: {
          cliente_nombre: clienteNombre
        }
      },
    });

    console.log(`✨ [MERCADO PAGO] Preferencia generada con éxito.`);
    console.log(`🔗 Init Point: ${responseMP.init_point}`);
    console.log("=======================================================\n");

    res.json({
      mensaje: "✅ Pedido registrado correctamente",
      cliente: clienteNombre,
      telefono: clienteTelefono,
      archivos: archivosSubidos,
      initPoint: responseMP.init_point,
    });
  } catch (err) {
    console.error("\n❌ [ERROR CRÍTICO EN CREAR PEDIDO]:", err);
    next(err);
  }
};

// Exportamos bajo el formato CommonJS, sacando 'upload'
module.exports = { 
  generarFirmaSubida, 
  crearPedido 
};