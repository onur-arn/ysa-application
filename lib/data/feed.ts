import type { StationId } from "./stations"

export type EventItem = {
  id: string
  title: string
  date: string // ISO
  time: string
  place: string
  station: StationId
  past?: boolean
}

export const EVENTS: EventItem[] = [
  {
    id: "e1",
    title: "Assemblée Générale Annuelle",
    date: "2026-06-22",
    time: "18:00",
    place: "Maison des Associations, Paris",
    station: "intl",
  },
  {
    id: "e2",
    title: "Atelier Leadership & Projets",
    date: "2026-06-25",
    time: "14:30",
    place: "Espace Jeunes, Lyon",
    station: "lyon",
  },
  {
    id: "e3",
    title: "Tournoi de Football Inter-Stations",
    date: "2026-06-28",
    time: "10:00",
    place: "Stade Municipal, Marseille",
    station: "marseille",
  },
  {
    id: "e4",
    title: "Soirée Culturelle & Repas Partagé",
    date: "2026-07-04",
    time: "19:30",
    place: "Salle Polyvalente, Bordeaux",
    station: "bordeaux",
  },
  {
    id: "e5",
    title: "Forum des Bénévoles",
    date: "2026-05-30",
    time: "16:00",
    place: "Mairie de Toulouse",
    station: "toulouse",
    past: true,
  },
  {
    id: "e6",
    title: "Collecte Solidaire de Printemps",
    date: "2026-05-18",
    time: "09:00",
    place: "Place Centrale, Lille",
    station: "lille",
    past: true,
  },
]

export type IdeaStatus = "trending" | "new" | "accepted"

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
    title: "Créer une newsletter mensuelle inter-stations",
    description: "Un récap des activités de chaque station envoyé à tous les membres.",
    author: "Aylin Demir",
    station: "intl",
    up: 42,
    down: 3,
    status: "trending",
  },
  {
    id: "i2",
    title: "Week-end d'intégration pour les nouveaux",
    description: "Un séjour pour accueillir les nouveaux membres et créer du lien.",
    author: "Lucas Martin",
    station: "paris",
    up: 38,
    down: 5,
    status: "accepted",
  },
  {
    id: "i3",
    title: "Application de covoiturage pour les événements",
    description: "Faciliter les trajets partagés entre membres pour les grands événements.",
    author: "Hugo Moreau",
    station: "toulouse",
    up: 12,
    down: 1,
    status: "new",
  },
  {
    id: "i4",
    title: "Partenariat avec des entreprises locales",
    description: "Obtenir des réductions et du sponsoring pour nos projets.",
    author: "Mehmet Yılmaz",
    station: "marseille",
    up: 27,
    down: 8,
    status: "trending",
  },
]

export const STORY_BG: Record<string, string> = {
  intl: "188 57% 48%",
  paris: "221 70% 55%",
  lyon: "350 70% 55%",
  marseille: "28 85% 55%",
  bordeaux: "280 50% 55%",
  toulouse: "150 55% 45%",
  lille: "200 70% 50%",
}
