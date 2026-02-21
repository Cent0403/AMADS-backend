import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middleware/auth';

const router = Router();

const catalogoVer = [requireAuth, requirePermission('catalogo_ver')];

router.get('/categorias', catalogoVer, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT id, nombre, descripcion FROM categorias_producto');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar categorías' });
  }
});

router.get('/tipos', catalogoVer, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT id, nombre, descripcion FROM tipos_producto');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar tipos' });
  }
});

router.get('/marcas', catalogoVer, async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT id, nombre, activo FROM marcas ORDER BY nombre');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar marcas' });
  }
});

router.get('/stock-bajo', requireAuth, requirePermission('catalogo_ver'), async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT * FROM v_stock_bajo');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener stock bajo' });
  }
});

router.get(
  '/',
  requireAuth,
  requirePermission('catalogo_ver'),
  query('categoria_id').optional().isInt(),
  query('tipo_id').optional().isInt(),
  query('marca_id').optional().isInt(),
  query('activo').optional().isIn(['0', '1']),
  async (req: Request, res: Response) => {
    try {
      const { categoria_id, tipo_id, marca_id, activo } = req.query;
      let sql = `SELECT p.*, m.nombre as marca_nombre, cp.nombre as categoria_nombre, tp.nombre as tipo_nombre
                 FROM productos p
                 JOIN marcas m ON p.marca_id = m.id
                 JOIN categorias_producto cp ON p.categoria_id = cp.id
                 JOIN tipos_producto tp ON p.tipo_producto_id = tp.id WHERE 1=1`;
      const params: any[] = [];
      if (categoria_id) { sql += ' AND p.categoria_id = ?'; params.push(categoria_id); }
      if (tipo_id) { sql += ' AND p.tipo_producto_id = ?'; params.push(tipo_id); }
      if (marca_id) { sql += ' AND p.marca_id = ?'; params.push(marca_id); }
      if (activo !== undefined) { sql += ' AND p.activo = ?'; params.push(Number(activo)); }
      sql += ' ORDER BY p.id DESC';
      const [rows] = await pool.query(sql, params);
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al listar productos' });
    }
  }
);

const validarProducto = [
  body('marca_id').isInt({ min: 1 }),
  body('modelo').trim().notEmpty(),
  body('categoria_id').isInt({ min: 1 }),
  body('tipo_producto_id').isInt({ min: 1 }),
  body('precio_venta').isFloat({ min: 0.01 }).withMessage('Precio debe ser mayor a cero'),
  body('costo').isFloat({ min: 0 }).withMessage('Costo no puede ser negativo'),
  body('stock_minimo').optional().isInt({ min: 0 }).withMessage('Stock mínimo no puede ser negativo'),
  body('medida').optional().trim(),
  body('indice_carga').optional().trim(),
  body('indice_velocidad').optional().trim(),
  body('color').optional().trim(),
  body('especificaciones_extra').optional(),
];

router.post('/', requireAuth, requirePermission('catalogo_editar'), validarProducto, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      codigo, marca_id, modelo, categoria_id, tipo_producto_id,
      medida, indice_carga, indice_velocidad, color, especificaciones_extra,
      precio_venta, costo, stock_minimo = 0,
    } = req.body;

    if (precio_venta <= 0) return res.status(400).json({ error: 'El precio de venta debe ser mayor a cero' });
    if (stock_minimo < 0) return res.status(400).json({ error: 'El stock mínimo no puede ser negativo' });

    const [r] = await pool.query(
      `INSERT INTO productos (codigo, marca_id, modelo, categoria_id, tipo_producto_id, medida, indice_carga, indice_velocidad, color, especificaciones_extra, precio_venta, costo, stock_minimo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo || null, marca_id, modelo, categoria_id, tipo_producto_id,
        medida || null, indice_carga || null, indice_velocidad || null, color || null,
        especificaciones_extra ? JSON.stringify(especificaciones_extra) : null,
        precio_venta, costo, stock_minimo,
      ]
    );
    const id = (r as any).insertId;
    res.status(201).json({ id, message: 'Producto creado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

router.put(
  '/:id',
  requireAuth,
  requirePermission('catalogo_editar'),
  param('id').isInt(),
  body('precio_venta').optional().isFloat({ min: 0.01 }),
  body('costo').optional().isFloat({ min: 0 }),
  body('stock_minimo').optional().isInt({ min: 0 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const id = Number(req.params?.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
      const body_ = req.body;
      if (body_.precio_venta !== undefined && body_.precio_venta <= 0) {
        return res.status(400).json({ error: 'El precio de venta debe ser mayor a cero' });
      }
      if (body_.stock_minimo !== undefined && body_.stock_minimo < 0) {
        return res.status(400).json({ error: 'El stock mínimo no puede ser negativo' });
      }

      const allowed = ['codigo', 'marca_id', 'modelo', 'categoria_id', 'tipo_producto_id', 'medida', 'indice_carga', 'indice_velocidad', 'color', 'especificaciones_extra', 'precio_venta', 'costo', 'stock_minimo', 'activo'];
      const updates: string[] = [];
      const values: any[] = [];
      for (const key of allowed) {
        if (body_[key] === undefined) continue;
        if (key === 'especificaciones_extra' && body_[key]) {
          updates.push(`${key} = ?`);
          values.push(JSON.stringify(body_[key]));
        } else {
          updates.push(`${key} = ?`);
          values.push(body_[key]);
        }
      }
      if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
      values.push(id);
      await pool.query(`UPDATE productos SET ${updates.join(', ')} WHERE id = ?`, values);
      res.json({ message: 'Producto actualizado' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al actualizar producto' });
    }
  }
);

router.post(
  '/entrada',
  requireAuth,
  requirePermission('entrada_inventario'),
  [
    body('producto_id').isInt({ min: 1 }),
    body('cantidad').isInt({ min: 1 }).withMessage('La cantidad debe ser mayor a cero'),
    body('proveedor_id').isInt({ min: 1 }).withMessage('El proveedor es obligatorio'),
    body('observaciones').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const user = (req as Request & { user?: { userId: number } }).user;
      const { producto_id, cantidad, proveedor_id, observaciones } = req.body;
      if (cantidad <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a cero' });
      if (!user) return res.status(401).json({ error: 'No autorizado' });

      const [rowsProd] = await pool.query('SELECT costo FROM productos WHERE id = ?', [producto_id]);
      const prod = (rowsProd as any[])[0];
      if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });
      const costo = Number(prod.costo) || 0;

      const [asoc] = await pool.query(
        'SELECT 1 FROM proveedor_productos WHERE proveedor_id = ? AND producto_id = ?',
        [proveedor_id, producto_id]
      );
      if ((asoc as any[]).length === 0) {
        return res.status(400).json({ error: 'El producto no está asociado a este proveedor.' });
      }

      await pool.query(
        'INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, usuario_id, proveedor_id, observaciones) VALUES (?, ?, ?, ?, ?, ?)',
        [producto_id, 'entrada', cantidad, user.userId, proveedor_id || null, observaciones || null]
      );

      const total = cantidad * costo;
      const [ins] = await pool.query(
        'INSERT INTO compras (proveedor_id, usuario_id, fecha_compra, total, observaciones) VALUES (?, ?, CURDATE(), ?, ?)',
        [proveedor_id, user.userId, total, observaciones || null]
      );
      const compraId = (ins as any).insertId;
      await pool.query(
        'INSERT INTO compras_detalle (compra_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
        [compraId, producto_id, cantidad, costo, total]
      );

      const [p] = await pool.query('SELECT stock_actual FROM productos WHERE id = ?', [producto_id]);
      res.status(201).json({ message: 'Entrada registrada', stock_actual: (p as any[])[0]?.stock_actual });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al registrar entrada' });
    }
  }
);

router.post(
  '/salida',
  requireAuth,
  requirePermission('entrada_inventario'),
  [
    body('producto_id').isInt({ min: 1 }),
    body('cantidad').isInt({ min: 1 }).withMessage('La cantidad debe ser mayor a cero'),
    body('motivo').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const user = (req as Request & { user?: { userId: number } }).user;
      const { producto_id, cantidad, motivo } = req.body;
      if (cantidad <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a cero' });
      if (!user) return res.status(401).json({ error: 'No autorizado' });

      const [rowsProd] = await pool.query('SELECT stock_actual FROM productos WHERE id = ?', [producto_id]);
      const prod = (rowsProd as any[])[0];
      if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });
      const stockActual = Number(prod.stock_actual) || 0;
      if (cantidad > stockActual) {
        return res.status(400).json({ error: `La cantidad no puede superar el stock disponible (${stockActual})` });
      }

      await pool.query(
        'INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, usuario_id, proveedor_id, observaciones) VALUES (?, ?, ?, ?, NULL, ?)',
        [producto_id, 'salida', -cantidad, user.userId, motivo || null]
      );
      await pool.query('UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?', [cantidad, producto_id]);

      const [p] = await pool.query('SELECT stock_actual FROM productos WHERE id = ?', [producto_id]);
      res.status(201).json({ message: 'Salida registrada', stock_actual: (p as any[])[0]?.stock_actual });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al registrar salida' });
    }
  }
);

router.post(
  '/danados',
  requireAuth,
  requirePermission('entrada_inventario'),
  [
    body('producto_id').isInt({ min: 1 }),
    body('cantidad').isInt({ min: 1 }).withMessage('La cantidad debe ser mayor a cero'),
    body('motivo').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const user = (req as Request & { user?: { userId: number } }).user;
      const { producto_id, cantidad, motivo } = req.body;
      if (cantidad <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a cero' });
      if (!user) return res.status(401).json({ error: 'No autorizado' });

      const [rowsProd] = await pool.query('SELECT stock_actual FROM productos WHERE id = ?', [producto_id]);
      const prod = (rowsProd as any[])[0];
      if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });
      const stockActual = Number(prod.stock_actual) || 0;
      if (cantidad > stockActual) {
        return res.status(400).json({ error: `La cantidad no puede superar el stock disponible (${stockActual})` });
      }

      await pool.query(
        'INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, usuario_id, proveedor_id, observaciones) VALUES (?, ?, ?, ?, NULL, ?)',
        [producto_id, 'danado', -cantidad, user.userId, motivo || null]
      );
      await pool.query('UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?', [cantidad, producto_id]);

      res.json({ message: 'Producto dañado registrado' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error al registrar producto dañado' });
    }
  }
);

router.get('/:id', requireAuth, requirePermission('catalogo_ver'), param('id').isInt(), async (req: Request, res: Response) => {
  try {
    const id = req.params?.id;
    if (id == null) return res.status(400).json({ error: 'ID inválido' });
    const [rows] = await pool.query(
      `SELECT p.*, m.nombre as marca_nombre, cp.nombre as categoria_nombre, tp.nombre as tipo_nombre
       FROM productos p JOIN marcas m ON p.marca_id = m.id
       JOIN categorias_producto cp ON p.categoria_id = cp.id
       JOIN tipos_producto tp ON p.tipo_producto_id = tp.id WHERE p.id = ?`,
      [id]
    );
    const p = (rows as any[])[0];
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(p);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

export default router;
