function errorHandler(err, req, res, next) {
  console.error("❌ Error:", err);

  if (err.message?.includes("Archivo")) {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: "Error procesando la solicitud" });
}

module.exports = errorHandler;
