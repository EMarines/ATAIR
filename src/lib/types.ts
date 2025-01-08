export interface Contact {
  budget?: number;
  color?: string;
  comContact?: string;
  contactType?: string;
  contactStage?: string;
  contMode?: string;
  createdAt: number;
  email?: string;
  halfBathroom?: string;
  id?: string;
  lastContact?: number;
  lastname?: string;
  locaProperty?: string[];
  modePay?: string;
  name: string;
  numBaths?: string;
  numBeds?: string;
  numParks?: string;
  propCont?: string;
  rangeProp?: string;
  selecTO?: string;
  selecTP?: string;
  selecMC?: string;
  sendedProperties?: string[];
  tagsProperty?: string[];
  telephon?: string;
  title?: string;
  typeContact: string;
  typeProperty?: string;
  typeOperation?: string;
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
  rangeProp?: string;
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

export interface Property {
  public_id: string;
  title: string;
  images: [
    {
      url: string;
      title: string;
    }
  ];
  description: string;
  bedrooms: number;
  bathrooms: number;
  half_bathrooms: number;
  parking_spaces: number;
  lot_size: number;
  construction_size: number;
  lot_length: number;
  lot_width: number;
  covered_space: number;
  floors: number;
  floor: number;
  age: number;
  internal_id: string;
  expenses: string;
  property_type: string;
  agent: {
    id: number;
    name: string;
    full_name: string;
    mobile_phone: string;
    profile_image_url: string;
    email: string;
  },
  created_at: string;
  updated_at: string;
  published_at: string;
  features: [
    {
      name: string;
      category: string;
    }
  ],
  public_url: string;
  collaboration_notes: string;
  property_files: string[];
  videos: string[];
  virtual_tour: string;
  exclusive: boolean;
  shared_commission_percentage: number;
  private_description: string;
  location: {
    name: string;
    latitude: number;
    longitude: number;
    street: string;
    postal_code: string;
    show_exact_location: boolean;
    exterior_number: string;
    interior_number: string;
  },
  tags: string[];
  show_prices: boolean;
  share_commission: boolean;
  operations: [
    {
      type: string;
      amount: number;
      formatted_amount: string;
      currency: string;
      unit: string;
      commission: {
        type: string;
        value: number;
        currency: string;
      }
    },
    {
      type: string;
      amount: number;
      formated_amount: string;
      currency: string;
      period: string;
    }
  ]
}

export interface Binnacle {
  id?: string;
  date: number;
  action?: string;
  comment?: string;
  to?: string;
}

export type ContactOption = "Posobles_Interesados" | "Por_Enviar" | "Ya_Se_Envió";

export type SystStatus = "" | "updateContact" | "sendProps" | "sendProp" | "sendComm" | "addContact" | "msgGratitude" | "addSchedule"; 
