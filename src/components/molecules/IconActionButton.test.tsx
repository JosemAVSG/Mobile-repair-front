import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IconActionButton } from './IconActionButton';

describe('IconActionButton', () => {
  it('exposes label as accessible name', () => {
    render(<IconActionButton icon="edit" label="Editar" />);
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('shows tooltip on focus', () => {
    render(<IconActionButton icon="edit" label="Editar" />);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Editar');
  });

  it('fires onClick', () => {
    const onClick = vi.fn();
    render(<IconActionButton icon="trash" label="Eliminar" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn();
    render(<IconActionButton icon="trash" label="Eliminar" onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies danger styles', () => {
    render(<IconActionButton icon="trash" label="Eliminar" variant="danger" />);
    expect(screen.getByRole('button', { name: 'Eliminar' }).className).toContain('text-red-600');
  });
});
