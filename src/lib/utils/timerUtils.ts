/**
 * Utilidades para manejar temporizadores e intervalos de manera eficiente
 */

/**
 * Versión optimizada de setTimeout que utiliza requestAnimationFrame cuando es posible
 * para operaciones visuales, y setTimeout tradicional para operaciones en segundo plano
 */
export function createOptimizedTimeout(callback: () => void, delay: number, isVisualUpdate = false): number {
    if (isVisualUpdate && typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
        const start = Date.now();
        
        const handle = { value: 0 };
        
        function loop() {
            const current = Date.now();
            if (current - start >= delay) {
                callback();
                return;
            }
            handle.value = requestAnimationFrame(loop);
        }
        
        handle.value = requestAnimationFrame(loop);
        return handle.value;
    } else {
        return setTimeout(callback, delay) as unknown as number;
    }
}

/**
 * Cancela un timeout creado con createOptimizedTimeout
 */
export function clearOptimizedTimeout(handle: number, isVisualUpdate = false): void {
    if (isVisualUpdate && typeof window !== 'undefined' && 'cancelAnimationFrame' in window) {
        cancelAnimationFrame(handle);
    } else {
        clearTimeout(handle);
    }
}

/**
 * Crea un intervalo optimizado que se ajusta automáticamente si las operaciones
 * tardan demasiado tiempo en completarse
 */
export function createAdaptiveInterval(callback: () => Promise<void> | void, targetInterval: number): { 
    start: () => void, 
    stop: () => void 
} {
    let running = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    async function executeAndSchedule() {
        if (!running) return;
        
        const startTime = Date.now();
        
        try {
            await callback();
        } catch (error) {
            console.error('Error en la función de intervalo:', error);
        }
        
        const executionTime = Date.now() - startTime;
        const nextDelay = Math.max(0, targetInterval - executionTime);
        
        // Programar la próxima ejecución
        timeoutId = setTimeout(executeAndSchedule, nextDelay);
    }
    
    return {
        start: () => {
            if (running) return;
            running = true;
            executeAndSchedule();
        },
        stop: () => {
            running = false;
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        }
    };
}

/**
 * Función para throttle - limita la frecuencia de ejecución de una función
 */
export function throttle<T extends (...args: never[]) => unknown>(func: T, limit: number): (...args: Parameters<T>) => void {
    let inThrottle = false;
    
    return function(this: unknown, ...args: Parameters<T>): void {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

/**
 * Función para debounce - retrasa la ejecución hasta que pase un tiempo sin llamadas
 */
export function debounce<T extends (...args: never[]) => unknown>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    
    return function(this: unknown, ...args: Parameters<T>): void {
        const later = () => {
            timeout = null;
            func.apply(this, args);
        };
        
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    };
}
