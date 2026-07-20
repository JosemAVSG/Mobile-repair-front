import { useState, useEffect, useRef } from 'react';
import { Input } from '../atoms/Input';
import { Icon } from '../atoms/Icon';

interface SearchFieldProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchField({
  value = '',
  onChange,
  placeholder = 'Buscar...',
  debounceMs = 400,
}: SearchFieldProps) {
  const [local, setLocal] = useState(value);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(timer);
  }, [local, debounceMs, onChange]);

  // Sync external value changes
  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
        <Icon name="search" size={16} />
      </span>
      <Input
        type="text"
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="w-full pl-9"
      />
    </div>
  );
}
