import type { Contact, Property, Todo } from '$lib/types';

// Extend the Binnacle type to include contactId
type Binnacle = {
  id: string;
  date: number;
  comment: string;
  action: string;
  to: string;
  contactId?: string; // Added contactId as optional
};
import { browser } from '$app/environment';

// Funciones para preservar datos reales modificados
let cachedContacts: Contact[] = [];
let cachedProperties: Property[] = [];
let cachedBinnacles: Binnacle[] = [];
let cachedTodos: Todo[] = [];

// Modificadores para anonimizar datos sensibles
function anonymizeContact(contact: Contact): Contact {
  // Generar un teléfono falso que parece real pero es aleatorio
  const fakePhone = `55${Math.floor(1000000 + Math.random() * 9000000)}`;
  
  // Modificar correo electrónico manteniendo el dominio
  let fakeEmail = contact.email;
  if (fakeEmail && fakeEmail.includes('@')) {
    const [, domain] = fakeEmail.split('@');
    fakeEmail = `user${Math.floor(Math.random() * 10000)}@${domain}`;
  } else {
    fakeEmail = `user${Math.floor(Math.random() * 10000)}@ejemplo.com`;
  }

  // Crear una copia segura del contacto con los cambios
  const result = {
    ...contact,
    telephon: fakePhone,
    email: fakeEmail,
    id: `mock-${contact.id}`
  };
  
  // Añadir public_id si existe en el objeto original
  if ('public_id' in contact && contact['public_id']) {
    result['public_id'] = `mock-${contact['public_id']}`;
  }
  
  return result;
}

function anonymizeProperty(property: Property): Property {
  // Modificar ligeramente el precio (±10%)
  const priceVariation = 0.9 + Math.random() * 0.2; // Entre 0.9 y 1.1
  const modifiedPrice = property.price ? Math.round(property.price * priceVariation) : undefined;

  // Crear una copia segura de la propiedad
  const result = {
    ...property,
    price: modifiedPrice,
    id: `mock-${property.public_id}`,
    title: property.title ? `[TEST] ${property.title}` : undefined
  };
  
  // Añadir public_id si existe en el objeto original
  if ('public_id' in property && property['public_id']) {
    result['public_id'] = `mock-${property['public_id']}`;
  }
  
  return result;
}

/**
 * Guarda una copia de datos reales y los anonimiza para modo prueba
 */
export function cacheMockData(
  contacts: Contact[] = [], 
  properties: Property[] = [],
  binnacles: Binnacle[] = [],
  todos: Todo[] = []
) {
  // Verificación defensiva para asegurarnos que tenemos arrays válidos
  contacts = Array.isArray(contacts) ? contacts : [];
  properties = Array.isArray(properties) ? properties : [];
  binnacles = Array.isArray(binnacles) ? binnacles : [];
  todos = Array.isArray(todos) ? todos : [];

  console.log(`Preparando datos mock: ${contacts.length} contactos, ${properties.length} propiedades`);

  // Si no hay datos para cachear, mantener los valores por defecto
  if (contacts.length === 0 && properties.length === 0) {
    console.log('No hay datos reales disponibles para crear mockups, usando datos por defecto');
    return;
  }

  // Limitar a 50 contactos y 35 propiedades
  const limitedContacts = contacts.slice(0, 50);
  const limitedProperties = properties.slice(0, 35);
  
  // Anonimizar datos sensibles (dentro de try/catch para mayor seguridad)
  try {
    // Procesar contactos y propiedades
    cachedContacts = limitedContacts.map(contact => anonymizeContact(contact));
    cachedProperties = limitedProperties.map(property => anonymizeProperty(property));
    
    // Función segura para extraer ID 
    const safeGetId = (obj: { id?: string }): string => {
      return obj && obj.id ? String(obj.id).replace('mock-', '') : '';
    };
    
    // Crear conjunto de IDs de contactos válidos
    const validContactIds = new Set(cachedContacts.map(c => safeGetId(c)));
    
    // Función para verificar si un objeto tiene un contactId válido
    const hasValidContactIdForBinnacle = (obj: Binnacle): boolean => {
      const contactId = obj.contactId ? String(obj.contactId).replace('mock-', '') : '';
      return validContactIds.has(contactId);
    };

    const hasValidContactIdForTodo = (obj: Todo): boolean => {
      const contactId = obj.id ? String(obj.id).replace('mock-', '') : '';
      return validContactIds.has(contactId);
    };
    
    // Procesar bitácoras y tareas
    cachedBinnacles = binnacles
      .filter(hasValidContactIdForBinnacle)
      .map(b => ({
        ...b,
        id: `mock-${b.id}`,
        contactId: b.contactId ? `mock-${b.contactId}` : undefined
      }))
      .slice(0, 100);
    
    cachedTodos = todos
      .filter(hasValidContactIdForTodo)
      .map(t => ({
        ...t,
        id: `mock-${t.id}`,
        contactId: t.id ? `mock-${t.id}` : undefined
      }))
      .slice(0, 50);
    
  } catch (error) {
    console.error('Error al procesar datos para mock:', error);
  }
  
  // Guardar en localStorage para persistencia
  if (browser) {
    try {
      localStorage.setItem('mockContacts', JSON.stringify(cachedContacts));
      localStorage.setItem('mockProperties', JSON.stringify(cachedProperties));
      localStorage.setItem('mockBinnacles', JSON.stringify(cachedBinnacles));
      localStorage.setItem('mockTodos', JSON.stringify(cachedTodos));
      console.log(`Datos mock guardados: ${cachedContacts.length} contactos, ${cachedProperties.length} propiedades`);
    } catch (error) {
      console.error('Error al guardar datos mock en localStorage:', error);
    }
  }
}

/**
 * Carga datos mock desde localStorage si existen
 */
export function loadCachedMockData() {
  if (browser) {
    try {
      const contacts = localStorage.getItem('mockContacts');
      const properties = localStorage.getItem('mockProperties');
      const binnacles = localStorage.getItem('mockBinnacles');
      const todos = localStorage.getItem('mockTodos');
      
      if (contacts) cachedContacts = JSON.parse(contacts);
      if (properties) cachedProperties = JSON.parse(properties);
      if (binnacles) cachedBinnacles = JSON.parse(binnacles);
      if (todos) cachedTodos = JSON.parse(todos);
      
      console.log(`Datos mock cargados desde localStorage: ${cachedContacts.length} contactos, ${cachedProperties.length} propiedades`);
    } catch (error) {
      console.error('Error al cargar datos mock desde localStorage:', error);
    }
  }
}

// Datos de prueba para contactos (fallback si no hay datos cacheados)
export const mockContacts: Contact[] = cachedContacts.length > 0 ? cachedContacts : [
  {
    id: 'mock-contact-1',
    name: 'Juan Pérez',
    lastname: 'Gómez',
    email: 'juan@example.com',
    telephon: '555-123-4567',
    contactStage: 1,
    createdAt: Date.now() - 1000000,
    isActive: true,
    typeContact: 'Cliente',
    selecMC: 'Redes sociales',
    comContact: 'Cliente interesado en propiedades de lujo',
    budget: 1000000,
    halfBathroom: 1,
    locaProperty: 'Roma Norte',
    modePay: 'Crédito',
    propertyType: 'Casa',
    source: 'Redes sociales',
    status: 'Activo',
    updatedAt: Date.now()
  },
  {
    id: 'mock-contact-2',
    name: 'María López',
    lastname: 'Sánchez',
    email: 'maria@example.com',
    telephon: '555-987-6543',
    contactStage: 2,
    createdAt: Date.now() - 2000000,
    isActive: true,
    typeContact: 'Vendedor',
    selecMC: 'Referido',
    comContact: 'Posible vendedor de propiedad en zona exclusiva',
    budget: 2000000,
    halfBathroom: 2,
    locaProperty: 'Condesa',
    modePay: 'Efectivo',
    propertyType: 'Apartamento',
    source: 'Referido',
    status: 'Activo',
    updatedAt: Date.now()
  },
  {
    id: 'mock-contact-3',
    name: 'Carlos Rodríguez',
    lastname: 'García',
    email: 'carlos@example.com',
    telephon: '555-456-7890',
    contactStage: 3,
    createdAt: Date.now() - 3000000,
    isActive: true,
    typeContact: 'Cliente',
    selecMC: 'Web',
    comContact: 'Interesado en propiedades para inversión',
    budget: 3000000,
    halfBathroom: 1,
    locaProperty: 'Polanco',
    modePay: 'Crédito',
    propertyType: 'Casa',
    source: 'Web',
    status: 'Activo',
    updatedAt: Date.now()
  }
];

// Datos de prueba para propiedades (fallback si no hay datos cacheados)
export const mockProperties: Property[] = cachedProperties.length > 0 ? cachedProperties : [
  {
    public_id: 'mock-property-1',
    title: 'Casa en Roma Norte',
    price: 5000000,
    description: 'Hermosa casa en zona exclusiva con 3 habitaciones',
    // status: 'available',
    location: 'Roma Norte, CDMX',
    bedrooms: 3,
    bathrooms: 2,
  },
  {
    id: 'mock-property-2',
    title: 'Apartamento en Condesa',
    price: 3500000,
    description: 'Amplio apartamento con vista panorámica',
    status: 'available',
    location: 'Condesa, CDMX',
    bedrooms: 2,
    bathrooms: 1,
    area: 120
  },
  {
    id: 'mock-property-3',
    title: 'Casa en Polanco',
    price: 8500000,
    description: 'Residencia de lujo con acabados de alta calidad',
    status: 'available',
    location: 'Polanco, CDMX',
    bedrooms: 4,
    bathrooms: 3,
    area: 280
  }
];

// Datos de prueba para bitácoras (fallback si no hay datos cacheados)
export const mockBinnacles: Binnacle[] = cachedBinnacles.length > 0 ? cachedBinnacles : [
  {
    id: 'mock-binnacle-1',
    date: Date.now() - 500000,
    comment: 'Llamada inicial con cliente interesado',
    action: 'Llamada',
    to: 'Juan Pérez',
    contactId: 'mock-contact-1'
  },
  {
    id: 'mock-binnacle-2',
    date: Date.now() - 400000,
    comment: 'Envío de información sobre propiedades en Roma Norte',
    action: 'Email',
    to: 'María López',
    contactId: 'mock-contact-2'
  },
  {
    id: 'mock-binnacle-3',
    date: Date.now() - 300000,
    comment: 'Visita programada para mostrar la propiedad',
    action: 'Cita',
    to: 'Carlos Rodríguez',
    contactId: 'mock-contact-3'
  }
];

// Datos de prueba para tareas (fallback si no hay datos cacheados)
export const mockTodos: Todo[] = cachedTodos.length > 0 ? cachedTodos : [
  {
    id: 'mock-todo-1',
    title: 'Llamar a cliente Juan',
    description: 'Seguimiento de interés en propiedad de Roma Norte',
    completed: false,
    dueDate: Date.now() + 86400000,
    priority: 'alta',
    contactId: 'mock-contact-1'
  },
  {
    id: 'mock-todo-2',
    title: 'Preparar documentación',
    description: 'Contrato de compra-venta para María',
    completed: false,
    dueDate: Date.now() + 172800000,
    priority: 'media',
    contactId: 'mock-contact-2'
  },
  {
    id: 'mock-todo-3',
    title: 'Visita a propiedad',
    description: 'Acompañar a Carlos a ver la propiedad en Polanco',
    completed: false,
    dueDate: Date.now() + 259200000,
    priority: 'alta',
    contactId: 'mock-contact-3'
  }
];

/**
 * Función para simular una operación asíncrona con demora
 */
export async function fakeAsync<T>(data: T, delay = 300): Promise<T> {
  return new Promise(resolve => {
    setTimeout(() => resolve(data), delay);
  });
}

/**
 * Genera un ID único para entidades mock
 */
export function generateMockId(): string {
  return `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Cargar datos desde localStorage al inicializar
if (browser) {
  loadCachedMockData();
}
