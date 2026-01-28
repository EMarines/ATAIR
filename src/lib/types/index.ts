// Tipos centralizados de la aplicación ATAIR

// ============================================
// Contactos
// ============================================

export interface Contact {
    id: string;
    createdAt: number;
    name: string;
    lastname: string;
    email: string;
    telephon: string;
    typeContact: string;
    selecMC: string;
    comContact: string;
    contactStage: string | number;
    isActive?: boolean;
    properties?: string[];
    budget: number;
    selecTP: string;
    rangeProp: string;
    numBaths: number | string;
    numBeds: number | string;
    numParks: number | string;
    halfBathroom: string;
    locaProperty: string[];
    tagsProperty: string[];
    modePay?: string;
    color?: string;
    contactType?: string;
    contMode?: string;
    lastContact?: number;
    propCont?: string;
    selecTO?: string;
    sendedProperties?: string[];
    title?: string;
    typeProperty?: string;
    typeOperation?: string;
}

export interface ContactOption {
    label: string;
    value: string;
}

// ============================================
// Propiedades
// ============================================

export interface Property {
    public_id: string;
    title?: string;
    description?: string;
    location?: string;
    bedrooms?: number;
    bathrooms?: number;
    property_type?: string;
    operations?: string[];
    price?: number;
    show_prices?: boolean;
    photos?: PropertyPhoto[];
    tags?: string[];
    propertyTags?: string[];
    amenityTags?: string[];
    neighborhood?: string;
    construction_size?: number;
    lot_size?: number;
    parking_spaces?: number;
    half_bathrooms?: number;
    updated_at?: string;
    created_at?: string;
    [key: string]: any; // Para campos adicionales
}

export interface PropertyPhoto {
    url: string;
    title?: string;
    [key: string]: any;
}

// Tipo para propiedades de EasyBroker (API)
export interface PropertyEB {
    public_id: string;
    title?: string;
    description?: string;
    location?: string;
    bedrooms?: number;
    bathrooms?: number;
    property_type?: string;
    operations?: string[];
    price?: number;
    show_prices?: boolean;
    photos?: PropertyPhoto[];
    [key: string]: any;
}

// ============================================
// Bitácoras
// ============================================

export interface Binnacle {
    id: string;
    contactId: string;
    createdAt: number;
    content: string;
    type?: string;
    author?: string;
    [key: string]: any;
}

// ============================================
// Tareas (Todos/Agenda)
// ============================================

export interface Todo {
    id: string;
    title: string;
   description?: string;
    completed: boolean;
    dueDate?: number;
    createdAt: number;
    contactId?: string;
    priority?: 'low' | 'medium' | 'high';
    [key: string]: any;
}

// ============================================
// Configuración de Empresa
// ============================================

export interface ConfiguracionEmpresa {
    nombre: string;
    logo?: string;
    colorPrimario?: string;
    colorSecundario?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
    redesSociales?: {
        facebook?: string;
        instagram?: string;
        twitter?: string;
        linkedin?: string;
    };
    [key: string]: any;
}

// ============================================
// Eventos de Componentes
// ============================================

export interface AddContactEvents {
    contactAdded: Contact;
    contactUpdated: Contact;
    cancelled: void;
}

// ============================================
// Autenticación (si es necesario en el futuro)
// ============================================

export interface FirebaseUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL?: string | null;
    emailVerified: boolean;
}

// ============================================
// Respuestas de API/Firebase
// ============================================

export interface FirebaseResponse<T = any> {
    success: boolean;
    data?: T;
    error?: any;
    id?: string;
}
