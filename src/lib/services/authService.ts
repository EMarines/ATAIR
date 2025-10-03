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
                    // Aumentar intervalo a 50 minutos para evitar renovaciones innecesarias
                    if (!lastTokenTime || (now - parseInt(lastTokenTime)) > 50 * 60 * 1000) {
                        const token = await user.getIdToken(false); // No forzar renovación
                        this.saveToken(token);
                        console.log(`✅ Token actualizado vía onIdTokenChanged`);
                    }
                } catch (error) {
                    console.warn('⚠️ Error al procesar cambio de token, la sesión continúa:', error);
                    // No desconectar al usuario por errores de renovación
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

        // Aumentar intervalo mínimo a 45 minutos (tokens de Firebase duran 1 hora)
        const actualDelay = Math.max(delay, 45 * 60 * 1000);

        this.clearTokenRefreshTimer();

        this.tokenRefreshTimer = setTimeout(async () => {
            if (this.internalAuthInstance?.currentUser) {
                try {
                    // Solo verificar, no forzar renovación a menos que sea necesario
                    await this.internalAuthInstance.currentUser.getIdToken(false);
                    localStorage.setItem('last-token-refresh', Date.now().toString());
                    console.log('✅ Token verificado automáticamente');
                    // Reprogramar la siguiente verificación
                    this.scheduleTokenRefresh(45 * 60 * 1000);
                } catch (error) {
                    console.warn('⚠️ Error al verificar token:', error);
                    // Intentar reprogramar en caso de error de red temporal
                    this.scheduleTokenRefresh(5 * 60 * 1000); // Reintentar en 5 min
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
            // Cambiado a localStorage para persistencia entre sesiones
            localStorage.setItem('firebase-token', token);
            localStorage.setItem('user-logged-in', 'true');
            localStorage.setItem('last-token-refresh', Date.now().toString());
            console.log('✅ Token guardado en localStorage');
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
            localStorage.removeItem('firebase-token');
            localStorage.removeItem('user-logged-in');
            localStorage.removeItem('last-token-refresh');
            console.log('🧹 Token limpiado del almacenamiento');
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
            // Verificar token sin forzar renovación
            await getIdTokenResult(currentUser);
            const token = await currentUser.getIdToken(false);
            
            // Guardar token y actualizar estado
            this.saveToken(token);
            localStorage.setItem('user-logged-in', 'true');
            localStorage.setItem('last-token-refresh', Date.now().toString());

            // Si el temporizador de refresco no está activo, iniciarlo
            if (!this.tokenRefreshTimer) {
                this.scheduleTokenRefresh(45 * 60 * 1000);
            }
            
            console.log('✅ Sesión verificada exitosamente');
            return true;
        } catch (error: unknown) {
            const errorMessage = error && typeof error === 'object' && 'message' in error 
                ? (error as { message: string }).message 
                : String(error);
            
            // Solo limpiar token si es un error crítico de autenticación
            if (error && typeof error === 'object' && 'code' in error) {
                const errorCode = (error as { code: string }).code;
                
                if (errorCode === 'auth/user-token-expired' || 
                    errorCode === 'auth/invalid-user-token' ||
                    errorCode === 'auth/user-disabled') {
                    console.error('❌ Token inválido o usuario deshabilitado:', errorCode);
                    this.clearToken();
                    return false;
                }
            }
            
            // Para otros errores (red, etc), no desconectar
            console.warn('⚠️ Error temporal al verificar token:', errorMessage);
            // Si había un login previo válido, mantener la sesión
            if (localStorage.getItem('user-logged-in') === 'true') {
                console.log('ℹ️ Manteniendo sesión existente a pesar del error temporal');
                return true;
            }
            
            return false;
        }
    }
}

// Exportar una instancia singleton del servicio
export const authService = new AuthService();
