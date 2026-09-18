import { isSandbox } from '$lib/firebase_toggle';

/**
 * Abre WhatsApp Web con un número y mensaje específicos.
 * En modo Sandbox (pruebas/localhost), simula el envío en consola sin abrir ventanas de WhatsApp.
 * @param tel - Número de teléfono
 * @param msg - Mensaje a enviar
 * @returns Instancia de la ventana abierta o mock seguro en Sandbox
 */
export function sendWhatsApp(tel: string, msg: string) {
    if (!tel) {
        console.error('No se proporcionó número de teléfono para WhatsApp');
        return null;
    }

    // Limpiar el número de teléfono (solo números)
    const cleanTel = tel.replace(/\D/g, '');
    
    // Si el número no tiene código de país y parece ser de México (10 dígitos), agregar 52
    const finalTel = (cleanTel.length === 10 && !cleanTel.startsWith('52')) 
        ? '52' + cleanTel 
        : cleanTel;

    // Crear la URL de WhatsApp (preferimos wa.me por ser más corto y directo)
    const url = `https://wa.me/${finalTel}?text=${encodeURIComponent(msg)}`;
    
    // 🧪 En Sandbox no se abre ventana ni se envía enlace, solo se simula
    if (isSandbox) {
        console.log(`🧪 [Sandbox] Simulación de envío WhatsApp a: ${finalTel}`);
        console.log(`💬 [Sandbox] Mensaje que se enviaría: ${msg}`);
        return {
            close: () => {},
            closed: false,
            focus: () => {}
        } as unknown as Window;
    }

    console.log(`📱 Abriendo WhatsApp para: ${finalTel}`);
    
    // Abrir en una nueva ventana
    // Esto devuelve un objeto Window que tiene el método .close()
    const newWindow = window.open(url, '_blank');
    
    return newWindow;
}

