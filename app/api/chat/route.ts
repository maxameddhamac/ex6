import { openai } from '@ai-sdk/openai';
import { streamText, UIMessage, convertToModelMessages, createIdGenerator } from 'ai';
import { auth } from '@/lib/auth';
import { loadMessages, saveMessages, getConversation } from '@/lib/chat-store';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Get the authenticated session
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Following AI SDK best practices: expect either full messages or single message
    const body = await req.json();
    const { messages, message: singleMessage, id: conversationId } = body;

    if (!conversationId) {
      return new Response('Conversation ID is required', { status: 400 });
    }

    // Validate conversation ownership
    const conversation = await getConversation(conversationId, session.user.id);
    if (!conversation) {
      return new Response('Conversation not found', { status: 404 });
    }

    let allMessages: UIMessage[];

    if (singleMessage) {
      // Optimized approach: load previous messages and append new one
      const previousMessages = await loadMessages(conversationId);
      allMessages = [...previousMessages, singleMessage];
      
      // Save the user message to database immediately
      await saveMessages(conversationId, [singleMessage], session.user.id);
    } else if (messages) {
      // Fallback: use all messages (less efficient)
      allMessages = messages;
    } else {
      return new Response('No messages provided', { status: 400 });
    }

    // Stream the AI response with proper persistence
    const result = streamText({
      model: openai('gpt-4o'),
      system: 'You are a helpful AI assistant. Be concise and helpful in your responses.',
      messages: convertToModelMessages(allMessages),
      onFinish: async (result) => {
        console.log('AI response finished:', result.text);
        
        // Save the assistant's response to database
        const assistantMessage: UIMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          parts: [{ type: 'text', text: result.text }],
        };
        
        console.log('Saving assistant message:', assistantMessage);
        
        // Save all messages including the new assistant response
        const finalMessages = [...allMessages, assistantMessage];
        await saveMessages(conversationId, finalMessages, session.user.id);
        
        console.log('Messages saved successfully');
      },
    });

    // Use consumeStream to handle client disconnects
    result.consumeStream();

    return result.toUIMessageStreamResponse({
      originalMessages: allMessages,
      // Generate consistent server-side IDs for persistence
      generateMessageId: createIdGenerator({
        prefix: 'msg',
        size: 16,
      }),
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
