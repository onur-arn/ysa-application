export type StationId = "intl" | "paris" | "caen" | "nancy" | "strasbourg" | "lyon" | "hamburg" | "bucarest"

export type Station = {
  id: StationId
  name: string
  short: string
  city: string
  color: string
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

export const STATIONS_SORTED: Station[] = [
  STATIONS.find(s => s.id === "intl")!,
  ...[...STATIONS.filter(s => s.id !== "intl")].sort((a, b) =>
    a.city.localeCompare(b.city, "tr")
  ),
]

export function station(id: StationId): Station {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[0]
}

export const getStation = station

export const STATION_IDS = STATIONS.map((s) => s.id)

// ── Yönetim Kurulu ──────────────────────────────────────────────────────────
export const YONETIM_KURULU_ROLES = [
  "Başkan",
  "Sekreter",
  "Sayman",
  "Proje Direktörü",
  "Dış İlişkiler Direktörü",
  "İç İlişkiler Direktörü",
  "Kurumsal İletişim Direktörü",
  "Eğitim Koordinatörü",
  "Avrupa Birliği Projeler Sorumlusu",
] as const

// ── Yürütme Kurulu ───────────────────────────────────────────────────────────
export const YURUTME_KURULU_ROLES = [
  "İnovasyon ve Girişimcilik Proje Direktörü",
  "Kültür ve Sanat Proje Direktörü",
  "Gençlik ve Çevre Proje Direktörü",
  "Dezavantajlı Gruplar ve Sosyal Dahil Etme Proje Direktörü",
  "Demokratik Katılım Proje Direktörü",
  "Gençlik Sağlığı Proje Direktörü",
] as const

export const ROLES = [...YONETIM_KURULU_ROLES, ...YURUTME_KURULU_ROLES] as const

export type Role = (typeof ROLES)[number]

// ── 81 il (plaka sırasına göre) ──────────────────────────────────────────────
export const SEHIRLER = [
  "01-Adana", "02-Adıyaman", "03-Afyonkarahisar", "04-Ağrı", "05-Amasya",
  "06-Ankara", "07-Antalya", "08-Artvin", "09-Aydın", "10-Balıkesir",
  "11-Bilecik", "12-Bingöl", "13-Bitlis", "14-Bolu", "15-Burdur",
  "16-Bursa", "17-Çanakkale", "18-Çankırı", "19-Çorum", "20-Denizli",
  "21-Diyarbakır", "22-Edirne", "23-Elazığ", "24-Erzincan", "25-Erzurum",
  "26-Eskişehir", "27-Gaziantep", "28-Giresun", "29-Gümüşhane", "30-Hakkari",
  "31-Hatay", "32-Isparta", "33-Mersin", "34-İstanbul", "35-İzmir",
  "36-Kars", "37-Kastamonu", "38-Kayseri", "39-Kırklareli", "40-Kırşehir",
  "41-Kocaeli", "42-Konya", "43-Kütahya", "44-Malatya", "45-Manisa",
  "46-Kahramanmaraş", "47-Mardin", "48-Muğla", "49-Muş", "50-Nevşehir",
  "51-Niğde", "52-Ordu", "53-Rize", "54-Sakarya", "55-Samsun",
  "56-Siirt", "57-Sinop", "58-Sivas", "59-Tekirdağ", "60-Tokat",
  "61-Trabzon", "62-Tunceli", "63-Şanlıurfa", "64-Uşak", "65-Van",
  "66-Yozgat", "67-Zonguldak", "68-Aksaray", "69-Bayburt", "70-Karaman",
  "71-Kırıkkale", "72-Batman", "73-Şırnak", "74-Bartın", "75-Ardahan",
  "76-Iğdır", "77-Yalova", "78-Karabük", "79-Kilis", "80-Osmaniye",
  "81-Düzce",
] as const

export type Sehir = (typeof SEHIRLER)[number]

export type Member = {
  id: string
  name: string
  role: Role
  station: StationId
  city: string
  memleket?: string
  phone: string
  email: string
  birthday: string
  linkedin?: string
  online: boolean
  initials: string
  igemEgitimi?: "evet" | "hayır"
  igemTarihi?: string
  photoUrl?: string
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

export const MEMBERS: Member[] = []
