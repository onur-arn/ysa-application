export const messageKeys = {
  all: ["messages"] as const,
  conversations: (userId: string) => [...messageKeys.all, "conversations", userId] as const,
  thread: (conversationId: string) => [...messageKeys.all, "thread", conversationId] as const,
}

export const storyKeys = {
  all: ["stories"] as const,
  list: () => [...storyKeys.all, "list"] as const,
}
