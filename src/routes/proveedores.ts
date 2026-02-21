import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const proveedoresVer = requirePermission('proveedores_ver');
const proveedoresEditar = requirePermission('proveedores_editar');

router.get('/', proveedoresVer, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, contacto, telefono, email, direccion, terminos_pago, activo, created_at FROM proveedores ORDER BY nombre'
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar proveedores' });
  }
});

router.get('/:id/productos-disponibles', proveedoresEditar, param('id').isInt(), async (req: Request, res: Response) => {
  try {
    const id = req.params?.id;
    if (id == null) return res.status(400).json({ error: 'ID inválido' });
    const [rows] = await pool.query(
      `SELECT p.id, p.codigo, p.modelo, m.nombre as marca, cp.nombre as categoria
       FROM productos p
       JOIN marcas m ON p.marca_id = m.id
       JOIN categorias_producto cp ON p.categoria_id = cp.id
       WHERE p.activo = 1
       AND p.id NOT IN (SELECT producto_id FROM proveedor_productos WHERE proveedor_id = ?)
       ORDER BY m.nombre, p.modelo`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar productos disponibles' });
  }
});

router.get('/:id/productos', proveedoresVer, param('id').isInt(), async (req: Request, res: Response) => {
  try {
    const id = req.params?.id;
    if (id == null) return res.status(400).json({ error: 'ID inválido' });
    const [rows] = await pool.query(
      `SELECT p.id, p.codigo, p.modelo, m.nombre as marca, cp.nombre as categoria
       FROM proveedor_productos pp
       JOIN productos p ON pp.producto_id = p.id
       JOIN marcas m ON p.marca_id = m.id
       JOIN categorias_producto cp ON p.categoria_id = cp.id
       WHERE pp.proveedor_id = ?`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar productos del proveedor' });
  }
});

router.get('/:id/compras', proveedoresVer, param('id').isInt(), async (req: Request, res: Response) => {
  try {
    const id = req.params?.id;
    if (id == null) return res.status(400).json({ error: 'ID inválido' });
    const [rows] = await pool.query(
      `SELECT c.id, c.fecha_compra, c.total, c.observaciones, c.created_at, u.nombre as usuario_nombre
       FROM compras c LEFT JOIN usuarios u ON c.usuario_id = u.id WHERE c.proveedor_id = ? ORDER BY c.fecha_compra DESC`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar historial de compras' });
  }
});

router.get('/:id', proveedoresVer, param('id').isInt(), async (req: Request, res: Response) => {
  try {
    const id = req.params?.id;
    if (id == null) return res.status(400).json({ error: 'ID inválido' });
    const [rows] = await pool.query('SELECT * FROM proveedores WHERE id = ?', [id]);
    const p = (rows as any[])[0];
    if (!p) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(p);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener proveedor' });
  }
});

const validarProveedor = [
  body('nombre').trim().notEmpty(),
  body('contacto').optional().trim(),
  body('telefono').optional().trim(),
  body('email').optional().trim(),
  body('direccion').optional().trim(),
  body('terminos_pago').optional().trim(),
];

router.post('/', proveedoresEditar, validarProveedor, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { nombre, contacto, telefono, email, direccion, terminos_pago } = req.body;
    const [r] = await pool.query(
      'INSERT INTO proveedores (nombre, contacto, telefono, email, direccion, terminos_pago) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, contacto || null, telefono || null, email || null, direccion || null, terminos_pago || null]
    );
    const id = (r as any).insertId;
    res.status(201).json({ id, message: 'Proveedor creado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

router.put(
  '/:id',
  proveedoresEditar,
  param('id').isInt(),
  body('nombre').optional().trim().notEmpty(),
  body('contacto').optional().trim(),
  body('telefono').optional().trim(),
  body('email').optional().trim(),
  body('direccion').optional().trim(),
  body('terminos_pago').optional().trim(),
  body('activo').optional().isBoolean(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const id = Number(req.params?.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
      const { nombre, contacto, telefono, email, direccion, terminos_pago, activo } = req.body;
      const updates: string[] = [];
      const values: any[] = [];
      if (nombre !== undefined) { updates.push('nombre = ?'); values.push(nombre); }
      if (contacto !== undefined) { updates.push('contacto = ?'); values.push(contacto); }
      if (telefono !== undefined) { updates.push('telefono = ?'); values.push(telefono); }
      if (email !== undefined) { updates.push('email = ?'); values.push(email); }
      if (direccion !== undefined) { updates.push('direccion = ?'); values.push(direccion); }
      if (terminos_pago !== undefined) { updates.push('terminos_pago = ?'); values.push(terminos_pago); }
      if (activo !== undefined) { updates.push('activo = ?'); values.push(activo ? 1 : 0); }
      if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
      values.push(id);
      await pool.query(`UPDATE proveedores SET ${updates.join(', ')} WHERE id = ?`, values);
      res.json({ message: 'Proveedor actualizado' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
  }
);

router.post('/:id/productos', proveedoresEditar, param('id').isInt(), body('producto_id').isInt(), async (req: Request, res: Response) => {
  try {
    const id = req.params?.id;
    if (id == null) return res.status(400).json({ error: 'ID inválido' });
    const { producto_id } = req.body;
    await pool.query('INSERT IGNORE INTO proveedor_productos (proveedor_id, producto_id) VALUES (?, ?)', [id, producto_id]);
    res.json({ message: 'Producto asociado al proveedor' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al asociar producto' });
  }
});

router.delete('/:id/productos/:productoId', proveedoresEditar, param('id').isInt(), param('productoId').isInt(), async (req: Request, res: Response) => {
  try {
    const id = req.params?.id;
    const productoId = req.params?.productoId;
    if (id == null || productoId == null) return res.status(400).json({ error: 'Parámetros inválidos' });
    await pool.query('DELETE FROM proveedor_productos WHERE proveedor_id = ? AND producto_id = ?', [id, productoId]);
    res.json({ message: 'Producto desasociado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al desasociar producto' });
  }
});

router.delete('/:id', proveedoresEditar, param('id').isInt(), async (req: Request, res: Response) => {
  try {
    const id = req.params?.id;
    if (id == null) return res.status(400).json({ error: 'ID inválido' });
    await pool.query('UPDATE proveedores SET activo = 0 WHERE id = ?', [Number(id)]);
    res.json({ message: 'Proveedor desactivado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al desactivar proveedor' });
  }
});

export default router;
