import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import usuariosRoutes from './routes/usuarios';
import productosRoutes from './routes/productos';
import marcasRoutes from './routes/marcas';
import proveedoresRoutes from './routes/proveedores';
import rolesRoutes from './routes/roles';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/productos', productosRoutes);

// Catálogo público (sin autenticación)
app.get('/api/public/categorias', async (_req, res) => {
  try {
    const pool = (await import('./config/db')).default;
    const [rows] = await pool.query('SELECT id, nombre, descripcion FROM categorias_producto');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar categorías' });
  }
});
app.get('/api/public/tipos', async (_req, res) => {
  try {
    const pool = (await import('./config/db')).default;
    const [rows] = await pool.query('SELECT id, nombre, descripcion FROM tipos_producto');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar tipos' });
  }
});
app.get('/api/public/marcas', async (_req, res) => {
  try {
    const pool = (await import('./config/db')).default;
    const [rows] = await pool.query('SELECT id, nombre, activo FROM marcas ORDER BY nombre');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar marcas' });
  }
});
app.get('/api/public/productos', async (req, res) => {
  try {
    const pool = (await import('./config/db')).default;
    const { categoria_id, tipo_id, marca_id } = req.query;
    let sql = `SELECT p.*, m.nombre as marca_nombre, cp.nombre as categoria_nombre, tp.nombre as tipo_nombre
               FROM productos p
               JOIN marcas m ON p.marca_id = m.id
               JOIN categorias_producto cp ON p.categoria_id = cp.id
               JOIN tipos_producto tp ON p.tipo_producto_id = tp.id
               WHERE p.activo = 1`;
    const params: any[] = [];
    if (categoria_id) { sql += ' AND p.categoria_id = ?'; params.push(categoria_id); }
    if (tipo_id) { sql += ' AND p.tipo_producto_id = ?'; params.push(tipo_id); }
    if (marca_id) { sql += ' AND p.marca_id = ?'; params.push(marca_id); }
    sql += ' ORDER BY p.id DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar productos' });
  }
});
app.use('/api/marcas', marcasRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api', rolesRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor AMADS en http://localhost:${PORT}`);
});
