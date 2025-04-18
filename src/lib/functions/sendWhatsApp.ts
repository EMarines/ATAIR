// Variable para almacenar referencia a la ventana abierta
let whatsappWindow: Window | null = null;

// Detectar si estamos en un dispositivo móvil
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : ''
);

/**
 * Envía un mensaje de WhatsApp y devuelve referencia a la ventana
 * @param tel Número de teléfono sin prefijo
 * @param msg Mensaje a enviar
 * @param useBusiness Intenta forzar WhatsApp Business
 * @returns Objeto con método para cerrar la ventana
 */
export function sendWhatsApp(tel: string, msg: string, useBusiness: boolean = true) { 
  // Verificar que estamos en el navegador
  if (typeof window === 'undefined') {
    console.log("No estamos en un navegador, no se puede abrir WhatsApp");
    return { close: () => {} };
  }

  // Cerrar ventana previa si existe
  if (whatsappWindow && !whatsappWindow.closed) {
    whatsappWindow.close();
  }
  
  // Codificar mensaje para URL
  const encodedMsg = encodeURIComponent(msg);
  
  // Determinar la URL según el tipo de WhatsApp deseado y la plataforma
  let whatsappUrl: string;
  
  // Estrategia específica para dispositivos móviles - MÉTODO ACTUALIZADO Y SEGURO
  if (isMobile) {
    // Usar wa.me que es más compatible con ambas versiones de WhatsApp
    whatsappUrl = `https://wa.me/52${tel}?text=${encodedMsg}`;
    
    // En dispositivos móviles, redireccionar directamente (más confiable)
    window.location.href = whatsappUrl;
    return { close: () => console.log("Redireccionado a app nativa") };
  }
  
  // Para navegadores de escritorio:
  if (useBusiness) {
    // URL que favorece WhatsApp Business
    whatsappUrl = `https://wa.me/52${tel}?text=${encodedMsg}`;
  } else {
    // URL tradicional de WhatsApp
    whatsappUrl = `https://api.whatsapp.com/send?phone=52${tel}&text=${encodedMsg}`;
  }
  
  // Abrir la ventana de WhatsApp
  try {
    whatsappWindow = window.open(
      whatsappUrl, 
      "whatsapp_window",
      "width=800,height=600,scrollbars=yes"
    );
    
    // En caso de que el popup sea bloqueado
    if (!whatsappWindow) {
      console.warn("El navegador bloqueó la apertura de la ventana. Intentando redirección directa...");
      window.location.href = whatsappUrl;
    }
  } catch (error) {
    console.error("Error al abrir ventana de WhatsApp:", error);
    // Fallback a redirección directa
    window.location.href = whatsappUrl;
  }
  
  // Devolver objeto con método para cerrar la ventana
  return {
    close: () => {
      if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.close();
        whatsappWindow = null;
      }
    }
  };
}

/**
 * Cierra la ventana de WhatsApp si está abierta
 */
export function closeWhatsAppWindow() {
  if (typeof window === 'undefined') return false;
  
  if (whatsappWindow && !whatsappWindow.closed) {
    whatsappWindow.close();
    whatsappWindow = null;
    return true;
  }
  return false;
}