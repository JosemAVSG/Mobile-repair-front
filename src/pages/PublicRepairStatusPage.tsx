import { useParams } from 'react-router-dom';
import { usePublicRepair } from '../hooks/usePublicRepair';
import { usePublicShopConfig } from '../hooks/useShopConfig';
import { Button } from '../components/atoms/Button';
import { Spinner } from '../components/atoms/Spinner';
import { Icon } from '../components/atoms/Icon';
import { ApiError } from '../api/client';
import { formatDate } from '../utils/formatters';
import {
  ESTADO_TO_PUBLIC_STAGE,
  type PublicRepairStatus,
  type PublicStage,
  EstadoOrden,
} from '../types';

// ──────────────────────────────────────────────
// Stages
// ──────────────────────────────────────────────

const PUBLIC_STAGES: PublicStage[] = [
  'Ingresado',
  'En reparación',
  'Listo para retiro',
  'Finalizado',
];

/** Estados fuera del flujo lineal: se muestran como banner, no como etapa. */
const SPECIAL_STATE_BANNERS: Partial<
  Record<
    EstadoOrden,
    { title: string; message: string; tone: 'danger' | 'neutral' }
  >
> = {
  [EstadoOrden.PRESUPUESTO_RECHAZADO]: {
    title: 'Presupuesto rechazado',
    message:
      'El presupuesto no fue aprobado por el cliente. La orden quedó detenida.',
    tone: 'danger',
  },
  [EstadoOrden.DEVUELTO]: {
    title: 'Equipo devuelto',
    message:
      'El equipo fue devuelto al cliente sin realizar la reparación.',
    tone: 'neutral',
  },
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function getStageState(stage: PublicStage, activeStage: PublicStage) {
  const stageIndex = PUBLIC_STAGES.indexOf(stage);
  const activeIndex = PUBLIC_STAGES.indexOf(activeStage);

  if (stageIndex < activeIndex) return 'completed';
  if (stageIndex === activeIndex) return 'active';
  return 'pending';
}

function formatDevice(repair: PublicRepairStatus): string {
  const parts = [repair.equipo.marca, repair.equipo.modelo].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Dispositivo';
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function PublicHeader({
  nombreTaller,
  logo,
}: {
  nombreTaller: string;
  logo: string | null | undefined;
}) {
  return (
    <header className="flex items-center justify-center gap-3 px-4 py-6">
      {logo ? (
        <img
          src={logo}
          alt=""
          className="h-10 w-10 rounded-lg object-contain"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
          <Icon name="smartphone" size={20} />
        </div>
      )}
      <h1 className="text-center text-lg font-semibold text-slate-900 sm:text-xl">
        {nombreTaller}
      </h1>
    </header>
  );
}

function LoadingState({
  nombreTaller,
  logo,
}: {
  nombreTaller: string;
  logo: string | null | undefined;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PublicHeader nombreTaller={nombreTaller} logo={logo} />
      <main className="flex flex-1 items-center justify-center px-4 pb-8">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <Spinner size="lg" />
          <p className="text-sm">Cargando estado de la reparación…</p>
        </div>
      </main>
    </div>
  );
}

function ErrorState({
  nombreTaller,
  logo,
  title,
  message,
  onRetry,
}: {
  nombreTaller: string;
  logo: string | null | undefined;
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PublicHeader nombreTaller={nombreTaller} logo={logo} />
      <main className="flex flex-1 items-start justify-center px-4 pb-8 pt-12">
        <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Icon name="alert-circle" size={24} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
          {onRetry && (
            <Button onClick={onRetry} className="mt-6" size="md">
              Reintentar
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

function StageStepper({ activeStage }: { activeStage: PublicStage }) {
  return (
    <nav aria-label="Etapas de reparación">
      <ol className="space-y-0">
        {PUBLIC_STAGES.map((stage, idx) => {
          const state = getStageState(stage, activeStage);
          const isLast = idx === PUBLIC_STAGES.length - 1;

          const stepNumber = (
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold sm:h-10 sm:w-10 ${
                state === 'completed'
                  ? 'bg-primary text-white'
                  : state === 'active'
                    ? 'border-2 border-primary bg-white text-primary'
                    : 'border-2 border-slate-200 bg-white text-slate-400'
              }`}
            >
              {state === 'completed' ? (
                <Icon name="check-circle" size={18} />
              ) : (
                <span>{idx + 1}</span>
              )}
            </span>
          );

          return (
            <li key={stage} className="flex gap-4">
              <div className="relative flex shrink-0 flex-col items-center pt-1">
                {stepNumber}
                {/* Connector line */}
                {!isLast && (
                  <span
                    className={`absolute top-10 h-[calc(100%-0.5rem)] w-0.5 ${
                      state === 'completed' ? 'bg-primary' : 'bg-slate-200'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1 pb-8">
                <p
                  className={`text-sm font-semibold sm:text-base ${
                    state === 'pending' ? 'text-slate-400' : 'text-slate-900'
                  }`}
                >
                  {stage}
                </p>
                <p className="text-xs text-slate-500 sm:text-sm">
                  {state === 'completed'
                    ? 'Etapa completada'
                    : state === 'active'
                      ? 'Etapa actual'
                      : 'Pendiente'}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function RepairInfo({ repair }: { repair: PublicRepairStatus }) {
  const specialBanner = SPECIAL_STATE_BANNERS[repair.estadoOrden];
  const stage = ESTADO_TO_PUBLIC_STAGE[repair.estadoOrden];

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Orden de reparación
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
          #{repair.numeroOrden}
        </h2>
      </section>

      <section className="grid gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-slate-500">Cliente</p>
          <p className="text-sm font-medium text-slate-900">
            {repair.cliente.nombre}
          </p>
          {repair.cliente.telefono && (
            <p className="text-sm text-slate-600">{repair.cliente.telefono}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500">Equipo</p>
          <p className="text-sm font-medium text-slate-900">
            {formatDevice(repair)}
          </p>
        </div>
        {repair.fechaIngreso && (
          <div>
            <p className="text-xs text-slate-500">Fecha de ingreso</p>
            <p className="text-sm font-medium text-slate-900">
              {formatDate(repair.fechaIngreso)}
            </p>
          </div>
        )}
      </section>

      <section>
        {specialBanner ? (
          <div
            className={`rounded-lg border p-4 ${
              specialBanner.tone === 'danger'
                ? 'border-red-100 bg-red-50'
                : 'border-slate-200 bg-slate-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 shrink-0 ${
                  specialBanner.tone === 'danger'
                    ? 'text-red-600'
                    : 'text-slate-500'
                }`}
              >
                <Icon
                  name={specialBanner.tone === 'danger' ? 'alert-circle' : 'info'}
                  size={18}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {specialBanner.title}
                </p>
                <p className="text-sm text-slate-700">{specialBanner.message}</p>
              </div>
            </div>
          </div>
        ) : (
          stage && (
            <>
              <h3 className="mb-4 text-base font-semibold text-slate-900">
                Seguimiento
              </h3>
              <StageStepper activeStage={stage} />
            </>
          )
        )}
      </section>

      {repair.fechaEstimadaEntrega && (
        <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 text-primary">
              <Icon name="info" size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Entrega estimada
              </p>
              <p className="text-sm text-slate-700">
                {formatDate(repair.fechaEstimadaEntrega)}
              </p>
            </div>
          </div>
        </section>
      )}

      {repair.observacionesPublicas && (
        <section>
          <h3 className="text-base font-semibold text-slate-900">
            Observaciones
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {repair.observacionesPublicas}
          </p>
        </section>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// PublicRepairStatusPage
// ──────────────────────────────────────────────

export function PublicRepairStatusPage() {
  const { id } = useParams<{ id: string }>();
  const {
    data: repair,
    isLoading,
    error,
    refetch,
  } = usePublicRepair(id);
  const { data: shopConfig } = usePublicShopConfig();

  const nombreTaller = shopConfig?.nombreTaller ?? 'Taller de Reparaciones';
  const logo = shopConfig?.logo;

  if (isLoading) {
    return <LoadingState nombreTaller={nombreTaller} logo={logo} />;
  }

  if (error) {
    const isNotFound = error instanceof ApiError && error.status === 404;
    return (
      <ErrorState
        nombreTaller={nombreTaller}
        logo={logo}
        title={isNotFound ? 'Orden no encontrada' : 'No se pudo cargar la orden'}
        message={
          isNotFound
            ? 'Verifica que el enlace o el código QR sea correcto.'
            : 'Ocurrió un error al consultar el estado de la reparación. Inténtalo de nuevo.'
        }
        onRetry={isNotFound ? undefined : () => refetch()}
      />
    );
  }

  if (!repair) {
    return (
      <ErrorState
        nombreTaller={nombreTaller}
        logo={logo}
        title="Orden no disponible"
        message="No se encontró información para esta orden."
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PublicHeader nombreTaller={nombreTaller} logo={logo} />

      <main className="flex-1 px-4 pb-8">
        <div className="mx-auto w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <RepairInfo repair={repair} />
        </div>

        <p className="mx-auto mt-6 max-w-xl text-center text-xs text-slate-400">
          Esta información es de solo lectura. Para más detalles, acércate al
          taller.
        </p>
      </main>
    </div>
  );
}
