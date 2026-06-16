import type { StationId } from "./stations"

export type ChatMessage = {
  id: string
  author: string
  initials: string
  text: string
  time: string
  self?: boolean
  image?: string
}

export type GroupConversation = {
  id: StationId
  type: "group"
  lastMessage: string
  lastTime: string
  unread: number
  messages: ChatMessage[]
}

export type DMConversation = {
  id: string
  type: "dm"
  name: string
  initials: string
  color: string
  online: boolean
  lastMessage: string
  lastTime: string
  unread: number
  messages: ChatMessage[]
}

export const GROUP_CHATS: GroupConversation[] = [
  {
    id: "intl",
    type: "group",
    lastMessage: "Aylin: N'oubliez pas l'AG de dimanche !",
    lastTime: "09:24",
    unread: 3,
    messages: [
      { id: "1", author: "Aylin Demir", initials: "AD", text: "Bonjour à toutes les stations !", time: "09:20" },
      { id: "2", author: "Lucas Martin", initials: "LM", text: "Salut le bureau international", time: "09:22" },
      { id: "3", author: "Aylin Demir", initials: "AD", text: "N'oubliez pas l'AG de dimanche !", time: "09:24" },
    ],
  },
  {
    id: "paris",
    type: "group",
    lastMessage: "Théo: Je m'occupe de la salle",
    lastTime: "Hier",
    unread: 0,
    messages: [
      { id: "1", author: "Théo Dubois", initials: "TD", text: "On se retrouve où vendredi ?", time: "18:02" },
      { id: "2", author: "Lucas Martin", initials: "LM", text: "Au local habituel", time: "18:10" },
      { id: "3", author: "Théo Dubois", initials: "TD", text: "Je m'occupe de la salle", time: "18:15" },
    ],
  },
  {
    id: "lyon",
    type: "group",
    lastMessage: "Emma: Photos de l'atelier 📸",
    lastTime: "Lun",
    unread: 1,
    messages: [{ id: "1", author: "Emma Bernard", initials: "EB", text: "Photos de l'atelier", time: "14:30" }],
  },
  {
    id: "marseille",
    type: "group",
    lastMessage: "Mehmet: Le tournoi approche !",
    lastTime: "Lun",
    unread: 0,
    messages: [{ id: "1", author: "Mehmet Yılmaz", initials: "MY", text: "Le tournoi approche !", time: "11:00" }],
  },
  {
    id: "bordeaux",
    type: "group",
    lastMessage: "Chloé: Menu de la soirée validé",
    lastTime: "Dim",
    unread: 0,
    messages: [{ id: "1", author: "Chloé Petit", initials: "CP", text: "Menu de la soirée validé", time: "20:12" }],
  },
  {
    id: "toulouse",
    type: "group",
    lastMessage: "Hugo: Merci à tous les bénévoles",
    lastTime: "Sam",
    unread: 0,
    messages: [{ id: "1", author: "Hugo Moreau", initials: "HM", text: "Merci à tous les bénévoles", time: "16:45" }],
  },
  {
    id: "lille",
    type: "group",
    lastMessage: "Zeynep: Bilan de la collecte",
    lastTime: "Ven",
    unread: 0,
    messages: [{ id: "1", author: "Zeynep Kaya", initials: "ZK", text: "Bilan de la collecte", time: "09:00" }],
  },
]

export const DM_CHATS: DMConversation[] = [
  {
    id: "dm1",
    type: "dm",
    name: "Aylin Demir",
    initials: "AD",
    color: "188 57% 48%",
    online: true,
    lastMessage: "Parfait, merci beaucoup !",
    lastTime: "10:32",
    unread: 2,
    messages: [
      { id: "1", author: "Aylin Demir", initials: "AD", text: "Salut, tu as un moment ?", time: "10:28" },
      { id: "2", author: "Moi", initials: "MO", text: "Oui bien sûr, je t'écoute", time: "10:30", self: true },
      { id: "3", author: "Aylin Demir", initials: "AD", text: "Parfait, merci beaucoup !", time: "10:32" },
    ],
  },
  {
    id: "dm2",
    type: "dm",
    name: "Lucas Martin",
    initials: "LM",
    color: "221 70% 55%",
    online: true,
    lastMessage: "On en parle demain",
    lastTime: "Hier",
    unread: 0,
    messages: [{ id: "1", author: "Lucas Martin", initials: "LM", text: "On en parle demain", time: "21:00" }],
  },
  {
    id: "dm3",
    type: "dm",
    name: "Emma Bernard",
    initials: "EB",
    color: "350 70% 55%",
    online: false,
    lastMessage: "Tu viens à l'atelier ?",
    lastTime: "Lun",
    unread: 0,
    messages: [{ id: "1", author: "Emma Bernard", initials: "EB", text: "Tu viens à l'atelier ?", time: "13:00" }],
  },
]
