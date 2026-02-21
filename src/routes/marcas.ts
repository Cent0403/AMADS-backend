import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('catalogo_editar'));

router.get('/', async (req, res) => {
  try {
    const soloActivos = req.query.activo !== '0';
    const sql = soloActivos
      ? 'SELECT id, nombre, activo FROM marcas WHERE activo = 1 ORDER BY nombre'
      : 'SELECT id, nombre, activo FROM marcas ORDER BY nombre';
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar marcas' });
  }
});

router.post('/', body('nombre').trim().notEmpty(), async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    await pool.query('INSERT INTO marcas (nombre) VALUES (?)', [req.body.nombre]);
    const [r] = await pool.query('SELECT LAST_INSERT_ID() as id');
    const row = (r as { id?: number }[])[0];
    res.status(201).json({ id: row?.id, message: 'Marca creada' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear marca' });
  }
});

router.put('/:id', param('id').isInt(), body('nombre').optional().trim().notEmpty(), body('activo').optional().isBoolean(), async (req: Request, res: Response) => {
  try {
    const id = req.params?.id;
    if (id == null) return res.status(400).json({ error: 'ID inválido' });
    const { nombre, activo } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    if (nombre !== undefined) { updates.push('nombre = ?'); values.push(nombre); }
    if (activo !== undefined) { updates.push('activo = ?'); values.push(activo ? 1 : 0); }
    if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
    values.push(Number(id));
    await pool.query(`UPDATE marcas SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Marca actualizada' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al actualizar marca' });
  }
});

router.delete('/:id', param('id').isInt(), async (req: Request, res: Response) => {
  try {
    const id = req.params?.id;
    if (id == null) return res.status(400).json({ error: 'ID inválido' });
    await pool.query('UPDATE marcas SET activo = 0 WHERE id = ?', [Number(id)]);
    res.json({ message: 'Marca desactivada' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al desactivar marca' });
  }
});

export default router;
