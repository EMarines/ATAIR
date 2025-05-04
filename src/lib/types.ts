export interface Contact {
  budget: string | number;
  color?: string;
  comContact: string;
  contactStage: string;
  contactType?: string;
  contMode?: string;
  createdAt: number;
  email: string;
  halfBathroom: string | number;
  id?: string;
  isActive?: boolean;
  lastContact?: number;
  lastname: string;
  lastResponse?: number;
  locaProperty: string[];
  modePay: string;
  name: string;
  notes?: string;
  numBaths: string | number;
  numBeds: string | number;
  numParks: string | number;
  propCont?: string;
  publicUrl?: string; 
  rangeProp: string;
  selecMC: string;
  selecTO?: string;
  selecTP: string;
  sendedProperties?: string[];
  tagsProperty: string[];
  telephon: string;
  title?: string;
  typeContact: string;
  typeOperation?: string;
  typeProperty?: string;
}

export interface PropertyFB {
  areaTotal?: string;           // Terreno
  areaBuilding?: string;        // Construcción
  bathroom?: string;
  beds?: string;
  binnacle?: string[];
  claveEB?: string;
  claveMH?: string;
  colonia?: string;
  color?: string;
  contactStage?: string;         // Etapa de Contacto
  createdAt?: string;
  description?: string;
  halfBathroom?: string;
  id?: string;
  locaProperty?: string[];  
  nameProperty?: string;
  park?: string;
  price?: string;
  selecTP?: string;            // Tipo de Propiedad
  selecTO?: string;              // Tipo de Operación
  tagsProperty?: string[];
  title?: string;
  typeSaller?: string;
  typeContact?: string;
  urlImage?: string;
  urlProp?: string;
  urlSinergy?: string;
}

export interface PropertyEB {    
  created_at: number,
  lot_size: number,
  public_url: string,
  construction_size: number,
  description: string,
  agent: string,
  public_id: string,
  property_status: string,
  title: string,
  // title_image_full: string,
  title_image_thumb: string,
  bedrooms: number,
  bathrooms: number,
  parking_spaces: number,
  half_bathrooms: number,
  location: {
      name: string,
      latitude: number,
      longitude: number,
      street: string,
      postal_code: string,
      show_exact_location: boolean,
      exterior_number: string,
      interior_number: string
    },
  property_type: string,
  updated_at: string,
  // show_prices: boolean,
  // share_commission: boolean,
  tags: string[],
  operations: [
    {
      type: string,
      amount: number,
      formated_amount: string,
      currency: string,
      unit: string,
      commission: {
        type: string,
        value: number,
        currency: string
      }
    },
    {
      type: string,
      amount: number,
      formated_amount: string,
      currency: string,
      period: string
    }
  ],
  property_images?: Array<{ url: string }>;
}

export interface Property {    
  agent: string,
  bathrooms: number,
  bedrooms: number,
  // budget: number,
  construction_size: number,
  created_at: number,
  description: string,
  half_bathrooms: number,
  location: string | { name: string },  //Colonia
  lot_size: number,
  parking_spaces: number,
  price: number,
  property_status: string,
  property_type: string,
  public_id: string,
  public_url: string,
  selecTO: string,
  selecTP: string,
  tags: string[],
  title: string,
  title_image_thumb: string,
  updated_at: string,
}

export interface Binnacle {
  id?: string;
  date: number;
  action?: string;
  comment?: string;
  to?: string;
}

export interface Todo {
  id: string;
  task: string;
  endTask: number; // Timestamp combinado (siempre existe, usa 00:00 si no hay hora)
  timeString?: string; // HH:MM - SOLO si el usuario la especificó
  notes?: string;
  isCompleted: boolean;
  createdAt: number;
  type?: string;
  user?: string;
}


export type ContactOption = "Posobles_Interesados" | "Por_Enviar" | "Ya_Se_Envió";

export type SystStatus = "" | "updateContact" | "sendProps" | "sendProp" | "sendComm" | "addContact" | "msgGratitude" | "addSchedule"; 

export interface SearchEvent {
  target: {
      value: string;
  }
}

export interface ContactPageState {
  searchTerm: string;
  isLoading: boolean;
  error: Error | null;
}

export interface AddContactEvents {
  success: {
      contact: Contact;
  };
  error: {
      error: Error;
  };
  cancel: void;
}

export interface ConfiguracionEmpresa {
  companyName: string;
  logoUrl: string;
  faviconUrl: string;
  slogan: string;
  agentName: string;
  companyUrl: string;
  phoneNumber: string;
  whatsapp: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  socialMedia: {
    facebook: string;
    instagram: string;
    linkedin: string;
  };
}

// Exportar directamente el objeto de configuración
export const empresa: ConfiguracionEmpresa = {
  "companyName": "Match Home",
  "logoUrl": "/logos/matchhome-logo.png",
  "faviconUrl": "/favicon-matchhome.png",
  "slogan": "¡Tu Patrimonio en Buenas Manos!",
  "agentName": "Enrique Marines",
  "companyUrl": "https://www.matchhome.net/",
  "phoneNumber": "(614) 540 4003",
  "whatsapp": "(614) 540 4003",
  "email": "matchhome@hotmail.com",
  "address": {
    "street": "Ave. Francisco Villa # 5700",
    "city": "Chihuahua",
    "state": "Chih.",
    "zipCode": "61203",
    "country": "México"
  },
  "socialMedia": {
    "facebook": "https://www.facebook.com/matchhomemx",
    "instagram": "https://www.instagram.com/matchhomemx",
    "linkedin": "https://www.linkedin.com/company/match-home"
  }
};

