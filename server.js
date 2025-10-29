const dotenv = require("dotenv");
dotenv.config();

const app = require("./app");

const PORT = process.env.PORT || 3001;

console.log("🌍 ENV:", {
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
});

console.log("🌐 process.env.PORT:", process.env.PORT);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend escuchando en el puerto ${PORT}`);
});




