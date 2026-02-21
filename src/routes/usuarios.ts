import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, param, validationResult } from 'express-validator';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('usuarios_gestionar'));

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.nombre, u.apellido, u.activo, u.rol_id, u.created_at, r.nombre as rol
       FROM usuarios u JOIN roles r ON u.rol_id = r.id ORDER BY u.id`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

router.get('/roles', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nombre, descripcion FROM roles WHERE nombre != ?', ['administrador']);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar roles' });
  }
});

const validarUsuario = [
  body('email').isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 6 }),
  body('nombre').trim().notEmpty(),
  body('apellido').optional().trim(),
  body('rol_id').isInt({ min: 1 }),
];

router.post('/', validarUsuario, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, nombre, apellido, rol_id } = req.body;
    const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if ((existe as any[]).length > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese correo' });
    }

    const hash = await bcrypt.hash(password || 'Temp123!', 10);
    await pool.query(
      'INSERT INTO usuarios (email, password_hash, nombre, apellido, rol_id) VALUES (?, ?, ?, ?, ?)',
      [email, hash, nombre, apellido || null, rol_id]
    );
    const [inserted] = await pool.query('SELECT LAST_INSERT_ID() as id');
    res.status(201).json({ id: (inserted as any[])[0].id, message: 'Usuario creado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.put(
  '/:id',
  param('id').isInt(),
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 6 }),
  body('nombre').optional().trim().notEmpty(),
  body('apellido').optional().trim(),
  body('rol_id').optional().isInt({ min: 1 }),
  body('activo').optional().isBoolean(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const id = Number(req.params?.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
      const { email, password, nombre, apellido, rol_id, activo } = req.body;

      if (email) {
        const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, id]);
        if ((existe as any[]).length > 0) return res.status(400).json({ error: 'Ya existe un usuario con ese correo' });
      }

      const updates: string[] = [];
      const values: any[] = [];
      if (email !== undefined) { updates.push('email = ?'); values.push(email); }
      if (password) { updates.push('password_hash = ?'); values.push(await bcrypt.hash(password, 10)); }
      if (nombre !== undefined) { updates.push('nombre = ?'); values.push(nombre); }
      if (apellido !== undefined) { updates.push('apellido = ?'); values.push(apellido); }
      if (rol_id !== undefined) { updates.push('rol_id = ?'); values.push(rol_id); }
      if (activo !== undefined) { updates.push('activo = ?'); values.push(activo ? 1 : 0); }

      if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
      values.push(id);
      await pool.query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, values);
      res.json({ message: 'Usuario actualizado' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al actualizar usuario' });
    }
  }
);

router.delete('/:id', param('id').isInt(), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params?.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
    const [rows] = await pool.query('SELECT r.nombre as rol FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = ?', [id]);
    const u = (rows as { rol?: string }[])[0];
    if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (u.rol === 'administrador') return res.status(403).json({ error: 'No se puede eliminar al administrador' });
    await pool.query('UPDATE usuarios SET activo = 0 WHERE id = ?', [id]);
    res.json({ message: 'Usuario desactivado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

export default router;
