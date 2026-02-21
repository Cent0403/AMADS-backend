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
app.use('/api/marcas', marcasRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api', rolesRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor AMADS en http://localhost:${PORT}`);
});
