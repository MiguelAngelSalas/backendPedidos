const express = require("express");
const router = express.Router(); // 👈 Inicializamos el enrutador de Express

const { MercadoPagoConfig, Payment } = require("mercadopago");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// ==== EL CONTROLADOR DEL WEBHOOK ====
const webhookMercadoPago = async (req, res, next) => {
  try {
    console.log("📥 Webhook de Mercado Pago recibido:", JSON.stringify(req.query), JSON.stringify(req.body));

    // Capturamos el ID del pago
    const paymentId = req.query.id || req.query["data.id"] || req.body?.data?.id;

    if (paymentId) {
      // 1. Consultamos el estado real del pago a la API de Mercado Pago
      const payment = new Payment(client);
      const dataPago = await payment.get({ id: paymentId });

      console.log(`🔍 Estado del pago ${paymentId}: ${dataPago.status}`);

      // 2. Si el pago fue aprobado, entramos al Sheet a actualizar
      if (dataPago.status === "approved") {
        
        // 🌟 ACÁ ESTÁ LA CORRECCIÓN: Buscamos primero en la metadata para evitar el 'null'
        const clienteNombre = dataPago.metadata?.cliente_nombre || dataPago.payer?.name || dataPago.payer?.first_name; 
        
        console.log(`👤 Buscando registros en Sheets para el cliente: ${clienteNombre}`);

        // Autenticación en Google Sheets
        const serviceAccountAuth = new JWT({
          email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        // 3. Buscamos la fila del pedido usando el Cliente y que esté PENDIENTE
        const filasDelPedido = rows.filter(
          (row) => row.get("Cliente") === clienteNombre && row.get("Estado_Pago") === "PENDIENTE"
        );

        if (filasDelPedido.length === 0) {
          console.log(`⚠️ No se encontraron filas PENDIENTES en el Excel para el cliente: ${clienteNombre}`);
        }

        // 4. Actualizamos el estado en el Excel
        for (const row of filasDelPedido) {
          row.set("Estado_Pago", "APROBADO");
          row.set("Estado_Pedido", "EN_PREPARACION"); 
          await row.save();
        }

        console.log(`💰 Excel Actualizado: Se aprobaron ${filasDelPedido.length} filas para ${clienteNombre}.`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error en Webhook de Mercado Pago:", error);
    res.sendStatus(200); 
  }
};

// ==== LA RUTA DE EXPRESS ====
// Mapeamos el endpoint POST apuntando a la función de arriba
router.post("/webhooks/mercadopago", webhookMercadoPago);

// ⚠️ LA SALVACIÓN: Exportamos el router para que app.js lo entienda
module.exports = router;