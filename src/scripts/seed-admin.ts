import bcrypt from 'bcryptjs';
import pool from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  try {
    const hash = await bcrypt.hash('Admin123!', 10);
    const [existing] = await pool.query('SELECT id FROM usuarios WHERE email = ?', ['admin@amads.com']);
    if ((existing as any[]).length > 0) {
      await pool.query('UPDATE usuarios SET password_hash = ? WHERE email = ?', [hash, 'admin@amads.com']);
      console.log('Contraseña de admin actualizada.');
    } else {
      await pool.query(
        'INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id) VALUES (?, ?, ?, ?, 1)',
        ['admin@amads.com', hash, 'Administrador', 'Sistema']
      );
      console.log('Usuario admin creado: admin@amads.com / Admin123!');
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

seed();
