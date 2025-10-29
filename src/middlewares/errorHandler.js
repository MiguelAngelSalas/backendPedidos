function errorHandler(err, req, res, next) {
  console.error("❌ Error atrapado en middleware:");

  let mensaje = "Error desconocido";
  let stack = "Sin stack disponible";

  if (err instanceof Error) {
    mensaje = err.message;
    stack = err.stack;
  } else if (typeof err === "string") {
    mensaje = err;
  } else if (typeof err === "object" && err !== null) {
    try {
      mensaje = JSON.stringify(err);
    } catch (e) {
      mensaje = "Error no serializable";
    }
  }

  console.error("🧠 Mensaje:", mensaje);
  console.error("📄 Stack:", stack);
  console.error("🔎 Error completo:", err);

  if (mensaje.includes("Archivo")) {
    return res.status(400).json({ error: mensaje });
  }

  res.status(500).json({ error: mensaje });
}

module.exports = errorHandler;