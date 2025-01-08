const diaSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sábado' ];
// const mesAnyo = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic' ];
let fecha ;
let saludoHora;
// let dia, mes, ano;
// let mes;



// Convertir fecha en timestamp a formato legible SIN hora

      export function formatDate(timestamp: number) {
        try {
          if (!timestamp) return ''
          
          const date = new Date(timestamp)
          if (isNaN(date.getTime())) return ''  // Validar fecha válida
          
          return date.toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            year: '2-digit'
          })
          .replace('.', '')
          .toLowerCase()
        } catch (error) {
          console.error('Error formatting date:', error)
          return ''
        }
      }

// Convertir HORA en timestamp   
      export function formatHour(timestamp: number): string {
        try {
          if (!timestamp) return ''
          
          const fecha = new Date(timestamp)
          if (isNaN(fecha.getTime())) return ''
          
          return fecha.toLocaleTimeString('es-MX', {
            hour: 'numeric',    // sin cero inicial
            minute: '2-digit',  // mantener dos dígitos para minutos
            hour12: true        // formato 12 horas
          })
          .replace(/\s*(a\.|p\.).*m\./, '') // eliminar el a.m. o p.m.
        } catch (error) {
          console.error('Error formatting hour:', error)
          return ''
        }
      }
      

//  Extraer dia de la semana
        /**
 * @param {string | number | Date} fecha
 */
        export function formatDay(timestamp: number): string {
          try {
            if (!timestamp) return ''
            
            const fecha = new Date(timestamp)
            if (isNaN(fecha.getTime())) return ''
            
            return fecha.toLocaleDateString('es-MX', {
              weekday: 'long'  // nombre completo del día
            })
            .toLowerCase()
            .replace(/[áéíóú]/g, match => {  // Mantener acentos
              return match
            })
          } catch (error) {
            console.error('Error formatting day:', error)
            return ''
          }
        }

// Definir si es dia, tarde o noche
        export function diaTarde(): string {
          try {
            const fecha = new Date()
            if (isNaN(fecha.getTime())) return ''
            
            const hora = fecha.toLocaleTimeString('es-MX', {
              hour: 'numeric',
              hour12: false
            })
            
            const horaNum = parseInt(hora)
            
            if (horaNum >= 5 && horaNum < 12) {
              return "Buenos días"
            } else if (horaNum >= 12 && horaNum < 20) {
              return "Buenas tardes"
            } else {
              return "Buenas noches"
            }
          } catch (error) {
            console.error('Error getting greeting:', error)
            return ''
          }
        }


        export function timestampToDate(timestamp: number): string {
          try {
            if (!timestamp) return ''
            
            const fecha = new Date(timestamp)
            if (isNaN(fecha.getTime())) return ''
            
            return fecha.toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'short',
              year: '2-digit'
            })
            .replace('.', '')
            .toLowerCase()
          } catch (error) {
            console.error('Error converting timestamp to date:', error)
            return ''
          }
        }
        
        // Y mantenemos la función original para convertir a timestamp
        export function dateToTimestamp(fecha: string | number | Date): number {
          try {
            const timestamp = new Date(fecha).getTime()
            if (isNaN(timestamp)) return 0
            return timestamp
          } catch (error) {
            console.error('Error converting date to timestamp:', error)
            return 0
          }
        }