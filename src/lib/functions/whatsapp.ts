/**
 * Abre WhatsApp Web con un número y mensaje específicos
 * @param tel - Número de teléfono
 * @param msg - Mensaje a enviar
 * @returns Instancia de la ventana abierta
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
    
    console.log(`📱 Abriendo WhatsApp para: ${finalTel}`);
    
    // Abrir en una nueva ventana
    // Esto devuelve un objeto Window que tiene el método .close()
    const newWindow = window.open(url, '_blank');
    
    return newWindow;
}
