import { formatDateTime } from '../../utils/formatters';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface TimelineEvent {
  date: string;
  content: string;
  type: 'created' | 'status' | 'note';
}

interface OrderTimelineProps {
  events: TimelineEvent[];
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const dotColors: Record<TimelineEvent['type'], string> = {
  created: 'bg-blue-500',
  status: 'bg-amber-500',
  note: 'bg-slate-400',
};

// ──────────────────────────────────────────────
// OrderTimeline
// ──────────────────────────────────────────────

export function OrderTimeline({ events }: OrderTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-slate-500">
        No hay eventos registrados
      </p>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, idx) => {
          const isLast = idx === events.length - 1;

          return (
            <li key={idx}>
              <div className="relative pb-8">
                {/* Connector line */}
                {!isLast && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200"
                    aria-hidden="true"
                  />
                )}

                <div className="relative flex items-start gap-4">
                  {/* Dot indicator */}
                  <span
                    className={`relative mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${dotColors[event.type]}`}
                  >
                    <span className="h-2 w-2 rounded-full bg-white" />
                  </span>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-700">
                      {event.content}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {formatDateTime(event.date)}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
