import type { StationId } from "./stations"

export type TaskStatus = "todo" | "in_progress" | "done"
export type TaskPriority = "urgent" | "normal" | "low"

export type TaskComment = {
  id: string
  author: string
  initials: string
  text: string
  time: string
}

export type Task = {
  id: string
  title: string
  description: string
  station: StationId
  priority: TaskPriority
  assignee: string
  assigneeInitials: string
  status: TaskStatus
  comments: TaskComment[]
}

export const TASKS: Task[] = [
  {
    id: "t1",
    title: "Yıllık Genel Kurul için salon rezervasyonu",
    description: "Dernekler Evi ile iletişime geç ve 22 Haziran için rezervasyonu onayla.",
    station: "intl",
    priority: "urgent",
    assignee: "Lucas Martin",
    assigneeInitials: "LM",
    status: "in_progress",
    comments: [
      { id: "c1", author: "Aylin Demir", initials: "AD", text: "80 kişilik bir salona ihtiyacımız var.", time: "Dün" },
      { id: "c2", author: "Lucas Martin", initials: "LM", text: "Bugün hallediyorum.", time: "Dün" },
    ],
  },
  {
    id: "t2",
    title: "Haziran bültenini gönder",
    description: "Aylık özeti hazırla ve tüm üyelere gönder.",
    station: "intl",
    priority: "normal",
    assignee: "Aylin Demir",
    assigneeInitials: "AD",
    status: "done",
    comments: [{ id: "c3", author: "Emma Bernard", initials: "EB", text: "Harika çalışma, teşekkürler!", time: "Pzt" }],
  },
  {
    id: "t3",
    title: "Futbol turnuvası afişi hazırla",
    description: "Nancy istasyonlararası turnuvası için çekici bir görsel oluştur.",
    station: "nancy",
    priority: "normal",
    assignee: "Chloé Petit",
    assigneeInitials: "CP",
    status: "todo",
    comments: [],
  },
  {
    id: "t4",
    title: "Nancy kasası güncellemesi",
    description: "Mayıs ayı harcamalarını kontrol et ve hazineye rapor et.",
    station: "nancy",
    priority: "urgent",
    assignee: "Thomas Girard",
    assigneeInitials: "TG",
    status: "in_progress",
    comments: [],
  },
  {
    id: "t5",
    title: "Atölye için malzeme al",
    description: "Liste: keçeli kalem, flipchart, post-it, rozet.",
    station: "lyon",
    priority: "low",
    assignee: "Marie Leroy",
    assigneeInitials: "ML",
    status: "todo",
    comments: [],
  },
  {
    id: "t6",
    title: "Kültür gecesi bütçesini onayla",
    description: "Catering tekliflerini kontrol et ve hazineciye sun.",
    station: "strasbourg",
    priority: "urgent",
    assignee: "Léa Martin",
    assigneeInitials: "LM",
    status: "in_progress",
    comments: [],
  },
  {
    id: "t7",
    title: "Gönüllü kampanyası planla",
    description: "Hedef: önümüzdeki kampanya için 15 gönüllü.",
    station: "hamburg",
    priority: "normal",
    assignee: "Jana Müller",
    assigneeInitials: "JM",
    status: "done",
    comments: [],
  },
]
