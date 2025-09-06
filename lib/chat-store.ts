import { UIMessage } from 'ai';
import { db } from '@/db/drizzle';
import { conversation, message } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

/**
 * Create a new conversation for a user
 */
export async function createConversation(userId: string, title?: string): Promise<string> {
  const conversationId = nanoid();
  
  await db.insert(conversation).values({
    id: conversationId,
    title: title || 'New Conversation',
    userId,
  });
  
  return conversationId;
}

/**
 * Load messages for a specific conversation
 */
export async function loadMessages(conversationId: string): Promise<UIMessage[]> {
  const messages = await db
    .select()
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(message.createdAt);

  return messages.map(msg => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: msg.content }],
  }));
}

/**
 * Save messages to database
 */
export async function saveMessages(conversationId: string, messages: UIMessage[], userId: string): Promise<void> {
  console.log('saveMessages called with:', { conversationId, messagesCount: messages.length, userId });
  
  // Get existing messages to avoid duplicates
  const existingMessages = await db
    .select({ id: message.id })
    .from(message)
    .where(eq(message.conversationId, conversationId));

  const existingIds = new Set(existingMessages.map(m => m.id));
  console.log('Existing message IDs:', Array.from(existingIds));

  // Insert only new messages
  const newMessages = messages.filter(msg => !existingIds.has(msg.id));
  console.log('New messages to save:', newMessages.length);
  
  if (newMessages.length > 0) {
    const messageData = newMessages.map(msg => ({
      id: msg.id,
      content: msg.parts[0]?.type === 'text' ? msg.parts[0].text : '',
      role: msg.role,
      conversationId,
      userId,
    }));

    console.log('Inserting message data:', messageData);
    await db.insert(message).values(messageData);
    console.log('Messages inserted successfully');
  }

  // Update conversation timestamp
  await db
    .update(conversation)
    .set({ updatedAt: new Date() })
    .where(eq(conversation.id, conversationId));
}

/**
 * Get user's conversations
 */
export async function getUserConversations(userId: string) {
  return await db
    .select()
    .from(conversation)
    .where(eq(conversation.userId, userId))
    .orderBy(desc(conversation.updatedAt));
}

/**
 * Get conversation by ID (with user validation)
 */
export async function getConversation(conversationId: string, userId: string) {
  const result = await db
    .select()
    .from(conversation)
    .where(eq(conversation.id, conversationId))
    .limit(1);

  const conv = result[0];
  if (!conv || conv.userId !== userId) {
    return null;
  }

  return conv;
}
