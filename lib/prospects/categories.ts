/**
 * What you sell, and who you'd sell it to.
 *
 * Target categories map onto OpenStreetMap tags, which is how the finder
 * knows what to look for. Kept short and in plain English — an owner should
 * not have to know what `amenity=veterinary` means.
 */

export type TargetCategory = {
  key: string;
  label: string;
  hint: string;
  /** Overpass tag filters; any match counts. */
  filters: string[];
};

export const TARGET_CATEGORIES: TargetCategory[] = [
  {
    key: "food", label: "Restaurants, cafés and bars", hint: "Places serving food and drink",
    filters: ['["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|food_court)$"]'],
  },
  {
    key: "retail", label: "Shops and retail", hint: "Anywhere selling goods over a counter",
    filters: ['["shop"]'],
  },
  {
    key: "offices", label: "Offices and professional firms", hint: "Lawyers, accountants, agencies, insurance",
    filters: ['["office"]'],
  },
  {
    key: "trades", label: "Trades and workshops", hint: "Builders, electricians, plumbers, makers",
    filters: ['["craft"]', '["shop"~"^(hardware|doityourself|trade|builders_merchant)$"]'],
  },
  {
    key: "health", label: "Health and care practices", hint: "Clinics, dentists, vets, pharmacies",
    filters: ['["amenity"~"^(clinic|doctors|dentist|veterinary|pharmacy|social_facility)$"]', '["healthcare"]'],
  },
  {
    key: "beauty", label: "Salons, gyms and personal care", hint: "Hair, beauty, fitness, spas",
    filters: ['["shop"~"^(hairdresser|beauty|massage|tattoo)$"]', '["leisure"~"^(fitness_centre|sports_centre)$"]'],
  },
  {
    key: "auto", label: "Auto and transport", hint: "Garages, dealers, car washes, haulage",
    filters: ['["shop"~"^(car|car_repair|car_parts|motorcycle|tyres)$"]', '["amenity"~"^(fuel|car_wash|car_rental)$"]'],
  },
  {
    key: "lodging", label: "Hotels and lodging", hint: "Hotels, motels, guest houses",
    filters: ['["tourism"~"^(hotel|motel|guest_house|hostel|apartment)$"]'],
  },
  {
    key: "education", label: "Schools and childcare", hint: "Schools, nurseries, training providers",
    filters: ['["amenity"~"^(school|kindergarten|childcare|college|university|driving_school|language_school)$"]'],
  },
  {
    key: "community", label: "Churches, charities and clubs", hint: "Places of worship, nonprofits, community groups",
    filters: ['["amenity"~"^(place_of_worship|community_centre|social_centre)$"]', '["office"~"^(charity|ngo|association)$"]'],
  },
  {
    key: "industry", label: "Industrial and warehousing", hint: "Manufacturers, depots, storage",
    filters: ['["industrial"]', '["man_made"="works"]', '["landuse"="industrial"]["name"]'],
  },
];

export const targetByKey = (key: string) => TARGET_CATEGORIES.find((t) => t.key === key);

/**
 * Which kinds of business a given industry usually sells to. Only a starting
 * point — the owner can pick any combination.
 */
export const SUGGESTED_TARGETS: Record<string, string[]> = {
  "Retail": ["retail", "food", "offices"],
  "Restaurant / Food service": ["offices", "lodging", "education", "community"],
  "Professional services": ["offices", "trades", "health", "retail"],
  "Construction / Trades": ["offices", "retail", "lodging", "community", "industry"],
  "Healthcare": ["offices", "education", "community", "industry"],
  "E-commerce": ["retail", "offices"],
  "Manufacturing": ["retail", "trades", "industry"],
  "Technology / SaaS": ["offices", "health", "retail", "education"],
  "Transportation / Logistics": ["retail", "industry", "trades", "food"],
  "Personal services / Beauty": ["offices", "lodging", "community"],
  "Other": ["offices", "retail"],
};
