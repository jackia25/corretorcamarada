import { z } from 'zod';
import { PROPERTY_TYPE_LABELS, BRAZILIAN_STATES, PropertyType } from './types';

const propertyTypes = Object.keys(PROPERTY_TYPE_LABELS) as [PropertyType, ...PropertyType[]];

// Property validation schema
export const propertySchema = z.object({
  // Public data
  title: z.string()
    .trim()
    .min(5, 'Título deve ter pelo menos 5 caracteres')
    .max(200, 'Título deve ter no máximo 200 caracteres'),
  description: z.string()
    .trim()
    .max(2000, 'Descrição deve ter no máximo 2000 caracteres')
    .optional()
    .or(z.literal('')),
  property_type: z.enum(propertyTypes, {
    required_error: 'Selecione o tipo do imóvel',
  }),
  neighborhood: z.string()
    .trim()
    .min(2, 'Bairro deve ter pelo menos 2 caracteres')
    .max(100, 'Bairro deve ter no máximo 100 caracteres'),
  city: z.string()
    .trim()
    .min(2, 'Cidade deve ter pelo menos 2 caracteres')
    .max(100, 'Cidade deve ter no máximo 100 caracteres'),
  state: z.string()
    .refine(val => BRAZILIAN_STATES.includes(val as any), {
      message: 'Selecione um estado válido',
    }),
  price_range_min: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
      message: 'Preço mínimo deve ser um número positivo',
    }),
  price_range_max: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
      message: 'Preço máximo deve ser um número positivo',
    }),
  bedrooms: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseInt(val)) && parseInt(val) >= 0 && parseInt(val) <= 50), {
      message: 'Quartos deve ser entre 0 e 50',
    }),
  bathrooms: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseInt(val)) && parseInt(val) >= 0 && parseInt(val) <= 50), {
      message: 'Banheiros deve ser entre 0 e 50',
    }),
  area_m2: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) > 0 && parseFloat(val) <= 100000), {
      message: 'Área deve ser entre 0 e 100.000 m²',
    }),
  land_area_m2: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) > 0 && parseFloat(val) <= 1000000), {
      message: 'Área do terreno deve ser entre 0 e 1.000.000 m²',
    })
    .or(z.literal('')),
  suites: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseInt(val)) && parseInt(val) >= 0 && parseInt(val) <= 50), {
      message: 'Suítes deve ser entre 0 e 50',
    })
    .or(z.literal('')),
  garage_spaces: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseInt(val)) && parseInt(val) >= 0 && parseInt(val) <= 50), {
      message: 'Vagas de garagem deve ser entre 0 e 50',
    })
    .or(z.literal('')),
  external_code: z.string()
    .trim()
    .max(30, 'Código deve ter no máximo 30 caracteres')
    .optional()
    .or(z.literal('')),
  condominium: z.string()
    .trim()
    .max(150, 'Condomínio deve ter no máximo 150 caracteres')
    .optional()
    .or(z.literal('')),
  iptu: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
      message: 'IPTU deve ser um número positivo',
    })
    .or(z.literal('')),
  condo_value: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
      message: 'Valor do condomínio deve ser um número positivo',
    })
    .or(z.literal('')),
  video_url: z.string()
    .trim()
    .max(500, 'URL do vídeo muito longa')
    .optional()
    .or(z.literal('')),
  features: z.string()
    .max(500, 'Características devem ter no máximo 500 caracteres')
    .optional()
    .or(z.literal('')),
  
  // Sensitive data
  full_address: z.string()
    .trim()
    .min(5, 'Endereço deve ter pelo menos 5 caracteres')
    .max(300, 'Endereço deve ter no máximo 300 caracteres'),
  address_number: z.string()
    .max(20, 'Número deve ter no máximo 20 caracteres')
    .optional()
    .or(z.literal('')),
  address_complement: z.string()
    .max(100, 'Complemento deve ter no máximo 100 caracteres')
    .optional()
    .or(z.literal('')),
  zip_code: z.string()
    .optional()
    .refine(val => !val || /^\d{5}-?\d{3}$/.test(val), {
      message: 'CEP deve estar no formato 12345-678 ou 12345678',
    })
    .or(z.literal('')),
  owner_name: z.string()
    .trim()
    .min(2, 'Nome do proprietário deve ter pelo menos 2 caracteres')
    .max(150, 'Nome do proprietário deve ter no máximo 150 caracteres'),
  owner_phone: z.string()
    .trim()
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .max(20, 'Telefone deve ter no máximo 20 caracteres')
    .refine(val => /^[\d\s\(\)\-\+]+$/.test(val), {
      message: 'Telefone deve conter apenas números e caracteres válidos',
    }),
  owner_email: z.string()
    .optional()
    .refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Email inválido',
    })
    .or(z.literal('')),
  internal_notes: z.string()
    .max(1000, 'Notas devem ter no máximo 1000 caracteres')
    .optional()
    .or(z.literal('')),
}).refine(data => {
  if (data.price_range_min && data.price_range_max) {
    return parseFloat(data.price_range_min) <= parseFloat(data.price_range_max);
  }
  return true;
}, {
  message: 'Preço mínimo deve ser menor ou igual ao preço máximo',
  path: ['price_range_min'],
});

export type PropertyFormData = z.infer<typeof propertySchema>;

// Demand validation schema
export const demandSchema = z.object({
  title: z.string()
    .trim()
    .min(5, 'Título deve ter pelo menos 5 caracteres')
    .max(200, 'Título deve ter no máximo 200 caracteres'),
  description: z.string()
    .trim()
    .max(2000, 'Descrição deve ter no máximo 2000 caracteres')
    .optional()
    .or(z.literal('')),
  property_types: z.array(z.enum(propertyTypes)).optional(),
  neighborhoods: z.string()
    .max(500, 'Bairros devem ter no máximo 500 caracteres')
    .optional()
    .or(z.literal('')),
  cities: z.string()
    .max(500, 'Cidades devem ter no máximo 500 caracteres')
    .optional()
    .or(z.literal('')),
  states: z.array(z.string()).optional(),
  price_min: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
      message: 'Preço mínimo deve ser um número positivo',
    }),
  price_max: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), {
      message: 'Preço máximo deve ser um número positivo',
    }),
  bedrooms_min: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseInt(val)) && parseInt(val) >= 0 && parseInt(val) <= 50), {
      message: 'Quartos mínimo deve ser entre 0 e 50',
    }),
  bedrooms_max: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseInt(val)) && parseInt(val) >= 0 && parseInt(val) <= 50), {
      message: 'Quartos máximo deve ser entre 0 e 50',
    }),
  area_min: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) > 0), {
      message: 'Área mínima deve ser um número positivo',
    }),
  area_max: z.string()
    .optional()
    .refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) > 0), {
      message: 'Área máxima deve ser um número positivo',
    }),
}).refine(data => {
  if (data.price_min && data.price_max) {
    return parseFloat(data.price_min) <= parseFloat(data.price_max);
  }
  return true;
}, {
  message: 'Preço mínimo deve ser menor ou igual ao preço máximo',
  path: ['price_min'],
}).refine(data => {
  if (data.bedrooms_min && data.bedrooms_max) {
    return parseInt(data.bedrooms_min) <= parseInt(data.bedrooms_max);
  }
  return true;
}, {
  message: 'Quartos mínimo deve ser menor ou igual ao máximo',
  path: ['bedrooms_min'],
}).refine(data => {
  if (data.area_min && data.area_max) {
    return parseFloat(data.area_min) <= parseFloat(data.area_max);
  }
  return true;
}, {
  message: 'Área mínima deve ser menor ou igual à máxima',
  path: ['area_min'],
});

export type DemandFormData = z.infer<typeof demandSchema>;
