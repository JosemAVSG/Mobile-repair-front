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
  ESPERANDO_ENTREGA = 'ESPERANDO_ENTREGA',
  PRESUPUESTO_RECHAZADO = 'PRESUPUESTO_RECHAZADO',
  ENTREGADO = 'ENTREGADO',
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

export interface Dispositivo {
  id: number;
  tipo: TipoDispositivo;
  modeloId: number;
  clienteId: number;
  numeroSerie: string | null;
  imei: string | null;
  capacidad: string | null;
  tipoGas: string | null;
  voltaje: string | null;
  notasTecnicas: string | null;
  createdAt: string;
}

export interface OrdenTrabajo {
  id: number;
  clienteId: number;
  dispositivoId: number;
  estado: EstadoOrden;
  falloReportado: string | null;
  precioTotal: number | null;
  fechaEntrada: string;
  fechaSalida: string | null;
  notas: string | null;
  reparaciones: Reparacion[];
  createdAt: string;
}

export interface Reparacion {
  id: number;
  ordenId: number;
  tipo: TipoReparacion;
  descripcion: string | null;
  precio: number;
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
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  proveedorId: number | null;
  bajoStock: boolean;
  createdAt: string;
}

export interface HistorialEntry {
  id: number;
  entidadTipo: string;
  entidadId: number;
  contenido: string;
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

export interface DispositivoRequest {
  tipo: TipoDispositivo;
  modeloId: number;
  clienteId: number;
  numeroSerie?: string;
  imei?: string;
  capacidad?: string;
  tipoGas?: string;
  voltaje?: string;
  notasTecnicas?: string;
}

export interface OrdenRequest {
  clienteId: number;
  dispositivoId: number;
  falloReportado?: string;
  notas?: string;
}

export interface ReparacionRequest {
  tipo: TipoReparacion;
  descripcion?: string;
  precio: number;
}

export interface TarifaRequest {
  marcaId?: number;
  modeloId?: number;
  tipo: TipoReparacion;
  precio: number;
}

export interface RepuestoRequest {
  nombre: string;
  descripcion?: string;
  codigo: string;
  precioCosto: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  proveedorId?: number;
}
