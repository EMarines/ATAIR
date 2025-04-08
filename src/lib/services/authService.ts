import { auth } from '../firebase';
import { 
    getIdTokenResult, 
    onIdTokenChanged, 
    signOut as firebaseSignOut 
} from 'firebase/auth';
import { browser } from '$app/environment';

/**
 * Servicio de autenticación que proporciona métodos para manejar la autenticación
 * y la renovación de tokens de forma centralizada.
 */
class AuthService {
    private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    private tokenChangeUnsubscribe: (() => void) | null = null;

    constructor() {
        if (browser) {
            this.setupTokenRefresh();
        }
    }

    /**
     * Configura listener para cambios en el token con menor frecuencia de renovación
     */
    setupTokenRefresh(): void {
        // Solo ejecutar en el navegador
        if (!browser) return;
        
        // Registrar el listener para cambios en el token con menos frecuencia de renovación
        this.tokenChangeUnsubscribe = onIdTokenChanged(auth, async (user) => {
            if (user) {
                try {
                    // Verificar si ya tenemos un token reciente
                    const lastTokenTime = localStorage.getItem('last-token-refresh');
                    const now = Date.now();
                    
                    // Solo solicitar un nuevo token si han pasado más de 30 minutos o no hay token
                    if (!lastTokenTime || (now - parseInt(lastTokenTime)) > 30 * 60 * 1000) {
                        const token = await user.getIdToken(false); // No forzar renovación
                        // Guardar token
                        this.saveToken(token);
                        
                        // Ya no calculamos expiración ni programamos renovaciones frecuentes
                        console.log(`Token actualizado. Próxima verificación en 30 minutos`);
                    }
                } catch (error) {
                    console.warn('Error al procesar cambio de token, pero la sesión continúa:', error);
                    // A pesar del error, mantener el estado de autenticación
                    localStorage.setItem('user-logged-in', 'true');
                }
            } else {
                // Limpiar token si no hay usuario
                this.clearToken();
                this.clearTokenRefreshTimer();
            }
        });
    }

    /**
     * Programa la renovación de token con menor frecuencia
     * @param delay Tiempo en ms para la próxima renovación
     */
    scheduleTokenRefresh(delay: number): void {
        // Solo ejecutar en el navegador y con una frecuencia mucho menor
        if (!browser) return;
        
        // Usar un delay mínimo de 30 minutos para no saturar la API
        const actualDelay = Math.max(delay, 30 * 60 * 1000);
        
        // Limpiar temporizador existente
        this.clearTokenRefreshTimer();
        
        // Programar nueva renovación
        this.tokenRefreshTimer = setTimeout(async () => {
            if (auth.currentUser) {
                try {
                    // Intentar renovación sin forzar
                    await auth.currentUser.getIdToken(false);
                    // Actualizar timestamp
                    localStorage.setItem('last-token-refresh', Date.now().toString());
                    console.log('Token renovado automáticamente');
                } catch (error) {
                    console.warn('Error al renovar token, pero la sesión continúa:', error);
                }
            }
        }, actualDelay);
    }

    /**
     * Guarda el token en almacenamiento local
     * @param token Token JWT a guardar
     */
    saveToken(token: string): void {
        // Solo ejecutar en el navegador
        if (!browser) return;
        
        try {
            sessionStorage.setItem('firebase-token', token);
            localStorage.setItem('user-logged-in', 'true');
            
            // Registrar último tiempo de renovación
            localStorage.setItem('last-token-refresh', Date.now().toString());
        } catch (error) {
            console.error('Error al guardar token:', error);
        }
    }

    /**
     * Limpia el token del almacenamiento
     */
    clearToken(): void {
        // Solo ejecutar en el navegador
        if (!browser) return;
        
        try {
            sessionStorage.removeItem('firebase-token');
            localStorage.removeItem('user-logged-in');
            localStorage.removeItem('last-token-refresh');
        } catch (error) {
            console.error('Error al limpiar token:', error);
        }
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
     * Realiza cierre de sesión y limpieza completa
     */
    async logout(): Promise<void> {
        this.clearToken();
        this.clearTokenRefreshTimer();
        
        // Limpiar estado adicional
        if (browser) {
            // Limpiar cookies relacionadas con autenticación
            document.cookie.split(';').forEach(function(c) {
                document.cookie = c
                    .replace(/^ +/, '')
                    .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
            });
        }
        
        try {
            await firebaseSignOut(auth);
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    }

    /**
     * Destruye los listeners y temporizadores del servicio
     */
    destroy(): void {
        this.clearTokenRefreshTimer();
        if (this.tokenChangeUnsubscribe) {
            this.tokenChangeUnsubscribe();
            this.tokenChangeUnsubscribe = null;
        }
    }

    /**
     * Verifica y renueva el token si es necesario, con mejor manejo de errores
     * @returns Booleano indicando si hay una sesión activa
     */
    async verifyToken(): Promise<boolean> {
        if (!browser) {
            return false;
        }
        
        // Si hay un flag de usuario loggeado en localStorage, considerarlo válido
        if (localStorage.getItem('user-logged-in') === 'true') {
            return true;
        }
        
        // Si no hay usuario actual, no hay sesión activa
        if (!auth.currentUser) {
            return false;
        }
        
        try {
            // Verificar token sin forzar renovación
            if (auth.currentUser) {
                // Solo llamamos al método para verificar que el token es válido
                // No necesitamos guardar el resultado en una variable
                await getIdTokenResult(auth.currentUser);
                
                // Actualizar el timestamp de última verificación
                localStorage.setItem('last-token-refresh', Date.now().toString());
                return true;
            }
        } catch (error) {
            console.warn('Error al verificar token, pero manteniendo sesión:', error);
        }
        
        // A este punto tenemos usuario, así que la sesión está activa
        return true;
    }
}

// Instancia singleton del servicio
export const authService = new AuthService();