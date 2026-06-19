import type { StationId } from "./stations"

export type EventComment = {
  id: string
  author: string
  initials: string
  text: string
  time: string
}

export type EventItem = {
  id: string
  title: string
  date: string // ISO
  time: string
  place: string
  station: StationId
  past?: boolean
  description?: string
  link?: string
  image?: string
  likes: number
  participantsCount: number
  notAttendingCount: number
  comments: EventComment[]
}

export const EVENTS: EventItem[] = [
  {
    id: "e1",
    title: "Yıllık Genel Kurul",
    date: "2026-06-22",
    time: "18:00",
    place: "Dernekler Evi, Paris",
    station: "intl",
    description: "Tüm istasyonların katılımıyla yıllık genel kurul toplantısı.",
    link: "https://zoom.us/j/123456789",
    likes: 14,
    participantsCount: 32,
    notAttendingCount: 5,
    comments: [
      { id: "c1", author: "Aylin Demir", initials: "AD", text: "Katılacağım, sabırsızlanıyorum!", time: "2g önce" },
    ],
  },
  {
    id: "e2",
    title: "Liderlik & Proje Atölyesi",
    date: "2026-06-25",
    time: "14:30",
    place: "Gençlik Merkezi, Lyon",
    station: "lyon",
    description: "Proje yönetimi ve liderlik becerilerini geliştirmek için atölye.",
    likes: 8,
    participantsCount: 15,
    notAttendingCount: 2,
    comments: [],
  },
  {
    id: "e3",
    title: "İstasyonlar Arası Futbol Turnuvası",
    date: "2026-06-28",
    time: "10:00",
    place: "Belediye Stadyumu, Nancy",
    station: "nancy",
    description: "Tüm istasyonlar katılabilir. Takımlar en az 5 kişilik olmalı.",
    likes: 22,
    participantsCount: 48,
    notAttendingCount: 3,
    comments: [
      { id: "c2", author: "Thomas Girard", initials: "TG", text: "Nancy takımı hazır!", time: "1g önce" },
    ],
  },
  {
    id: "e4",
    title: "Kültür Gecesi & Ortak Yemek",
    date: "2026-07-04",
    time: "19:30",
    place: "Çok Amaçlı Salon, Strasbourg",
    station: "strasbourg",
    description: "Her istasyondan bir yemek getirin, birlikte paylaşalım!",
    link: "https://zoom.us/j/987654321",
    likes: 19,
    participantsCount: 27,
    notAttendingCount: 4,
    comments: [],
  },
  {
    id: "e5",
    title: "Gönüllüler Forumu",
    date: "2026-05-30",
    time: "16:00",
    place: "Belediye Binası, Caen",
    station: "caen",
    past: true,
    likes: 11,
    participantsCount: 20,
    notAttendingCount: 6,
    comments: [],
  },
  {
    id: "e6",
    title: "Bahar Dayanışma Kampanyası",
    date: "2026-05-18",
    time: "09:00",
    place: "Merkez Meydan, Hamburg",
    station: "hamburg",
    past: true,
    image: "/youth-event.png",
    likes: 7,
    participantsCount: 18,
    notAttendingCount: 1,
    comments: [],
  },
]

export type IdeaStatus = "trending" | "new" | "accepted" | "igem"

export type IdeaItem = {
  id: string
  title: string
  description: string
  author: string
  station: StationId
  up: number
  down: number
  status: IdeaStatus
}

export const IDEAS: IdeaItem[] = [
  {
    id: "i1",
    title: "İstasyonlar arası aylık bülten",
    description: "Her istasyonun faaliyetlerinin özetinin tüm üyelere gönderilmesi.",
    author: "Aylin Demir",
    station: "intl",
    up: 42,
    down: 3,
    status: "trending",
  },
  {
    id: "i2",
    title: "Yeni üyeler için entegrasyon hafta sonu",
    description: "Yeni üyeleri karşılamak ve bağ kurmak için bir kamp.",
    author: "Lucas Martin",
    station: "paris",
    up: 38,
    down: 5,
    status: "accepted",
  },
  {
    id: "i3",
    title: "Etkinlikler için araç paylaşım uygulaması",
    description: "Büyük etkinliklere gidişi kolaylaştırmak için üyeler arası araç paylaşımı.",
    author: "Hugo Moreau",
    station: "nancy",
    up: 12,
    down: 1,
    status: "new",
  },
  {
    id: "i4",
    title: "Yerel işletmelerle ortaklık",
    description: "Projelerimiz için indirim ve sponsorluk almak.",
    author: "Mehmet Yılmaz",
    station: "caen",
    up: 27,
    down: 8,
    status: "trending",
  },
]

export const STORY_BG: Record<string, string> = {
  intl: "188 57% 48%",
  paris: "221 70% 55%",
  caen: "350 70% 55%",
  nancy: "28 85% 55%",
  strasbourg: "280 50% 55%",
  lyon: "150 55% 45%",
  hamburg: "200 70% 50%",
  bucarest: "45 90% 50%",
}
