
const axios = require("axios");

const BOT_TOKEN = "8305608507:AAFmAuTEB2VObgP9WrGccEKLGyLoCBqe-IM";
const CHAT_ID = "7713272523";

async function notificarTelegram(pedidoData) {
  const mensaje = `
📦 *Nuevo pedido recibido en Cloudinary*
━━━━━━━━━━━━━━━━━━
👤 *Cliente:* ${pedidoData.cliente}
📞 *Teléfono:* ${pedidoData.telefono}
📁 *Carpeta:* ${pedidoData.carpeta}
🗂️ *Archivos subidos:* ${pedidoData.archivos
    .map((a) => `\n- [${a.originalname}](${a.secure_url})`)
    .join("")}
📅 *Fecha:* ${new Date().toLocaleString("es-AR")}

  `;

  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: mensaje,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    });

    console.log("✅ Notificación enviada a Telegram");
  } catch (error) {
    console.error("❌ Error enviando mensaje a Telegram:", error.message);
  }
}

module.exports = notificarTelegram;
