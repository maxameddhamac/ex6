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
 * Load messages for a specific conversation (Vercel guide pattern)
 */
export async function loadChat(conversationId: string): Promise<UIMessage[]> {
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
 * Legacy function for backward compatibility
 */
export async function loadMessages(conversationId: string): Promise<UIMessage[]> {
  return loadChat(conversationId);
}

/**
 * Save messages to database (Vercel guide pattern)
 */
export async function saveChat({ chatId, messages }: { chatId: string; messages: UIMessage[] }): Promise<void> {
  console.log('saveChat called with:', { chatId, messagesCount: messages.length });
  
  // Get the conversation to get userId
  const conv = await db
    .select({ userId: conversation.userId })
    .from(conversation)
    .where(eq(conversation.id, chatId))
    .limit(1);

  if (conv.length === 0) {
    throw new Error('Conversation not found');
  }

  // Get existing messages to avoid duplicates
  const existingMessages = await db
    .select({ id: message.id })
    .from(message)
    .where(eq(message.conversationId, chatId));

  const existingIds = new Set(existingMessages.map(m => m.id));
  console.log('Existing message IDs:', Array.from(existingIds));

  // Insert only new messages
  const newMessages = messages.filter(msg => !existingIds.has(msg.id));
  console.log('New messages to save:', newMessages.length);
  console.log('New messages details:', newMessages.map(msg => {
    const textPart = msg.parts.find(part => part.type === 'text');
    return { id: msg.id, role: msg.role, content: textPart?.text || '' };
  }));
  
  if (newMessages.length > 0) {
    const messageData = newMessages.map(msg => {
      // Find the text part in the message (not just the first part)
      const textPart = msg.parts.find(part => part.type === 'text');
      const content = textPart?.text || '';
      
      return {
        id: msg.id,
        content,
        role: msg.role,
        conversationId: chatId,
        userId: conv[0].userId,
      };
    });

    console.log('Inserting message data:', messageData);
    await db.insert(message).values(messageData);
    console.log('Messages inserted successfully');
  } else {
    console.log('No new messages to insert');
  }

  // Update conversation timestamp
  await db
    .update(conversation)
    .set({ updatedAt: new Date() })
    .where(eq(conversation.id, chatId));
}

/**
 * Legacy function for backward compatibility
 */
export async function saveMessages(conversationId: string, messages: UIMessage[], userId: string): Promise<void> {
  return saveChat({ chatId: conversationId, messages });
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
