import { auth as authStore } from './firebaseEnvironmentService'; // Importar directamente el store de firebaseEnvironmentService
import type { Auth, User } from 'firebase/auth'; // Importar tipos necesarios
import {
    getIdTokenResult,
    onIdTokenChanged,
    signOut as firebaseSignOut
} from 'firebase/auth';
import { browser } from '$app/environment';

// Store para el estado del usuario
// No es necesario un store local aquí si el estado se maneja externamente o no se necesita un store específico para este servicio

class AuthService {
    private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    private tokenChangeUnsubscribe: (() => void) | null = null;
    private internalAuthInstance: Auth | null = null; // Para almacenar la instancia de Auth
    private authStoreUnsubscribe: (() => void) | null = null; // Para desuscribirse del store

    constructor() {
        if (browser) {
            // Suscribirse a los cambios en la instancia de Auth
            this.authStoreUnsubscribe = authStore.subscribe(authInstanceFromStore => {
                if (authInstanceFromStore) {
                    if (this.internalAuthInstance !== authInstanceFromStore) {
                        // Si la instancia cambia (ej. de test a prod), limpiar y reconfigurar
                        this.destroyListeners(); // Limpiar listeners antiguos
                        this.internalAuthInstance = authInstanceFromStore;
                        this.setupTokenRefresh();
                        // Si hay un usuario actual, podríamos querer verificar el token o iniciar el schedule
                        if (this.internalAuthInstance.currentUser) {
                            this.verifyToken().then(isActive => {
                                if (isActive && !this.tokenRefreshTimer) {
                                    this.scheduleTokenRefresh(30 * 60  * 1000);
                                }
                            });
                        }
                    }
                } else {
                    // Si la instancia se vuelve null
                    this.destroyListeners();
                    this.internalAuthInstance = null;
                }
            });
        }
    }

    /**
     * Limpia listeners y temporizadores asociados a una instancia de Auth.
     */
    private destroyListeners(): void {
        if (this.tokenChangeUnsubscribe) {
            this.tokenChangeUnsubscribe();
            this.tokenChangeUnsubscribe = null;
        }
        this.clearTokenRefreshTimer();
    }

    /**
     * Configura listener para cambios en el token con menor frecuencia de renovación
     */
    setupTokenRefresh(): void {
        if (!browser || !this.internalAuthInstance) return;

        // Asegurarse de que no haya un listener previo activo para esta instancia
        if (this.tokenChangeUnsubscribe) this.tokenChangeUnsubscribe();

        this.tokenChangeUnsubscribe = onIdTokenChanged(this.internalAuthInstance, async (user: User | null) => {
            if (user) {
                try {
                    const lastTokenTime = localStorage.getItem('last-token-refresh');
                    const now = Date.now();
                    if (!lastTokenTime || (now - parseInt(lastTokenTime)) > 30 * 60 * 1000) {
                        const token = await user.getIdToken(false); // No forzar renovación
                        this.saveToken(token);
                        console.log(`Token actualizado vía onIdTokenChanged. Próxima verificación programada si es necesario.`);
                    }
                } catch (error) {
                    console.warn('Error al procesar cambio de token, pero la sesión continúa:', error);
                    // Aquí podrías manejar errores específicos si es necesario
                }
            } else {
                // Limpiar token si no hay usuario
                this.clearToken();
            }
        });
    }

    /**
     * Programa la renovación del token
     * @param delay Tiempo en ms para la próxima renovación
     */
    scheduleTokenRefresh(delay: number): void {
        if (!browser || !this.internalAuthInstance?.currentUser) return;

        const actualDelay = Math.max(delay, 30 * 60 * 1000);

        this.clearTokenRefreshTimer();

        this.tokenRefreshTimer = setTimeout(async () => {
            if (this.internalAuthInstance?.currentUser) {
                try {
                    // Usar getIdToken(true) para forzar la renovación si está cerca de expirar o expirado.
                    // La SDK maneja la lógica de si realmente necesita hacer una llamada de red.
                    await this.internalAuthInstance.currentUser.getIdToken(true);
                    localStorage.setItem('last-token-refresh', Date.now().toString());
                    console.log('Token verificado/renovado automáticamente por scheduleTokenRefresh');
                    // Reprogramar la siguiente verificación
                    this.scheduleTokenRefresh(30 * 60 * 1000);
                } catch (error) {
                    console.warn('Error al renovar token en scheduleTokenRefresh:', error);
                    // Podríamos intentar reprogramar con un backoff aquí si es un error transitorio o si el usuario sigue activo.
                }
            }
        }, actualDelay);
    }

    /**
     * Limpia el temporizador de renovación de token
     */
    clearTokenRefreshTimer(): void {
        if (this.tokenRefreshTimer) {
            clearTimeout(this.tokenRefreshTimer);
            this.tokenRefreshTimer = null;
        }
    }

    /**
     * Guarda el token en el almacenamiento
     * @param token Token JWT a guardar
     */
    saveToken(token: string): void {
        if (!browser) return;
        try {
            sessionStorage.setItem('firebase-token', token);
            localStorage.setItem('user-logged-in', 'true');
            localStorage.setItem('last-token-refresh', Date.now().toString());
        } catch (error) {
            console.error('Error al guardar token:', error);
        }
    }

    /**
     * Limpia el token del almacenamiento
     */
    clearToken(): void {
        if (!browser) return;
        try {
            sessionStorage.removeItem('firebase-token');
            localStorage.removeItem('user-logged-in');
            localStorage.removeItem('last-token-refresh'); // También limpiar este
        } catch (error) {
            console.error('Error al limpiar token:', error);
        }
    }

    /**
     * Cierra la sesión del usuario
     */
    async logout(): Promise<void> {
        this.clearToken();
        this.destroyListeners(); // Esto incluye clearTokenRefreshTimer y tokenChangeUnsubscribe

        if (browser) {
            // Limpiar cookies relacionadas con autenticación
            document.cookie.split(';').forEach(function(c) {
                document.cookie = c.trim().split('=')[0] +
                    '=;expires=' + new Date(0).toUTCString() + ';path=/';
                document.cookie = c.trim().split('=')[0] +
                    '=;expires=' + new Date().toUTCString() + ';path=/';
            });
        }

        try {
            if (this.internalAuthInstance) {
                await firebaseSignOut(this.internalAuthInstance);
            }
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }

    /**
     * Destruye los listeners y temporizadores del servicio
     */
    destroy(): void {
        this.destroyListeners();
        if (this.authStoreUnsubscribe) {
            this.authStoreUnsubscribe();
            this.authStoreUnsubscribe = null;
        }
    }

    /**
     * Verifica si la sesión del usuario está activa
     * @returns true si la sesión está activa, false en caso contrario
     */
    async verifyToken(): Promise<boolean> {
        if (!browser) {
            return false;
        }

        if (!this.internalAuthInstance) {
            console.warn("Auth instance no disponible para verifyToken");
            return false;
        }

        const currentUser = this.internalAuthInstance.currentUser;

        if (!currentUser) {
            // Si no hay usuario, pero hay un flag de login, limpiar el flag.
            if (localStorage.getItem('user-logged-in') === 'true') {
                this.clearToken();
            }
            return false;
        }

        // Tenemos un currentUser. Intentemos verificar su token.
        try {
            // getIdTokenResult no fuerza la renovación a menos que el token esté a punto de expirar.
            // Es una buena forma de obtener el estado actual y las claims.
            await getIdTokenResult(currentUser);
            localStorage.setItem('user-logged-in', 'true'); // Asegurar que el flag esté puesto
            localStorage.setItem('last-token-refresh', Date.now().toString());

            // Si el temporizador de refresco no está activo, iniciarlo.
            if (!this.tokenRefreshTimer) {
                this.scheduleTokenRefresh(30 * 60 * 1000);
            }
            return true;
        } catch (error: unknown) { // Usar unknown como tipo más seguro que any
            const errorMessage = error && typeof error === 'object' && 'message' in error 
                ? (error as { message: string }).message 
                : String(error);
            console.warn('Error al verificar/obtener token en verifyToken:', errorMessage);
            // Si el token no es válido (ej. auth/user-token-expired, auth/invalid-user-token),
            // onIdTokenChanged debería eventualmente manejarlo si el SDK no puede refrescarlo.
            // Por ahora, consideramos la sesión no verificada y limpiamos el estado local.
            if (error && typeof error === 'object' && 'code' in error) {
                if (error.code === 'auth/user-token-expired' || error.code === 'auth/invalid-user-token') {
                    this.clearToken(); // El token no es válido, clearToken ya elimina 'last-token-refresh'
                }
            } else {
                console.error("Error no reconocido o sin código en verifyToken:", error);
            }
            return false;
        }
    }
}

// Exportar una instancia singleton del servicio
export const authService = new AuthService();
