export type StationId = "intl" | "paris" | "lyon" | "marseille" | "bordeaux" | "toulouse" | "lille"

export type Station = {
  id: StationId
  name: string
  short: string
  city: string
  color: string // hsl for gradients / accents
}

export const STATIONS: Station[] = [
  { id: "intl", name: "Bureau International", short: "INT", city: "International", color: "188 57% 48%" },
  { id: "paris", name: "Station Paris", short: "PAR", city: "Paris", color: "221 70% 55%" },
  { id: "lyon", name: "Station Lyon", short: "LYO", city: "Lyon", color: "350 70% 55%" },
  { id: "marseille", name: "Station Marseille", short: "MRS", city: "Marseille", color: "28 85% 55%" },
  { id: "bordeaux", name: "Station Bordeaux", short: "BDX", city: "Bordeaux", color: "280 50% 55%" },
  { id: "toulouse", name: "Station Toulouse", short: "TLS", city: "Toulouse", color: "150 55% 45%" },
  { id: "lille", name: "Station Lille", short: "LIL", city: "Lille", color: "200 70% 50%" },
]

export function station(id: StationId): Station {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[0]
}

export type Role =
  | "Président"
  | "Présidente"
  | "Vice-Président"
  | "Vice-Présidente"
  | "Secrétaire"
  | "Trésorier"
  | "Responsable"
  | "Membre"

export type Member = {
  id: string
  name: string
  role: Role
  station: StationId
  city: string
  phone: string
  email: string
  birthday: string
  online: boolean
  initials: string
}

export const MEMBERS: Member[] = [
  {
    id: "m1",
    name: "Aylin Demir",
    role: "Présidente",
    station: "intl",
    city: "Paris",
    phone: "+33 6 12 34 56 78",
    email: "aylin.demir@youthstation.org",
    birthday: "12/03/1998",
    online: true,
    initials: "AD",
  },
  {
    id: "m2",
    name: "Lucas Martin",
    role: "Vice-Présidente",
    station: "paris",
    city: "Paris",
    phone: "+33 6 23 45 67 89",
    email: "lucas.martin@youthstation.org",
    birthday: "05/07/1999",
    online: true,
    initials: "LM",
  },
  {
    id: "m3",
    name: "Emma Bernard",
    role: "Secrétaire",
    station: "lyon",
    city: "Lyon",
    phone: "+33 6 34 56 78 90",
    email: "emma.bernard@youthstation.org",
    birthday: "23/11/2000",
    online: false,
    initials: "EB",
  },
  {
    id: "m4",
    name: "Mehmet Yılmaz",
    role: "Trésorier",
    station: "marseille",
    city: "Marseille",
    phone: "+33 6 45 67 89 01",
    email: "mehmet.yilmaz@youthstation.org",
    birthday: "17/01/1997",
    online: true,
    initials: "MY",
  },
  {
    id: "m5",
    name: "Chloé Petit",
    role: "Responsable",
    station: "bordeaux",
    city: "Bordeaux",
    phone: "+33 6 56 78 90 12",
    email: "chloe.petit@youthstation.org",
    birthday: "08/09/2001",
    online: false,
    initials: "CP",
  },
  {
    id: "m6",
    name: "Hugo Moreau",
    role: "Responsable",
    station: "toulouse",
    city: "Toulouse",
    phone: "+33 6 67 89 01 23",
    email: "hugo.moreau@youthstation.org",
    birthday: "30/05/1999",
    online: true,
    initials: "HM",
  },
  {
    id: "m7",
    name: "Zeynep Kaya",
    role: "Membre",
    station: "lille",
    city: "Lille",
    phone: "+33 6 78 90 12 34",
    email: "zeynep.kaya@youthstation.org",
    birthday: "14/02/2002",
    online: false,
    initials: "ZK",
  },
  {
    id: "m8",
    name: "Théo Dubois",
    role: "Membre",
    station: "paris",
    city: "Paris",
    phone: "+33 6 89 01 23 45",
    email: "theo.dubois@youthstation.org",
    birthday: "21/08/2000",
    online: true,
    initials: "TD",
  },
]
