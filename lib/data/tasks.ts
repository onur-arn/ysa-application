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
    title: "Réserver la salle pour l'AG annuelle",
    description: "Contacter la Maison des Associations et confirmer la réservation pour le 22 juin.",
    station: "intl",
    priority: "urgent",
    assignee: "Lucas Martin",
    assigneeInitials: "LM",
    status: "in_progress",
    comments: [
      { id: "c1", author: "Aylin Demir", initials: "AD", text: "On a besoin d'une salle pour 80 personnes.", time: "Hier" },
      { id: "c2", author: "Lucas Martin", initials: "LM", text: "Je m'en occupe aujourd'hui.", time: "Hier" },
    ],
  },
  {
    id: "t2",
    title: "Préparer l'affiche du tournoi de foot",
    description: "Créer un visuel attractif pour le tournoi inter-stations de Marseille.",
    station: "marseille",
    priority: "normal",
    assignee: "Mehmet Yılmaz",
    assigneeInitials: "MY",
    status: "todo",
    comments: [],
  },
  {
    id: "t3",
    title: "Envoyer la newsletter de juin",
    description: "Rédiger et envoyer le récap mensuel à tous les membres.",
    station: "intl",
    priority: "normal",
    assignee: "Aylin Demir",
    assigneeInitials: "AD",
    status: "done",
    comments: [{ id: "c3", author: "Emma Bernard", initials: "EB", text: "Super travail, merci !", time: "Lun" }],
  },
  {
    id: "t4",
    title: "Acheter le matériel pour l'atelier",
    description: "Liste : feutres, paperboard, post-its, badges.",
    station: "lyon",
    priority: "low",
    assignee: "Emma Bernard",
    assigneeInitials: "EB",
    status: "todo",
    comments: [],
  },
  {
    id: "t5",
    title: "Valider le budget de la soirée culturelle",
    description: "Vérifier les devis traiteur et présenter au trésorier.",
    station: "bordeaux",
    priority: "urgent",
    assignee: "Chloé Petit",
    assigneeInitials: "CP",
    status: "in_progress",
    comments: [],
  },
  {
    id: "t6",
    title: "Recruter des bénévoles pour la collecte",
    description: "Objectif : 15 bénévoles pour la prochaine collecte solidaire.",
    station: "lille",
    priority: "normal",
    assignee: "Zeynep Kaya",
    assigneeInitials: "ZK",
    status: "done",
    comments: [],
  },
]
