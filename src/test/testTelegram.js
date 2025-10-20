const notificarTelegram = require("../utilidades/notifiTelegram");

(async () => {
  try {
    await notificarTelegram({
      cliente: "Prueba Telegram",
      telefono: "1122334455",
      carpeta: "pedidos/test_manual",
      archivos: [
        {
          originalname: "documento.pdf",
          secure_url: "https://res.cloudinary.com/demo/image/upload/sample.pdf",
        },
      ],
    });
    console.log("✅ Mensaje de prueba enviado correctamente");
  } catch (error) {
    console.error("❌ Error al enviar mensaje de prueba:", error);
  }
})();
