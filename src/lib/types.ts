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

// {
//   "public_id": "EB-XXX123",
//   "title": "Beautiful property in Condesa",
//   "images": [
//     {
//       "url": "https://www.easybroker.com/assets/product/logo-be4da843987ccd1c05e26f8703f1787847471b36d08bdb1ec8a91ce4007b0e98.svg",
//       "title": "Fitted kitchen with granite countertops"
//     }
//   ],
//   "description": "This property is very well-lit in a lovely neighborhood overlooking a park.",
//   "bedrooms": 0,
//   "bathrooms": 0,
//   "half_bathrooms": 0,
//   "parking_spaces": 0,
//   "lot_size": 0,
//   "construction_size": 0,
//   "lot_length": 0,
//   "lot_width": 0,
//   "covered_space": 0,
//   "floors": 0,
//   "floor": 0,
//   "age": 2020,
//   "internal_id": "custom-id-001",
//   "expenses": "$100 USD",
//   "property_type": "Apartment",
//   "agent": {
//     "id": 1234,
//     "name": "John Smith",
//     "full_name": "John Smith Doe",
//     "mobile_phone": "5555550000",
//     "profile_image_url": "https://www.easybroker.com/assets/product/logo-be4da843987ccd1c05e26f8703f1787847471b36d08bdb1ec8a91ce4007b0e98.svg",
//     "email": "john@smith.com"
//   },
//   "created_at": "2025-04-03T18:34:02.497Z",
//   "updated_at": "2025-04-03T18:34:02.497Z",
//   "published_at": "2025-04-03T18:34:02.497Z",
//   "features": [
//     {
//       "name": "Pets allowed",
//       "category": "General"
//     }
//   ],
//   "public_url": "https://www.easybroker.com/mx/inmueble/john-smith-amazing-house",
//   "collaboration_notes": "25% per referral",
//   "property_files": [
//     "https://www.easybroker.com/assets/product/logo-be4da843987ccd1c05e26f8703f1787847471b36d08bdb1ec8a91ce4007b0e98.svg"
//   ],
//   "videos": [
//     "https://www.youtube.com/watch?v=zVRu7AktR48"
//   ],
//   "virtual_tour": "https://my.matterport.com/show/?m=yHsh2roFXnp",
//   "exclusive": false,
//   "shared_commission_percentage": 50,
//   "private_description": "Selling this property is our top priority and we are willing to offer a discount.",
//   "location": {
//     "name": "Condesa, Cuauhtemoc, Ciudad de México",
//     "latitude": 20.676145,
//     "longitude": -103.368962,
//     "street": "Av. México",
//     "postal_code": "06700",
//     "show_exact_location": true,
//     "exterior_number": "21A",
//     "interior_number": "304"
//   },
//   "tags": [
//     "premium",
//     "exclusive"
//   ],
//   "show_prices": true,
//   "share_commission": true,
//   "operations": [
//     {
//       "type": "sale",
//       "amount": 500000,
//       "formated_amount": "US$ 500,000",
//       "currency": "USD",
//       "unit": "total",
//       "commission": {
//         "type": "amount",
//         "value": 10000,
//         "currency": "USD"
//       }
//     },
//     {
//       "type": "temporary_rental",
//       "amount": 500,
//       "formated_amount": "US$ 500",
//       "currency": "USD",
//       "period": "monthly"
//     }
//   ]
// }
