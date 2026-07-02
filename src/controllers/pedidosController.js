const crypto = require("crypto");
const notificarTelegram = require("../utilidades/notifiTelegram");

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const { MercadoPagoConfig, Preference } = require("mercadopago");

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

// =======================================================
// CONTROLADORES Y FUNCIONES
// =======================================================

const guardarEnGoogleSheets = async (archivosSubidos, clienteNombre, clienteTelefono, linkPago) => {
  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    for (const archivo of archivosSubidos) {
      await sheet.addRow({
        ID_Pedido: crypto.randomUUID(),
        Cliente: clienteNombre,
        Telefono: clienteTelefono,
        Tipo_Papel: archivo.tipoPapel,
        Cantidad_de_copias: archivo.cantidad,
        Estado_Pago: "PENDIENTE",
        Estado_Pedido: "RECIBIDO",
        Fecha: new Date().toLocaleDateString("es-AR"),
        Archivo_URL: archivo.secure_url,
        linkPagoMp: linkPago
      });
    }
    console.log("✅ [SHEETS] Pedido registrado correctamente.");
  } catch (error) {
    console.error("❌ [SHEETS ERROR]:", error);
  }
};

const crearPedido = async (req, res, next) => {
  try {
    const { cliente, telefono, pedido } = req.body;
    if (!cliente || !telefono || !pedido) return res.status(400).json({ error: "Faltan datos." });

    let itemsCarrito = typeof pedido === 'string' ? JSON.parse(pedido).items : pedido.items;
    const clienteNombre = cliente.trim().replace(/\s+/g, "_");
    const clienteTelefono = telefono.trim().replace(/\s+/g, "_");

    const archivosSubidos = itemsCarrito
      .filter((item) => item.detalles?.tipo === "impresion")
      .map((item) => ({
        tipoPapel: item.detalles.papel || "desconocido",
        cantidad: item.cantidad || 1,
        secure_url: `pub-fc415dccb44a4362a6b9e0e64bafd4b4.r2.dev/${item.detalles.archivo}`
      }));

    // 1. Notificación Telegram (Independiente)
    try {
      await notificarTelegram({ cliente: clienteNombre, telefono: clienteTelefono, archivos: archivosSubidos });
    } catch (e) { console.error("❌ [TELEGRAM ERROR]:", e); }

    // 2. Mercado Pago
    const preference = new Preference(client);
    const responseMP = await preference.create({
      body: {
        items: itemsCarrito.map(i => ({ title: i.name, quantity: i.cantidad, unit_price: Number(i.price), currency_id: "ARS" })),
        back_urls: { success: "https://impresionesatucasa.com.ar", failure: "https://impresionesatucasa.com.ar", pending: "https://impresionesatucasa.com.ar" },
        auto_return: "approved",
        notification_url: "https://backendpedidos.onrender.com/api/mercadoPago/webhooks/mercadopago"
      },
    });

    // 3. Google Sheets (Independiente)
    await guardarEnGoogleSheets(archivosSubidos, clienteNombre, clienteTelefono, responseMP.init_point);

    res.json({ mensaje: "✅ Pedido registrado", initPoint: responseMP.init_point });
  } catch (err) {
    console.error("❌ [ERROR CRÍTICO]:", err);
    res.status(500).json({ error: "Error interno al procesar el pedido." });
  }
};

module.exports = { generarFirmaSubida: (req, res) => { /* Tu lógica de R2 */ }, crearPedido };