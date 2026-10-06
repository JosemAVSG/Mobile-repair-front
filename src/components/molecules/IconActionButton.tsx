import type { MouseEvent } from 'react';
import { Icon, type IconName } from '../atoms/Icon';
import { Tooltip } from '../atoms/Tooltip';

type IconActionVariant = 'default' | 'danger';
type IconActionSize = 'md' | 'lg';

interface IconActionButtonProps {
  icon: IconName;
  /** Used for both the tooltip content and the accessible name. */
  label: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variant?: IconActionVariant;
  disabled?: boolean;
  size?: IconActionSize;
}

const variantStyles: Record<IconActionVariant, string> = {
  default:
    'text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-blue-500 disabled:text-slate-300',
  danger:
    'text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:ring-red-500 disabled:text-red-300',
};

// md = 36px (desktop rows), lg = 40px (mobile touch target)
const sizeStyles: Record<IconActionSize, { box: string; icon: number }> = {
  md: { box: 'h-9 w-9', icon: 18 },
  lg: { box: 'h-10 w-10', icon: 20 },
};

export function IconActionButton({
  icon,
  label,
  onClick,
  variant = 'default',
  disabled = false,
  size = 'md',
}: IconActionButtonProps) {
  const s = sizeStyles[size];
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${s.box} ${variantStyles[variant]}`}
      >
        <Icon name={icon} size={s.icon} />
      </button>
    </Tooltip>
  );
}
