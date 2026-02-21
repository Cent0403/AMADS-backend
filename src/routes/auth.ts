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
        if (user.rol === 'administrador') permisos = ['catalogo_ver', 'catalogo_editar', 'entrada_inventario', 'proveedores_ver', 'proveedores_editar', 'usuarios_gestionar', 'permisos_asignar', 'reportes_ver'];
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

router.put(
  '/perfil',
  requireAuth,
  [body('nombre').optional().trim().notEmpty(), body('apellido').optional().trim()],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const user = (req as Request & { user?: { userId: number } }).user;
      if (!user) return res.status(401).json({ error: 'No autorizado' });

      const { nombre, apellido } = req.body;
      const updates: string[] = [];
      const values: any[] = [];
      if (nombre !== undefined) { updates.push('nombre = ?'); values.push(nombre); }
      if (apellido !== undefined) { updates.push('apellido = ?'); values.push(apellido || null); }
      if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
      values.push(user.userId);
      await pool.query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, values);
      res.json({ message: 'Perfil actualizado' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al actualizar perfil' });
    }
  }
);

router.post(
  '/registro-cliente',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
    body('apellido').optional().trim(),
    body('telefono').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password, nombre, apellido, telefono } = req.body;

      const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
      if ((existe as any[]).length > 0) {
        return res.status(400).json({ error: 'Ese correo ya está registrado' });
      }

      let [rolCliente] = await pool.query("SELECT id FROM roles WHERE nombre = 'cliente'");
      let rolId = (rolCliente as any[])[0]?.id;
      if (!rolId) {
        await pool.query("INSERT INTO roles (nombre, descripcion) VALUES ('cliente', 'Cliente del sistema')");
        const [inserted] = await pool.query("SELECT id FROM roles WHERE nombre = 'cliente'");
        rolId = (inserted as any[])[0]?.id;
      }
      if (!rolId) {
        return res.status(500).json({ error: 'Rol cliente no configurado. Contacte al administrador.' });
      }

      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id, activo) VALUES (?, ?, ?, ?, ?, 1)',
        [email, hash, nombre.trim(), apellido?.trim() || null, rolId]
      );
      res.status(201).json({ message: 'Cuenta creada correctamente' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al registrar' });
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
      if (u.rol === 'administrador') permisos = ['catalogo_ver', 'catalogo_editar', 'entrada_inventario', 'proveedores_ver', 'proveedores_editar', 'usuarios_gestionar', 'permisos_asignar', 'reportes_ver'];
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
