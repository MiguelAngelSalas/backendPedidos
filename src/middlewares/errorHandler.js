function errorHandler(err, req, res, next) {
  console.error("❌ Error atrapado en middleware:");

  // Mostrar el objeto completo si no tiene propiedades esperadas
  if (!err || (!err.message && !err.stack)) {
    console.error("🧠 Error sin propiedades estándar:", err);
  } else {
    console.error("🧠 Mensaje:", err.message);
    console.error("📄 Stack:", err.stack);
  }

  // Manejo específico si el mensaje contiene "Archivo"
  if (err?.message?.includes("Archivo")) {
    return res.status(400).json({ error: err.message });
  }

  // Respuesta genérica
  res.status(500).json({ error: "Error procesando la solicitud" });
}
