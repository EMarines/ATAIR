// Variable para almacenar referencia a la ventana abierta
let whatsappWindow: Window | null = null;

// Detectores de plataforma
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : ''
);

const isAndroid = /Android/i.test(
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
  
  // CASO ESPECIAL: Android con WhatsApp Business
  if (isAndroid && useBusiness) {
    try {
      // Intent específico para WhatsApp Business en Android
      // Este esquema de URL intenta forzar la apertura en WhatsApp Business
      const businessUrl = `whatsapp://send?phone=52${tel}&text=${encodedMsg}&app_absent=0`;
      window.location.href = businessUrl;
      
      // Como alternativa, intentar con un tiempo de espera y luego probar con el esquema universal
      setTimeout(() => {
        const waUrl = `https://wa.me/52${tel}?text=${encodedMsg}`;
        window.location.href = waUrl;
      }, 300);
      
      return { close: () => console.log("Redireccionado a WhatsApp Business") };
    } catch (error) {
      console.error("Error al intentar abrir WhatsApp Business:", error);
      // Si falla, continuamos con el método estándar
    }
  }
  
  // Estrategia específica para dispositivos móviles
  if (isMobile) {
    // Usar wa.me que es compatible con ambas versiones de WhatsApp
    const whatsappUrl = `https://wa.me/52${tel}?text=${encodedMsg}`;
    
    // En dispositivos móviles, redireccionar directamente
    window.location.href = whatsappUrl;
    return { close: () => console.log("Redireccionado a app nativa") };
  }
  
  // Para navegadores de escritorio:
  let whatsappUrl: string;
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