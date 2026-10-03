import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../api/ApiClient';
import { RegistroPage } from './RegistroPage';

const register = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ register, isAuthenticated: false }),
}));
vi.mock('../context/ConfigContext', () => ({
  useConfig: () => ({ config: { nombreTaller: 'Fixtra', logo: null } }),
}));

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillValid() {
  type('Nombre del taller', 'Taller Rápido');
  type('Tu nombre', 'Ana');
  type('Correo', 'ana@correo.com');
  type('Usuario', 'ana');
  type('Contraseña', 'password1');
  type('Confirmar contraseña', 'password1');
}

describe('RegistroPage', () => {
  beforeEach(() => {
    register.mockReset();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <RegistroPage />
      </MemoryRouter>,
    );

  it('no envía si hay errores de validación', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Crear taller' }));
    expect(register).not.toHaveBeenCalled();
    expect(screen.getByText(/al menos 8 caracteres/)).toBeInTheDocument();
  });

  it('envía el honeypot vacío y muestra el 409 en español', async () => {
    register.mockImplementation(async () => {
      throw new ApiError('dup', 409);
    });
    renderPage();
    fillValid();
    fireEvent.click(screen.getByRole('button', { name: 'Crear taller' }));

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    expect(register.mock.calls[0][0]).toMatchObject({
      username: 'ana',
      website: '',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/ya está en uso/);
  });

  it('el honeypot está fuera del flujo de foco y oculto a lectores de pantalla', () => {
    renderPage();
    const honeypot = document.getElementById('website') as HTMLInputElement;
    expect(honeypot.tabIndex).toBe(-1);
    expect(honeypot.autocomplete).toBe('off');
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
