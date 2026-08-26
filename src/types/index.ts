// ──────────────────────────────────────────────
// API Response wrapper
// ──────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta: { success: boolean; message: string; timestamp: string };
}

// ──────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────

export type RolUsuario = 'ADMIN' | 'TECNICO';

export type EtapaFoto = 'ANTES' | 'DURANTE' | 'DESPUES';

export interface AuthUser {
  id: number;
  nombre: string;
  correo?: string | null;
  telefono?: string | null;
  username: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt?: string;
  /** Id del registro de Técnico asociado. El backend usa el mismo id del
   *  usuario (todo usuario es una fila en `tecnicos`), por lo que coincide
   *  con `id` en la práctica. */
  tecnicoId?: number | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  rol: RolUsuario;
}

export enum CategoriaMarca {
  CELULARES = 'CELULARES',
  LINEA_BLANCA = 'LINEA_BLANCA',
  COMPUTADORAS = 'COMPUTADORAS',
}

export enum TipoDispositivo {
  CELULAR = 'CELULAR',
  MICROONDAS = 'MICROONDAS',
  NEVERA = 'NEVERA',
  COCINA = 'COCINA',
  LAVADORA = 'LAVADORA',
  COMPUTADORA = 'COMPUTADORA',
}

export enum EstadoOrden {
  REGISTRO = 'REGISTRO',
  DIAGNOSTICO = 'DIAGNOSTICO',
  REPARACION = 'REPARACION',
  ESPERANDO_REPUESTO = 'ESPERANDO_REPUESTO',
  REPARACION_COMPLETADA = 'REPARACION_COMPLETADA',
  CONTROL_CALIDAD = 'CONTROL_CALIDAD',
  ESPERANDO_ENTREGA = 'ESPERANDO_ENTREGA',
  PAGADO = 'PAGADO',
  PRESUPUESTO_RECHAZADO = 'PRESUPUESTO_RECHAZADO',
  DEVUELTO = 'DEVUELTO',
  ENTREGADO = 'ENTREGADO',
  GARANTIA = 'GARANTIA',
}

export enum TipoReparacion {
  PANTALLA = 'PANTALLA',
  BATERIA = 'BATERIA',
  ALTAVOZ = 'ALTAVOZ',
  MICROFONO = 'MICROFONO',
  CARGADOR = 'CARGADOR',
  BOTONES = 'BOTONES',
  CÁMARA = 'CÁMARA',
  PLACA = 'PLACA',
  SOFTWARE = 'SOFTWARE',
  OTRO = 'OTRO',
}

// ──────────────────────────────────────────────
// Entities
// ──────────────────────────────────────────────

export interface Marca {
  id: number;
  nombre: string;
  categoria: CategoriaMarca;
  createdAt: string;
}

export interface Modelo {
  id: number;
  nombre: string;
  marcaId: number;
  createdAt: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  createdAt: string;
}

export interface Tecnico {
  id: number;
  nombre: string;
  correo?: string | null;
  telefono?: string | null;
  username: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt?: string;
}

export interface OrdenTrabajo {
  id: number;
  clienteId: number;
  tecnicoId?: number | null;
  marcaId?: number | null;
  modeloId?: number | null;
  tipo?: TipoDispositivo | null;
  numeroSerie?: string | null;
  imei?: string | null;
  capacidad?: string | null;
  tipoGas?: string | null;
  voltaje?: string | null;
  notasTecnicas?: string | null;
  estado: EstadoOrden;
  falloReportado: string | null;
  precioTotal: number | null;
  descuentoDiagnostico?: boolean;
  fechaEntrada: string;
  fechaSalida: string | null;
  fechaEntrega?: string | null;
  notas: string | null;
  reparaciones: Reparacion[];
  createdAt: string;
}

export interface RepuestoSnapshot {
  id: number;
  repuestoId: number | null;
  nombre: string;
  precioCosto: number;
}

export interface Reparacion {
  id: number;
  ordenId: number;
  tipo: TipoReparacion;
  descripcion: string | null;
  precio: number;
  costoRepuesto?: number | null;
  ganancia?: number | null;
  repuestos?: RepuestoSnapshot[];
  createdAt: string;
}

export interface Tarifa {
  id: number;
  marcaId: number | null;
  modeloId: number | null;
  tipo: TipoReparacion;
  precio: number;
  activa: boolean;
  createdAt: string;
}

export interface Repuesto {
  id: number;
  nombre: string;
  descripcion: string | null;
  codigo: string;
  precioCosto: number;
  marcaId: number | null;
  modeloId: number | null;
  tipoReparacion: TipoReparacion;
  createdAt: string;
}

export interface HistorialEntry {
  id: number;
  entidadTipo: string;
  entidadId: number;
  contenido: string;
  createdAt: string;
}

export interface FotoOrden {
  id: number;
  ordenId: number;
  etapa: EtapaFoto;
  url: string;
  createdAt: string;
}

// ──────────────────────────────────────────────
// Request DTOs
// ──────────────────────────────────────────────

export interface MarcaRequest {
  nombre: string;
  categoria: CategoriaMarca;
}

export interface ModeloRequest {
  nombre: string;
  marcaId: number;
}

export interface ClienteRequest {
  nombre: string;
  telefono?: string;
  email?: string;
}

export interface OrdenRequest {
  clienteId: number;
  tecnicoId?: number | null;
  marcaId?: number;
  modeloId?: number;
  tipo?: TipoDispositivo;
  numeroSerie?: string;
  imei?: string;
  capacidad?: string;
  tipoGas?: string;
  voltaje?: string;
  notasTecnicas?: string;
  falloReportado?: string;
  notas?: string;
  tipoReparacion?: TipoReparacion;
  precioRevision?: number;
}

export interface ReparacionRequest {
  tipo: TipoReparacion;
  descripcion?: string;
  precio: number;
  repuestoIds?: number[];
}

export interface TarifaRequest {
  marcaId?: number;
  modeloId?: number;
  tipo: TipoReparacion;
  precio: number;
}

export interface TecnicoRequest {
  nombre: string;
  correo?: string;
  telefono?: string;
  username: string;
  /** Obligatorio al crear; en edición, vacío/ausente = no cambiar. */
  password?: string;
  rol: RolUsuario;
  activo: boolean;
}

export interface RepuestoRequest {
  nombre: string;
  descripcion?: string;
  codigo: string;
  precioCosto: number;
  marcaId?: number;
  modeloId?: number;
  tipoReparacion: TipoReparacion;
}

// ──────────────────────────────────────────────
// Shop config
// ──────────────────────────────────────────────

export interface BackendShopConfig {
  nombreTaller: string;
  logo: string | null;
}

export interface ShopConfigForm {
  nombreTaller: string;
  logo: File | string | null;
}

// ──────────────────────────────────────────────
// Public repair status
// ──────────────────────────────────────────────

export type PublicStage =
  | 'Ingresado'
  | 'En reparación'
  | 'Listo para retiro'
  | 'Finalizado';

export type PublicRepairStatus = {
  id: string;
  numeroOrden: string;
  cliente: { nombre: string; telefono?: string };
  equipo: { modelo: string; marca?: string };
  estadoOrden: EstadoOrden;
  fechaEstimadaEntrega?: string;
  fechaIngreso?: string;
  observacionesPublicas?: string;
};

/**
 * Mapeo de estados internos a etapas públicas del seguimiento.
 * `null` = estado especial que se muestra como banner, no como etapa lineal.
 */
export const ESTADO_TO_PUBLIC_STAGE: Record<EstadoOrden, PublicStage | null> = {
  [EstadoOrden.REGISTRO]: 'Ingresado',
  [EstadoOrden.DIAGNOSTICO]: 'Ingresado',
  [EstadoOrden.REPARACION]: 'En reparación',
  [EstadoOrden.ESPERANDO_REPUESTO]: 'En reparación',
  [EstadoOrden.REPARACION_COMPLETADA]: 'En reparación',
  [EstadoOrden.CONTROL_CALIDAD]: 'En reparación',
  [EstadoOrden.ESPERANDO_ENTREGA]: 'Listo para retiro',
  [EstadoOrden.PAGADO]: 'Listo para retiro',
  [EstadoOrden.PRESUPUESTO_RECHAZADO]: null,
  [EstadoOrden.DEVUELTO]: null,
  [EstadoOrden.ENTREGADO]: 'Finalizado',
  [EstadoOrden.GARANTIA]: 'Finalizado',
};

// ──────────────────────────────────────────────
// Role-based access
// ──────────────────────────────────────────────

export type ActionPermission =
  | 'orden:create'
  | 'orden:view'
  | 'orden:edit'
  | 'reparacion:manage'
  | 'entrega:manage'
  | 'foto:manage';

export interface CanResource {
  tecnicoId?: number | null;
}

export interface RequireRoleProps {
  roles: RolUsuario[];
  fallback?: string;
  children: React.ReactNode;
}

// ──────────────────────────────────────────────
// Inventory management
// ──────────────────────────────────────────────

export type EstadoStock = 'OK' | 'BAJO' | 'SIN_STOCK';

export type TipoMovimiento = 'COMPRA' | 'CONSUMO';

export interface ProductoInventario {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  stock: number;
  stockMinimo: number;
  estado: EstadoStock;
  costoUnitario: number;
  createdAt: string;
}

export interface MovimientoInventario {
  id: number;
  productoId: number;
  tipo: TipoMovimiento;
  cantidad: number;
  stockResultante: number;
  ordenId?: number | null;
  notas?: string | null;
  createdAt: string;
}

export interface ProductoInventarioRequest {
  codigo: string;
  nombre: string;
  descripcion?: string;
  stock: number;
  stockMinimo: number;
  costoUnitario: number;
}

export interface MovimientoRequest {
  productoId: number;
  tipo: TipoMovimiento;
  cantidad: number;
  ordenId?: number;
  notas?: string;
}

export interface InventoryKpis {
  totalProductos: number;
  bajoStock: number;
  sinStock: number;
  valorTotalStock: number;
}
