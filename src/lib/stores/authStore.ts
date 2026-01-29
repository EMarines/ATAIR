import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Definir la interfaz para el usuario
interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    // Añade otros campos según tus necesidades
}

// Estado inicial basado en localStorage (si estamos en el navegador)
const storedUser = browser ? localStorage.getItem('user') : null;
const initialUser = storedUser ? JSON.parse(storedUser) : null;

// Crear store
const createAuthStore = () => {
    const { subscribe, set } = writable<{
        user: User | null;
        isAuthenticated: boolean;
    }>({
        user: initialUser,
        isAuthenticated: !!initialUser
    });

    return {
        subscribe,
        
        // Función para iniciar sesión
        login: (user: User) => {
            if (browser) {
                localStorage.setItem('user', JSON.stringify(user));
            }
            set({ user, isAuthenticated: true });
        },
        
        // Función para cerrar sesión
        logout: () => {
            if (browser) {
                localStorage.removeItem('user');
            }
            set({ user: null, isAuthenticated: false });
        },
        
        // Función para verificar autenticación (útil para recuperar estado)
        checkAuth: () => {
            const storedUser = browser ? localStorage.getItem('user') : null;
            if (storedUser) {
                set({ user: JSON.parse(storedUser), isAuthenticated: true });
                return true;
            }
            return false;
        }
    };
};

// Exportar el store
export const authStore = createAuthStore();
