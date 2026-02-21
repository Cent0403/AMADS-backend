import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password } = req.body;
      const [rows] = await pool.query(
        `SELECT u.id, u.email, u.password_hash, u.nombre, u.apellido, u.activo, u.rol_id, r.nombre as rol
         FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.email = ?`,
        [email]
      );
      const user = (rows as any[])[0];
      if (!user || !user.activo) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

      let permisos: string[] = [];
      try {
        const [permRows] = await pool.query(
          'SELECT p.codigo FROM rol_permiso rp JOIN permisos p ON rp.permiso_id = p.id WHERE rp.rol_id = ?',
          [user.rol_id]
        );
        permisos = (permRows as { codigo: string }[]).map((r) => r.codigo);
      } catch {
        if (user.rol === 'administrador') permisos = ['catalogo_ver', 'catalogo_editar', 'entrada_inventario', 'proveedores_ver', 'proveedores_editar', 'usuarios_gestionar', 'permisos_asignar'];
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, rol: user.rol },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '8h' }
      );
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido,
          rol: user.rol,
          permisos,
        },
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error en el servidor' });
    }
  }
);

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { user?: { userId: number } }).user;
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.nombre, u.apellido, u.activo, u.rol_id, r.nombre as rol
       FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = ?`,
      [user.userId]
    );
    const u = (rows as any[])[0];
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    let permisos: string[] = [];
    try {
      const [permRows] = await pool.query(
        'SELECT p.codigo FROM rol_permiso rp JOIN permisos p ON rp.permiso_id = p.id WHERE rp.rol_id = ?',
        [u.rol_id]
      );
      permisos = (permRows as { codigo: string }[]).map((r) => r.codigo);
    } catch {
      if (u.rol === 'administrador') permisos = ['catalogo_ver', 'catalogo_editar', 'entrada_inventario', 'proveedores_ver', 'proveedores_editar', 'usuarios_gestionar', 'permisos_asignar'];
    }
    res.json({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      apellido: u.apellido,
      rol: u.rol,
      activo: !!u.activo,
      permisos,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

export default router;
