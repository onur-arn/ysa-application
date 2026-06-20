import type { StationId } from "./stations"

export type PostComment = {
  id: string
  author: string
  initials: string
  station: StationId
  text: string
  time: string
}

export type Post = {
  id: string
  author: string
  initials: string
  station: StationId
  content: string
  imageUrl?: string
  createdAt: string
  likedBy: string[]
  comments: PostComment[]
}

export const POSTS: Post[] = [
  {
    id: "p1",
    author: "Aylin Demir",
    initials: "AD",
    station: "intl",
    content: "Genel kurul toplantısına tüm istasyonlardan büyük bir katılım bekliyoruz! Projelerinizi ve önerilerinizi hazırlamayı unutmayın 💪",
    createdAt: "2026-06-19T09:00:00Z",
    likedBy: ["Emma Bernard", "Mehmet Yılmaz", "Sophie Leroux", "Zeynep Kaya", "Thomas Girard", "Chloé Petit", "Hugo Moreau", "Léa Dupont", "Kemal Şahin", "Lucas Martin", "Aylin Demir", "Fatma Çelik", "Pierre Durand", "Yusuf Arslan"],
    comments: [
      { id: "c1", author: "Emma Bernard", initials: "EB", station: "paris", text: "Biz Paris olarak hazırız!", time: "2sa" },
      { id: "c2", author: "Mehmet Yılmaz", initials: "MY", station: "caen", text: "Caen istasyonu olarak katılacağız.", time: "1sa" },
    ],
  },
  {
    id: "p2",
    author: "Sophie Leroux",
    initials: "SL",
    station: "paris",
    content: "Bu hafta Paris'te gerçekleştirdiğimiz proje atölyesi harika geçti! Katılan herkese teşekkürler. Notları yakında paylaşacağım.",
    createdAt: "2026-06-18T15:30:00Z",
    likedBy: ["Hugo Moreau", "Aylin Demir", "Zeynep Kaya", "Thomas Girard", "Chloé Petit", "Mehmet Yılmaz", "Lucas Martin", "Pierre Durand", "Yusuf Arslan"],
    comments: [
      { id: "c3", author: "Hugo Moreau", initials: "HM", station: "paris", text: "Çok verimli bir gündü, teşekkürler!", time: "5sa" },
    ],
  },
  {
    id: "p3",
    author: "Zeynep Kaya",
    initials: "ZK",
    station: "caen",
    content: "YSA sosyal medya hesaplarımızı daha aktif hale getirmek istiyoruz. İçerik üretmek isteyen var mı? Birlikte çalışalım!",
    createdAt: "2026-06-17T11:00:00Z",
    likedBy: ["Aylin Demir", "Emma Bernard", "Sophie Leroux", "Hugo Moreau", "Thomas Girard", "Chloé Petit", "Léa Dupont", "Kemal Şahin", "Lucas Martin", "Mehmet Yılmaz", "Fatma Çelik", "Pierre Durand", "Yusuf Arslan", "Alara Yıldız", "Can Koç", "Deniz Arslan", "Ece Şen", "Furkan Doğan", "Gizem Aydın", "Hakan Öztürk", "Irem Kara"],
    comments: [],
  },
  {
    id: "p4",
    author: "Chloé Petit",
    initials: "CP",
    station: "nancy",
    content: "Nancy istasyonu olarak yeni üyelerimizi aramıza katıyoruz. Hoş geldiniz! 🎉",
    createdAt: "2026-06-16T18:00:00Z",
    likedBy: ["Thomas Girard", "Léa Dupont", "Aylin Demir", "Emma Bernard", "Sophie Leroux", "Zeynep Kaya", "Kemal Şahin", "Hugo Moreau", "Lucas Martin", "Mehmet Yılmaz", "Fatma Çelik", "Pierre Durand", "Yusuf Arslan", "Alara Yıldız", "Can Koç", "Deniz Arslan", "Ece Şen"],
    comments: [
      { id: "c4", author: "Thomas Girard", initials: "TG", station: "nancy", text: "Hoş geldiniz!", time: "1g" },
      { id: "c5", author: "Léa Dupont", initials: "LD", station: "nancy", text: "Birlikte güzel işler yapacağız 🙌", time: "1g" },
    ],
  },
  {
    id: "p5",
    author: "Kemal Şahin",
    initials: "KS",
    station: "hamburg",
    content: "Hamburg'dan merhaba! Avrupa gençlik programları hakkında bilgi almak isteyen varsa ulaşabilir.",
    createdAt: "2026-06-15T10:00:00Z",
    likedBy: ["Aylin Demir", "Emma Bernard", "Sophie Leroux", "Hugo Moreau", "Thomas Girard", "Chloé Petit"],
    comments: [],
  },
  {
    id: "p6",
    author: "Emma Bernard",
    initials: "EB",
    station: "paris",
    content: "Mayıs ayı çalışma raporunu hazırladık. İstasyonlardan gelen geri bildirimler çok değerliydi, teşekkürler!",
    createdAt: "2026-06-10T14:00:00Z",
    likedBy: ["Aylin Demir", "Sophie Leroux", "Hugo Moreau", "Zeynep Kaya"],
    comments: [],
  },
  {
    id: "p7",
    author: "Thomas Girard",
    initials: "TG",
    station: "nancy",
    content: "Nancy istasyonunun Mayıs etkinliğinden harika fotoğraflar çektik. Yakında albümü paylaşacağız!",
    createdAt: "2026-06-07T09:30:00Z",
    likedBy: ["Chloé Petit", "Léa Dupont", "Aylin Demir", "Emma Bernard", "Sophie Leroux"],
    comments: [
      { id: "c6", author: "Chloé Petit", initials: "CP", station: "nancy", text: "Heyecanla bekliyoruz!", time: "13g" },
    ],
  },
  {
    id: "p8",
    author: "Léa Martin",
    initials: "LM",
    station: "strasbourg",
    content: "Strasbourg kültür gecesi büyük bir başarıyla tamamlandı! Katılan herkese teşekkürler, önümüzdeki yıl görüşürüz.",
    createdAt: "2026-06-03T20:00:00Z",
    likedBy: ["Aylin Demir", "Emma Bernard", "Sophie Leroux", "Thomas Girard", "Chloé Petit", "Zeynep Kaya", "Kemal Şahin"],
    comments: [],
  },
]
