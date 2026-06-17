export type StationId = "intl" | "paris" | "caen" | "nancy" | "strasbourg" | "lyon" | "hamburg" | "bucarest"

export type Station = {
  id: StationId
  name: string
  short: string
  city: string
  color: string // hsl for gradients / accents
}

export const STATIONS: Station[] = [
  { id: "intl", name: "Uluslararası Büro", short: "INT", city: "Uluslararası", color: "188 57% 48%" },
  { id: "paris", name: "Paris İstasyonu", short: "PAR", city: "Paris", color: "221 70% 55%" },
  { id: "caen", name: "Caen İstasyonu", short: "CAE", city: "Caen", color: "350 70% 55%" },
  { id: "nancy", name: "Nancy İstasyonu", short: "NAN", city: "Nancy", color: "28 85% 55%" },
  { id: "strasbourg", name: "Strasbourg İstasyonu", short: "STR", city: "Strasbourg", color: "280 50% 55%" },
  { id: "lyon", name: "Lyon İstasyonu", short: "LYO", city: "Lyon", color: "150 55% 45%" },
  { id: "hamburg", name: "Hamburg İstasyonu", short: "HAM", city: "Hamburg", color: "200 70% 50%" },
  { id: "bucarest", name: "Bükreş İstasyonu", short: "BUC", city: "Bükreş", color: "45 90% 50%" },
]

export function station(id: StationId): Station {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[0]
}

export const getStation = station

export const STATION_IDS = STATIONS.map((s) => s.id)

// Roles members can pick at sign-up (Turkish)
export const ROLES = [
  "Başkan",
  "Başkan Yardımcısı",
  "Sekreter",
  "Sayman",
  "Sorumlu",
  "Üye",
] as const

export type Role = (typeof ROLES)[number]

export type Member = {
  id: string
  name: string
  role: Role
  station: StationId
  city: string
  phone: string
  email: string
  birthday: string
  linkedin?: string
  online: boolean
  initials: string
}

export function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  )
}
