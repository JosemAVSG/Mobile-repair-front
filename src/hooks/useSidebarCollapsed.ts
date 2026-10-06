import { useCallback, useState } from 'react';

export const SIDEBAR_COLLAPSED_KEY = 'sidebar:collapsed';

function readStored(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false; // storage no disponible: visible por defecto
  }
}

/** Estado colapsado del sidebar (desktop), persistido en localStorage. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean>(readStored);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignorar: el estado sigue funcionando en memoria
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
