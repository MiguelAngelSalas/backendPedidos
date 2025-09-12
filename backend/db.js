import { createConnection } from 'mysql2';
const db = createConnection({
  host: 'localhost',
  user: 'tu_usuario',
  password: 'tu_contraseña',
  database: 'impresiones',
});