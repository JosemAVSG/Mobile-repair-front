// ──────────────────────────────────────────────
// API Response wrapper
// ──────────────────────────────────────────────

export interface ApiResponseMeta {
  success: boolean;
  message: string;
  timestamp: string;
  codigo?: string;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiResponseMeta;
}

// ──────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────

export type RolUsuario = 'ADMIN' | 'TECNICO';

export type EtapaFoto = 'ANTES' | 'DURANTE' | 'DESPUES';

export type EstadoSuscripcion = 'TRIAL' | 'ACTIVO' | 'SUSPENDIDO' | 'CANCELADO';

export type PlanSuscripcion = 'TRIAL' | 'LEGACY' | 'BASICO' | 'PRO';

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
  /** Taller (tenant) al que pertenece el usuario. */
  tallerId?: number | null;
  /** Billing fields from backend (login/me) */
  plan?: string | null;
  estado?: EstadoSuscripcion | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  rol: RolUsuario;
  tallerId?: number | null;
  nombreTaller?: string | null;
  plan?: string | null;
  estado?: EstadoSuscripcion | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}

/** Cuerpo de POST /api/auth/register-taller. */
export interface RegisterTallerRequest {
  nombreTaller: string;
  adminNombre: string;
  username: string;
  password: string;
  correo: string;
  telefono?: string;
  /** Honeypot anti-bots: debe viajar vacío. */
  website?: string;
}

export enum CategoriaMarca {
  CELULARES = 'CELULARES',
  /** @deprecated línea blanca: solo para marcas ya cargadas */
  LINEA_BLANCA = 'LINEA_BLANCA',
  COMPUTADORAS = 'COMPUTADORAS',
  CONSOLAS = 'CONSOLAS',
  TABLETS = 'TABLETS',
}

export enum TipoDispositivo {
  CELULAR = 'CELULAR',
  /** @deprecated línea blanca: solo para órdenes antiguas */
  MICROONDAS = 'MICROONDAS',
  /** @deprecated */
  NEVERA = 'NEVERA',
  /** @deprecated */
  COCINA = 'COCINA',
  /** @deprecated */
  LAVADORA = 'LAVADORA',
  COMPUTADORA = 'COMPUTADORA',
  CONSOLA = 'CONSOLA',
  TABLET = 'TABLET',
}

/** Tipos con los que se pueden crear órdenes nuevas (los demás quedan por historial). */
export const TIPOS_DISPOSITIVO_ACTIVOS: TipoDispositivo[] = [
  TipoDispositivo.CELULAR,
  TipoDispositivo.COMPUTADORA,
  TipoDispositivo.TABLET,
  TipoDispositivo.CONSOLA,
];

/** Categorías de marca que se pueden asignar a marcas nuevas. */
export const CATEGORIAS_MARCA_ACTIVAS: CategoriaMarca[] = [
  CategoriaMarca.CELULARES,
  CategoriaMarca.COMPUTADORAS,
  CategoriaMarca.TABLETS,
  CategoriaMarca.CONSOLAS,
];

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
  /** true = registro del catálogo global (solo lectura para los talleres). */
  global?: boolean;
}

export interface Modelo {
  id: number;
  nombre: string;
  marcaId: number;
  createdAt: string;
  /** true = registro del catálogo global (solo lectura para los talleres). */
  global?: boolean;
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
  /** Número de orden por taller (p.ej. "0001"). Si falta, se usa el id. */
  numeroOrden?: string | null;
  /** Código no adivinable usado en el QR público */
  codigoPublico?: string | null;
  clienteId: number;
  tecnicoId?: number | null;
  /** Nombre del técnico asignado (el backend lo devuelve en OrdenResponse). */
  tecnicoNombre?: string | null;
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
  /** `productos.id` del catálogo unificado. Es el ÚNICO id válido para PUT/matching; null = snapshot legado. */
  productoId?: number | null;
  nombre: string;
  precioCosto: number;
  /** Precio de venta congelado al momento de usar el repuesto (si existía). */
  precioVenta?: number | null;
  /** Monto efectivamente cobrado por el repuesto (venta o costo como fallback). */
  precioCobrado?: number | null;
}

export interface Reparacion {
  id: number;
  ordenId: number;
  tipo: TipoReparacion;
  descripcion: string | null;
  precio: number;
  costoRepuesto?: number | null;
  /** Total cobrado por repuestos de esta reparación (precio de venta, con fallback al costo). */
  precioRepuesto?: number | null;
  ganancia?: number | null;
  repuestos?: RepuestoSnapshot[];
  createdAt: string;
}

export interface Repuesto {
  id: number;
  nombre: string;
  descripcion: string | null;
  codigo: string;
  precioCosto: number;
  /** Precio de venta al público. `null` = se cobra el costo como fallback. */
  precioVenta: number | null;
  marcaId: number | null;
  modeloId: number | null;
  /** Todos los modelos compatibles (`modeloId` es el menor). Ausente en backends viejos. */
  modeloIds?: number[];
  tipoReparacion: TipoReparacion;
  createdAt: string;
}

export interface TarifaManoObra {
  id: number;
  tipoReparacion: TipoReparacion;
  marcaId: number | null;
  modeloId: number | null;
  precio: number;
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
  /** Opcional. `null`/ausente = se cobra el costo como fallback. */
  precioVenta?: number | null;
  marcaId?: number;
  modeloId?: number;
  /** En PUT reemplaza la lista completa (`[]` la vacía). */
  modeloIds?: number[];
  tipoReparacion: TipoReparacion;
}

export interface TarifaManoObraRequest {
  tipoReparacion: TipoReparacion;
  marcaId?: number | null;
  modeloId?: number | null;
  precio: number;
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
  nombreTaller?: string | null;
  logoUrl?: string | null;
  cliente: { nombre?: string | null };
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

/** Destino del producto: repuesto de reparación, venta directa o ambos. */
export type UsoProducto = 'REPUESTO' | 'VENTA' | 'AMBOS';

export interface ProductoInventario {
  id: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  stock: number;
  stockMinimo: number;
  estadoStock: EstadoStock;
  costoUnitario: number;
  uso?: UsoProducto;
  /** Precio de venta al público. `null` = no aplica / no definido. */
  precioVenta: number | null;
  categoria?: string | null;
  variante?: string | null;
  proveedor?: string | null;
  controlaStock?: boolean;
  modelosCompatibles?: number[];
  /** Ids de modelos compatibles. Ausente en backends viejos. */
  modeloIds?: number[];
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
  /** Obligatorio cuando `uso` es VENTA o AMBOS (regla del backend). */
  precioVenta: number;
  uso?: UsoProducto;
  categoria?: string;
  variante?: string;
  proveedor?: string;
  controlaStock?: boolean;
  modeloIds?: number[];
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

// ──────────────────────────────────────────────
// Billing
// ──────────────────────────────────────────────

/** Respuesta de GET /api/billing/suscripcion (SuscripcionResponse del API). */
export interface Suscripcion {
  plan: PlanSuscripcion;
  planDisplayName: string;
  estado: EstadoSuscripcion;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  nextChargeAt?: string | null;
  cancelAtPeriodEnd: boolean;
  pendingPlan?: PlanSuscripcion | null;
  pendingPlanDisplayName?: string | null;
  precioCop?: number | null;
  /** Amount to be charged on the next charge date (COP, human units). */
  montoProximoCobroCop?: number | null;
  /** Textos ya legibles del catálogo (p.ej. "Técnicos hasta 2"). */
  features?: string[];
  metodoPago?: { brand: string; last4: string } | null;
  ultimoCobro?: Cobro | null;
  cobroEnCurso: boolean;
  enMora: boolean;
  pagosHabilitados: boolean;
}

/** Plan self-serve del catálogo público (GET /api/billing/planes). */
export interface PlanCatalogo {
  plan: 'BASICO' | 'PRO';
  nombre: string;
  descripcion?: string | null;
  precioCop: number;
  features: string[];
  destacado: boolean;
}

export interface Cobro {
  status: 'APPROVED' | 'DECLINED' | 'ERROR' | 'VOIDED' | 'PENDING' | 'CLAIMED';
  statusMessage: string | null;
  montoCop: number;
  plan: PlanSuscripcion;
  createdAt: string;
  finalizedAt: string | null;
}

export interface WompiAcceptance {
  publicKey: string;
  acceptanceToken: string;
  acceptancePermalink: string;
  personalAuthToken: string;
  personalAuthPermalink: string;
}

export interface MetodoPagoRequest {
  cardToken: string;
  acceptanceToken: string;
  personalAuthToken: string;
  email: string;
  plan?: PlanSuscripcion;
}
