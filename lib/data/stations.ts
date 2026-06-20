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

export const MEMBERS: Member[] = [
  // Uluslararası Büro
  { id: "m1", name: "Aylin Demir", role: "Başkan", station: "intl", city: "Paris", memleket: "34-İstanbul", phone: "+33 6 12 34 56 78", email: "aylin.demir@youthstation.org", birthday: "1998-03-15", linkedin: "https://linkedin.com/in/aylindemir", online: true, initials: "AD" },
  { id: "m2", name: "Lucas Martin", role: "Sekreter", station: "intl", city: "Paris", memleket: "06-Ankara", phone: "+33 6 98 76 54 32", email: "lucas.martin@youthstation.org", birthday: "1999-07-22", online: false, initials: "LM" },

  // Paris
  { id: "m3", name: "Emma Bernard", role: "Başkan", station: "paris", city: "Paris", memleket: "35-İzmir", phone: "+33 6 11 22 33 44", email: "emma.bernard@youthstation.org", birthday: "2000-01-10", linkedin: "https://linkedin.com/in/emmabernard", online: true, initials: "EB" },
  { id: "m4", name: "Hugo Moreau", role: "İç İlişkiler Direktörü", station: "paris", city: "Paris", memleket: "16-Bursa", phone: "+33 6 55 44 33 22", email: "hugo.moreau@youthstation.org", birthday: "1999-11-05", online: false, initials: "HM" },
  { id: "m5", name: "Sophie Leroux", role: "Proje Direktörü", station: "paris", city: "Paris", memleket: "61-Trabzon", phone: "+33 6 77 88 99 00", email: "sophie.leroux@youthstation.org", birthday: "2001-04-18", online: true, initials: "SL" },

  // Caen
  { id: "m6", name: "Mehmet Yılmaz", role: "Başkan", station: "caen", city: "Caen", memleket: "42-Konya", phone: "+33 6 22 33 44 55", email: "mehmet.yilmaz@youthstation.org", birthday: "1997-08-30", linkedin: "https://linkedin.com/in/mehmetyilmaz", online: false, initials: "MY" },
  { id: "m7", name: "Zeynep Kaya", role: "Kurumsal İletişim Direktörü", station: "caen", city: "Caen", memleket: "27-Gaziantep", phone: "+33 6 33 44 55 66", email: "zeynep.kaya@youthstation.org", birthday: "2000-12-03", online: true, initials: "ZK" },

  // Nancy
  { id: "m8", name: "Chloé Petit", role: "Başkan", station: "nancy", city: "Nancy", memleket: "38-Kayseri", phone: "+33 6 44 55 66 77", email: "chloe.petit@youthstation.org", birthday: "1998-06-25", online: true, initials: "CP" },
  { id: "m9", name: "Thomas Girard", role: "Sayman", station: "nancy", city: "Nancy", memleket: "55-Samsun", phone: "+33 6 55 66 77 88", email: "thomas.girard@youthstation.org", birthday: "1999-02-14", linkedin: "https://linkedin.com/in/thomasgirard", online: false, initials: "TG" },
  { id: "m10", name: "Léa Dupont", role: "Demokratik Katılım Proje Direktörü", station: "nancy", city: "Nancy", memleket: "21-Diyarbakır", phone: "+33 6 66 77 88 99", email: "lea.dupont@youthstation.org", birthday: "2001-09-07", online: false, initials: "LD" },

  // Strasbourg
  { id: "m11", name: "Léa Martin", role: "Başkan", station: "strasbourg", city: "Strasbourg", memleket: "44-Malatya", phone: "+33 6 77 88 99 11", email: "lea.martin@youthstation.org", birthday: "1997-05-20", linkedin: "https://linkedin.com/in/leamartin", online: true, initials: "LM" },
  { id: "m12", name: "Antoine Dubois", role: "Sekreter", station: "strasbourg", city: "Strasbourg", memleket: "26-Eskişehir", phone: "+33 6 88 99 11 22", email: "antoine.dubois@youthstation.org", birthday: "2000-10-11", online: false, initials: "AT" },
  { id: "m13", name: "Clara Simon", role: "Sayman", station: "strasbourg", city: "Strasbourg", memleket: "33-Mersin", phone: "+33 6 99 11 22 33", email: "clara.simon@youthstation.org", birthday: "1999-03-28", online: true, initials: "CS" },

  // Lyon
  { id: "m14", name: "Marie Leroy", role: "Başkan", station: "lyon", city: "Lyon", memleket: "07-Antalya", phone: "+33 6 11 33 55 77", email: "marie.leroy@youthstation.org", birthday: "1998-07-16", linkedin: "https://linkedin.com/in/marieleroy", online: true, initials: "ML" },
  { id: "m15", name: "Pierre Bernard", role: "Dış İlişkiler Direktörü", station: "lyon", city: "Lyon", memleket: "25-Erzurum", phone: "+33 6 22 44 66 88", email: "pierre.bernard@youthstation.org", birthday: "1999-01-23", online: false, initials: "PB" },
  { id: "m16", name: "Camille Petit", role: "Gençlik Sağlığı Proje Direktörü", station: "lyon", city: "Lyon", memleket: "01-Adana", phone: "+33 6 33 55 77 99", email: "camille.petit@youthstation.org", birthday: "2001-06-04", online: true, initials: "CA" },

  // Hamburg
  { id: "m17", name: "Jana Müller", role: "Başkan", station: "hamburg", city: "Hamburg", memleket: "31-Hatay", phone: "+49 176 12345678", email: "jana.muller@youthstation.org", birthday: "1997-11-12", linkedin: "https://linkedin.com/in/janamuller", online: false, initials: "JM" },
  { id: "m18", name: "Klaus Weber", role: "Kültür ve Sanat Proje Direktörü", station: "hamburg", city: "Hamburg", memleket: "65-Van", phone: "+49 176 87654321", email: "klaus.weber@youthstation.org", birthday: "2000-04-30", online: true, initials: "KW" },

  // Bükreş
  { id: "m19", name: "Ana Ionescu", role: "Başkan", station: "bucarest", city: "Bükreş", memleket: "63-Şanlıurfa", phone: "+40 722 123 456", email: "ana.ionescu@youthstation.org", birthday: "1998-09-08", linkedin: "https://linkedin.com/in/anaionescu", online: true, initials: "AI" },
  { id: "m20", name: "Mihai Popescu", role: "İnovasyon ve Girişimcilik Proje Direktörü", station: "bucarest", city: "Bükreş", memleket: "47-Mardin", phone: "+40 722 654 321", email: "mihai.popescu@youthstation.org", birthday: "2000-02-17", online: false, initials: "MP" },
]
