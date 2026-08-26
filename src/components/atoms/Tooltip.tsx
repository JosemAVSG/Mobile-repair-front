import { useState, type ReactNode } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, placement = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip(), shift()],
  });

  const hover = useHover(context, { move: false });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  return (
    <>
      <span ref={refs.setReference} {...getReferenceProps()} className="contents">
        {children}
      </span>
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
