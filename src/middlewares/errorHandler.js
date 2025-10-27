function errorHandler(err, req, res, next) {
  console.error("❌ Error atrapado en middleware:");

  if (err instanceof Error) {
    console.error("🧠 Mensaje:", err.message);
    console.error("📄 Stack:", err.stack);
  } else {
    console.error("🧠 Error no estándar:", err);
  }

  const mensaje = err?.message || (typeof err === "string" ? err : "Error desconocido");

  if (mensaje.includes("Archivo")) {
    return res.status(400).json({ error: mensaje });
  }

  res.status(500).json({ error: "Error procesando la solicitud" });
}

module.exports = errorHandler;
