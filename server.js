const dotenv = require("dotenv");
dotenv.config();

const app = require("./app");

const PORT = process.env.PORT || 3001;

console.log("🌐 process.env.PORT:", process.env.PORT);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend escuchando en el puerto ${PORT}`);
});


