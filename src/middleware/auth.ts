import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db';

export interface JwtPayload {
  userId: number;
  email: string;
  rol: string;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as JwtPayload;
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

/** Obtiene los códigos de permiso del usuario (por su rol). Si no existe tabla permisos, administrador tiene todos. */
export async function getPermisosForUser(userId: number): Promise<string[]> {
  try {
    const [rows] = await pool.query(
      `SELECT p.codigo FROM rol_permiso rp
       JOIN permisos p ON rp.permiso_id = p.id
       JOIN usuarios u ON u.rol_id = rp.rol_id
       WHERE u.id = ?`,
      [userId]
    );
    const list = rows as { codigo: string }[];
    if (Array.isArray(list) && list.length > 0) return list.map((r) => r.codigo);
    const [userRows] = await pool.query(
      'SELECT r.nombre as rol FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = ?',
      [userId]
    );
    const rol = (userRows as { rol: string }[])?.[0]?.rol;
    if (rol === 'administrador') return ['catalogo_ver', 'catalogo_editar', 'entrada_inventario', 'proveedores_ver', 'proveedores_editar', 'usuarios_gestionar', 'permisos_asignar'];
    return [];
  } catch {
    return [];
  }
}

export const requirePermission = (codigo: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as JwtPayload;
    if (!user) return res.status(403).json({ error: 'Sin permisos para esta acción' });
    const permisos = await getPermisosForUser(user.userId);
    if (permisos.includes(codigo) || user.rol === 'administrador') return next();
    return res.status(403).json({ error: 'Sin permisos para esta acción' });
  };
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user as JwtPayload;
  if (!user || user.rol !== 'administrador') {
    return res.status(403).json({ error: 'Solo administradores pueden realizar esta acción' });
  }
  next();
};

export const requireBodegaOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user as JwtPayload;
  if (!user || (user.rol !== 'administrador' && user.rol !== 'encargado_bodega')) {
    return res.status(403).json({ error: 'Sin permisos para esta acción' });
  }
  next();
};
