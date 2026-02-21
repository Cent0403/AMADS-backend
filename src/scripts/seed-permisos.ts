import pool from '../config/db';
import dotenv from 'dotenv';

dotenv.config();

const PERMISOS = [
  { codigo: 'catalogo_ver', nombre: 'Ver catálogo', descripcion: 'Ver productos, marcas y stock' },
  { codigo: 'catalogo_editar', nombre: 'Editar catálogo', descripcion: 'Crear, editar y desactivar productos y marcas' },
  { codigo: 'entrada_inventario', nombre: 'Inventario', descripcion: 'Registrar entrada, salida y productos dañados' },
  { codigo: 'proveedores_ver', nombre: 'Ver proveedores', descripcion: 'Consultar lista y detalle de proveedores' },
  { codigo: 'proveedores_editar', nombre: 'Editar proveedores', descripcion: 'Crear, editar y desactivar proveedores' },
  { codigo: 'usuarios_gestionar', nombre: 'Gestionar usuarios', descripcion: 'Crear, editar y desactivar usuarios' },
  { codigo: 'permisos_asignar', nombre: 'Asignar permisos', descripcion: 'Asignar permisos a roles' },
  { codigo: 'reportes_ver', nombre: 'Ver reportes', descripcion: 'Reporte de inventario y reportes financieros' },
];

async function seed() {
  try {
    for (const p of PERMISOS) {
      const [existing] = await pool.query('SELECT id FROM permisos WHERE codigo = ?', [p.codigo]);
      if ((existing as any[]).length === 0) {
        await pool.query(
          'INSERT INTO permisos (codigo, nombre, descripcion) VALUES (?, ?, ?)',
          [p.codigo, p.nombre, p.descripcion]
        );
        console.log(`Permiso creado: ${p.codigo}`);
      } else {
        await pool.query(
          'UPDATE permisos SET nombre = ?, descripcion = ? WHERE codigo = ?',
          [p.nombre, p.descripcion, p.codigo]
        );
        console.log(`Permiso actualizado: ${p.codigo}`);
      }
    }
    console.log('Permisos actualizados correctamente.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

seed();
