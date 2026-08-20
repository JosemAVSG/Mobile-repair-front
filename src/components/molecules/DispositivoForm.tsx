import { useMemo } from 'react';
import { Modal } from '../atoms/Modal';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { FormField } from './FormField';
import { TIPO_DISPOSITIVO_LABELS } from '../../utils/formatters';
import {
  buildModeloOptions,
  buildClienteOptions,
  buildMarcaOptions,
  buildMarcasPorCategoria,
  categoriaDeTipo,
} from '../../utils/maps';
import type { Cliente, Marca, Modelo } from '../../types';
import { TipoDispositivo, CategoriaMarca } from '../../types';

interface DispositivoFormProps {
  open: boolean;
  title: string;
  isEdit: boolean;
  submitting: boolean;
  tipo: TipoDispositivo | '';
  setTipo: (t: TipoDispositivo | '') => void;
  marcaId: string;
  setMarcaId: (v: string) => void;
  modeloId: string;
  setModeloId: (v: string) => void;
  clienteId: string;
  setClienteId: (v: string) => void;
  numeroSerie: string;
  setNumeroSerie: (v: string) => void;
  imei: string;
  setImei: (v: string) => void;
  capacidad: string;
  setCapacidad: (v: string) => void;
  tipoGas: string;
  setTipoGas: (v: string) => void;
  voltaje: string;
  setVoltaje: (v: string) => void;
  notasTecnicas: string;
  setNotasTecnicas: (v: string) => void;
  fieldErrors: Record<string, string>;
  clientes: Cliente[] | undefined;
  modelos: Modelo[] | undefined;
  marcas: Marca[] | undefined;
  onCancel: () => void;
  onSubmit: () => void;
}

const TIPO_OPTIONS = [
  { value: TipoDispositivo.CELULAR, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.CELULAR] },
  { value: TipoDispositivo.MICROONDAS, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.MICROONDAS] },
  { value: TipoDispositivo.NEVERA, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.NEVERA] },
  { value: TipoDispositivo.COCINA, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.COCINA] },
  { value: TipoDispositivo.LAVADORA, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.LAVADORA] },
  { value: TipoDispositivo.COMPUTADORA, label: TIPO_DISPOSITIVO_LABELS[TipoDispositivo.COMPUTADORA] },
];

const LINEA_BLANCA_TIPOS = new Set([
  TipoDispositivo.MICROONDAS,
  TipoDispositivo.NEVERA,
  TipoDispositivo.COCINA,
  TipoDispositivo.LAVADORA,
]);

function buildMarcaCategoriaMap(marcas: Marca[]): Map<number, CategoriaMarca> {
  const map = new Map<number, CategoriaMarca>();
  for (const m of marcas) {
    map.set(m.id, m.categoria);
  }
  return map;
}

function NotasTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <textarea
      className="min-h-[80px] rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function DispositivoForm({
  open,
  title,
  isEdit,
  submitting,
  tipo,
  setTipo,
  marcaId,
  setMarcaId,
  modeloId,
  setModeloId,
  clienteId,
  setClienteId,
  numeroSerie,
  setNumeroSerie,
  imei,
  setImei,
  capacidad,
  setCapacidad,
  tipoGas,
  setTipoGas,
  voltaje,
  setVoltaje,
  notasTecnicas,
  setNotasTecnicas,
  fieldErrors,
  clientes,
  modelos,
  marcas,
  onCancel,
  onSubmit,
}: DispositivoFormProps) {
  const isLineaBlanca =
    tipo !== '' && LINEA_BLANCA_TIPOS.has(tipo as TipoDispositivo);

  const marcaCategoriaMap = useMemo(
    () => buildMarcaCategoriaMap(marcas ?? []),
    [marcas],
  );

  const marcaOptions = useMemo(
    () => buildMarcaOptions(buildMarcasPorCategoria(marcas ?? [], tipo)),
    [marcas, tipo],
  );

  const modeloOptions = useMemo(() => {
    const modelosList = modelos ?? [];
    let listaFiltrada = modelosList;
    if (marcaId) {
      listaFiltrada = listaFiltrada.filter(
        (m) => m.marcaId === Number(marcaId),
      );
    } else if (tipo !== '') {
      const categoria = categoriaDeTipo(tipo as TipoDispositivo);
      listaFiltrada = listaFiltrada.filter((m) => {
        const cat = marcaCategoriaMap.get(m.marcaId);
        return cat === categoria;
      });
    }
    return buildModeloOptions(listaFiltrada);
  }, [modelos, tipo, marcaId, marcaCategoriaMap]);

  const clienteOptions = useMemo(
    () => buildClienteOptions(clientes ?? []),
    [clientes],
  );

  const handleTipoChange = (value: string) => {
    setTipo(value as TipoDispositivo | '');
    setMarcaId('');
    setModeloId('');
    setNumeroSerie('');
    setImei('');
    setCapacidad('');
    setTipoGas('');
    setVoltaje('');
    setNotasTecnicas('');
  };

  const handleMarcaChange = (value: string) => {
    setMarcaId(value);
    setModeloId('');
  };

  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      title={title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} loading={submitting}>
            {isEdit ? 'Actualizar' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {fieldErrors.general && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {fieldErrors.general}
          </p>
        )}

        <FormField label="Tipo" required error={fieldErrors.tipo}>
          <Select
            options={TIPO_OPTIONS}
            placeholder="Seleccionar tipo..."
            value={tipo}
            onChange={(e) => handleTipoChange(e.target.value)}
          />
        </FormField>

        <FormField label="Marca">
          <Select
            options={marcaOptions}
            placeholder={tipo ? 'Seleccionar marca...' : 'Primero seleccione un tipo'}
            value={marcaId}
            onChange={(e) => handleMarcaChange(e.target.value)}
            disabled={!tipo}
          />
        </FormField>

        <FormField label="Modelo" required error={fieldErrors.modeloId}>
          <Select
            options={modeloOptions}
            placeholder="Seleccionar modelo..."
            value={modeloId}
            onChange={(e) => setModeloId(e.target.value)}
            disabled={!marcaId || marcaOptions.length === 0}
          />
        </FormField>

        <FormField label="Cliente" required error={fieldErrors.clienteId}>
          <Select
            options={clienteOptions}
            placeholder="Seleccionar cliente..."
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          />
        </FormField>

        {/* Conditional fields for CELULAR */}
        {tipo === TipoDispositivo.CELULAR && (
          <>
            <FormField label="Número de Serie">
              <Input
                placeholder="Número de serie"
                value={numeroSerie}
                onChange={(e) => setNumeroSerie(e.target.value)}
              />
            </FormField>

            <FormField label="IMEI">
              <Input
                placeholder="IMEI del dispositivo"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
              />
            </FormField>

            <FormField label="Notas Técnicas">
              <NotasTextarea
                placeholder="Notas técnicas del dispositivo"
                value={notasTecnicas}
                onChange={setNotasTecnicas}
              />
            </FormField>
          </>
        )}

        {/* Conditional fields for COMPUTADORA */}
        {tipo === TipoDispositivo.COMPUTADORA && (
          <>
            <FormField label="Número de Serie">
              <Input
                placeholder="Número de serie"
                value={numeroSerie}
                onChange={(e) => setNumeroSerie(e.target.value)}
              />
            </FormField>

            <FormField label="Notas Técnicas">
              <NotasTextarea
                placeholder="Notas técnicas del dispositivo"
                value={notasTecnicas}
                onChange={setNotasTecnicas}
              />
            </FormField>
          </>
        )}

        {/* Conditional fields for Línea Blanca */}
        {isLineaBlanca && (
          <>
            <FormField label="Número de Serie">
              <Input
                placeholder="Número de serie"
                value={numeroSerie}
                onChange={(e) => setNumeroSerie(e.target.value)}
              />
            </FormField>

            <FormField label="Capacidad">
              <Input
                placeholder="Ej: 300L, 20kg"
                value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
              />
            </FormField>

            <FormField label="Tipo Gas">
              <Input
                placeholder="Ej: R134a"
                value={tipoGas}
                onChange={(e) => setTipoGas(e.target.value)}
              />
            </FormField>

            <FormField label="Voltaje">
              <Input
                placeholder="Ej: 220V"
                value={voltaje}
                onChange={(e) => setVoltaje(e.target.value)}
              />
            </FormField>

            <FormField label="Notas Técnicas">
              <NotasTextarea
                placeholder="Notas técnicas del dispositivo"
                value={notasTecnicas}
                onChange={setNotasTecnicas}
              />
            </FormField>
          </>
        )}
      </div>
    </Modal>
  );
}
