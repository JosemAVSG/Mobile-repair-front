import type { InputHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Marca el campo como inválido (borde rojo) sin mostrar mensaje propio. */
  invalid?: boolean;
  /** Ícono lucide anclado a la izquierda del campo. */
  icon?: IconName;
  /** Elemento opcional anclado a la derecha del campo (p.ej. toggle de contraseña). */
  rightElement?: ReactNode;
}

export function Input({
  label,
  error,
  invalid,
  id,
  icon,
  rightElement,
  className = '',
  ...rest
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const isInvalid = Boolean(error) || Boolean(invalid);

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={`peer w-full rounded-lg border px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
            icon ? 'pl-11' : ''
          } ${rightElement ? 'pr-11' : ''} ${
            isInvalid
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : 'border-slate-300 focus:border-primary focus:ring-primary'
          } ${className}`}
          aria-invalid={isInvalid || undefined}
          {...rest}
        />
        {icon && (
          <Icon
            name={icon}
            size={18}
            className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 peer-focus:text-primary ${
              isInvalid ? 'text-red-500' : 'text-slate-400'
            }`}
          />
        )}
        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
            {rightElement}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}