import { Router, Request, Response } from 'express';
import pool from '../config/db';
import { requireAuth, requirePermission, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('reportes_ver'));
router.use(requireAdmin);

/** Lista de usuarios (vendedores) para filtros - requiere reportes_ver */
router.get('/vendedores', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.nombre, u.apellido FROM usuarios u
       WHERE u.activo = 1 AND u.id IN (
         SELECT DISTINCT usuario_id FROM movimientos_inventario
         WHERE tipo_movimiento = 'salida' AND usuario_id IS NOT NULL
       ) ORDER BY u.nombre`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar vendedores' });
  }
});

/** Reporte de ventas (derivado de movimientos_inventario tipo salida) */
router.get('/ventas', async (req: Request, res: Response) => {
  try {
    const { desde, hasta, vendedor_id, producto_id } = req.query;
    let sql = `
      SELECT m.id, DATE(m.created_at) as fecha, u.nombre as vendedor_nombre,
             ABS(m.cantidad) as cantidad, p.precio_venta,
             ABS(m.cantidad) * p.precio_venta as total,
             CONCAT(mr.nombre, ' ', p.modelo, ' (', cp.nombre, ')') as producto_nombre
      FROM movimientos_inventario m
      JOIN productos p ON m.producto_id = p.id
      JOIN marcas mr ON p.marca_id = mr.id
      JOIN categorias_producto cp ON p.categoria_id = cp.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.tipo_movimiento = 'salida' AND m.cantidad < 0
    `;
    const params: (string | number)[] = [];
    if (desde) { sql += ' AND DATE(m.created_at) >= ?'; params.push(desde as string); }
    if (hasta) { sql += ' AND DATE(m.created_at) <= ?'; params.push(hasta as string); }
    if (vendedor_id) { sql += ' AND m.usuario_id = ?'; params.push(Number(vendedor_id)); }
    if (producto_id) { sql += ' AND m.producto_id = ?'; params.push(Number(producto_id)); }
    sql += ' ORDER BY m.created_at DESC';

    const [rows] = await pool.query(sql, params);
    const raw = rows as { id: number; fecha: string; vendedor_nombre: string; cantidad: number; precio_venta: number; total: number; producto_nombre: string }[];
    const result = raw.map((r) => ({
      id: r.id,
      fecha: r.fecha,
      total: Number(r.total),
      vendedor_nombre: r.vendedor_nombre || '-',
      cliente_nombre: undefined,
      productos: [{ nombre: r.producto_nombre, cantidad: Number(r.cantidad), subtotal: Number(r.total) }],
    }));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al generar reporte de ventas' });
  }
});

/** Reporte de compras */
router.get('/compras', async (req: Request, res: Response) => {
  try {
    const { desde, hasta, proveedor_id, producto_id } = req.query;
    let sql = `
      SELECT c.id, c.fecha_compra as fecha, c.total, pr.nombre as proveedor_nombre, u.nombre as usuario_nombre
      FROM compras c
      LEFT JOIN proveedores pr ON c.proveedor_id = pr.id
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];
    if (desde) { sql += ' AND c.fecha_compra >= ?'; params.push(desde as string); }
    if (hasta) { sql += ' AND c.fecha_compra <= ?'; params.push(hasta as string); }
    if (proveedor_id) { sql += ' AND c.proveedor_id = ?'; params.push(Number(proveedor_id)); }
    if (producto_id) {
      sql += ` AND c.id IN (SELECT compra_id FROM compras_detalle WHERE producto_id = ?)`;
      params.push(Number(producto_id));
    }
    sql += ' ORDER BY c.fecha_compra DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al generar reporte de compras' });
  }
});

/** Reporte de utilidades */
router.get('/utilidades', async (req: Request, res: Response) => {
  try {
    const { desde, hasta } = req.query;
    const paramsV: (string | number)[] = [];
    const paramsC: (string | number)[] = [];
    let whereV = '';
    let whereC = '';
    if (desde) {
      whereV += ' AND DATE(m.created_at) >= ?';
      whereC += ' AND c.fecha_compra >= ?';
      paramsV.push(desde as string);
      paramsC.push(desde as string);
    }
    if (hasta) {
      whereV += ' AND DATE(m.created_at) <= ?';
      whereC += ' AND c.fecha_compra <= ?';
      paramsV.push(hasta as string);
      paramsC.push(hasta as string);
    }

    const [ventasRows] = await pool.query(
      `SELECT COALESCE(SUM(ABS(m.cantidad) * p.precio_venta), 0) as total
       FROM movimientos_inventario m JOIN productos p ON m.producto_id = p.id
       WHERE m.tipo_movimiento = 'salida' AND m.cantidad < 0 ${whereV}`,
      paramsV
    );
    const [comprasRows] = await pool.query(
      `SELECT COALESCE(SUM(c.total), 0) as total FROM compras c WHERE 1=1 ${whereC}`,
      paramsC
    );
    const ventasTotales = Number((ventasRows as any[])[0]?.total ?? 0);
    const comprasTotales = Number((comprasRows as any[])[0]?.total ?? 0);
    const utilidad = ventasTotales - comprasTotales;
    const margen = ventasTotales > 0 ? ((utilidad / ventasTotales) * 100).toFixed(1) : null;
    res.json({
      ventas_totales: ventasTotales,
      compras_totales: comprasTotales,
      utilidad,
      margen: margen != null ? Number(margen) : undefined,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al generar reporte de utilidades' });
  }
});

export default router;
