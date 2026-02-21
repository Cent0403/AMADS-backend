import { Router, Request, Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

export interface Permiso {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

router.get('/permisos', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, codigo, nombre, descripcion FROM permisos ORDER BY codigo');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar permisos' });
  }
});

router.get('/roles', async (_req, res) => {
  try {
    const [roles] = await pool.query('SELECT id, nombre, descripcion FROM roles ORDER BY id');
    const [permisosByRol] = await pool.query(
      'SELECT rol_id, permiso_id FROM rol_permiso'
    );
    const map = (permisosByRol as { rol_id: number; permiso_id: number }[]).reduce(
      (acc, row) => {
        if (!acc[row.rol_id]) acc[row.rol_id] = [];
        acc[row.rol_id].push(row.permiso_id);
        return acc;
      },
      {} as Record<number, number[]>
    );
    const result = (roles as { id: number; nombre: string; descripcion: string | null }[]).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      permiso_ids: map[r.id] || [],
    }));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar roles' });
  }
});

router.put(
  '/roles/:id/permisos',
  requirePermission('permisos_asignar'),
  param('id').isInt(),
  body('permiso_ids').isArray(),
  body('permiso_ids.*').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const rolId = Number(req.params.id);
      const [rows] = await pool.query('SELECT nombre FROM roles WHERE id = ?', [rolId]);
      const rol = (rows as { nombre: string }[])?.[0];
      if (!rol || rol.nombre === 'administrador') {
        return res.status(403).json({ error: 'No se pueden editar los permisos del rol administrador.' });
      }
      const permisoIds = req.body.permiso_ids as number[];
      await pool.query('DELETE FROM rol_permiso WHERE rol_id = ?', [rolId]);
      if (permisoIds.length > 0) {
        const values = permisoIds.map((pid) => [rolId, pid]);
        await pool.query(
          'INSERT INTO rol_permiso (rol_id, permiso_id) VALUES ?',
          [values]
        );
      }
      res.json({ message: 'Permisos del rol actualizados' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al actualizar permisos del rol' });
    }
  }
);

export default router;
