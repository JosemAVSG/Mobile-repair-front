import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface AuthUser {
  username: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'auth';
const MOCK_USERNAME = 'admin';
const MOCK_PASSWORD = 'admin';

interface StoredAuth {
  username: string;
  role: string;
}

function loadFromStorage(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (parsed && parsed.username) {
      return { username: parsed.username, role: parsed.role ?? 'admin' };
    }
    return null;
  } catch {
    return null;
  }
}

function saveToStorage(user: AuthUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(() => loadFromStorage());

  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      setUser(stored);
    }
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 600));

      if (username === MOCK_USERNAME && password === MOCK_PASSWORD) {
        const authedUser: AuthUser = { username, role: 'admin' };
        saveToStorage(authedUser);
        setUser(authedUser);
        return true;
      }

      return false;
    },
    [],
  );

  const logout = useCallback(() => {
    clearStorage();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: user !== null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
