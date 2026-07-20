import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({
  title,
  subtitle,
  children,
  className = '',
  padding = true,
}: CardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {(title || subtitle) && (
        <div className={`border-b border-slate-100 ${padding ? 'px-5 py-4' : 'px-0 py-4'}`}>
          {title && (
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          )}
          {subtitle && (
            <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
      )}
      <div className={padding ? 'p-5' : ''}>{children}</div>
    </div>
  );
}
