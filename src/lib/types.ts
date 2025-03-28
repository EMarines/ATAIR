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

export interface Property {
    
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
  location: string | { name: string },
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
  


// export interface Property {
//   public_id: string;
//   title: string;
//   title_image_thumb?: string;
//   images: [
//     {
//       url: string;
//       title: string;
//     }
//   ];
//   description: string;
//   bedrooms: number;
//   bathrooms: number;
//   half_bathrooms: number;
//   parking_spaces: number;
//   lot_size: number;
//   construction_size: number;
//   lot_length: number;
//   lot_width: number;
//   covered_space: number;
//   floors: number;
//   floor: number;
//   age: number;
//   internal_id: string;
//   expenses: string;
//   property_type: string;
//   agent: {
//     id: number;
//     name: string;
//     full_name: string;
//     mobile_phone: string;
//     profile_image_url: string;
//     email: string;
//   },
//   created_at: string;
//   updated_at: string;
//   published_at: string;
//   features: [
//     {
//       name: string;
//       category: string;
//     }
//   ],
//   public_url: string;
//   collaboration_notes: string;
//   property_files: string[];
//   videos: string[];
//   virtual_tour: string;
//   exclusive: boolean;
//   shared_commission_percentage: number;
//   private_description: string;
//   location: string;
//   // location: {
//   //   name: string;
//   //   latitude: number;
//   //   longitude: number;
//   //   street: string;
//   //   postal_code: string;
//   //   show_exact_location: boolean;
//   //   exterior_number: string;
//   //   interior_number: string;
//   // },
//   tags: string[];
//   show_prices: boolean;
//   share_commission: boolean;
//   operations: [
//     {
//       type: string;
//       amount: number;
//       formatted_amount: string;
//       currency: string;
//       unit: string;
//       commission: {
//         type: string;
//         value: number;
//         currency: string;
//       }
//     },
//     {
//       type: string;
//       amount: number;
//       formated_amount: string;
//       currency: string;
//       period: string;
//     }
//   ]
// }

export interface Binnacle {
  id?: string;
  date: number;
  action?: string;
  comment?: string;
  to?: string;
}

export interface Todo {
  id: string;
  stage: string;
  endTask: string | number;
  createdAt: number;
  notes: string;
  isCompleted: boolean;
  task: string;
  timeTask: string;
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
