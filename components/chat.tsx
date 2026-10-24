'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, AlertCircle, RotateCcw, MessageSquare, MessageSquarePlus, PanelLeft } from 'lucide-react';
import { UIMessage } from 'ai';
import { Streamdown } from 'streamdown';

interface ChatProps {
  conversationId: string;
  initialMessages?: UIMessage[];
  conversationTitle?: string;
  conversations: { id: string; title: string }[];
}

export default function Chat({ conversationId, initialMessages = [], conversationTitle, conversations }: ChatProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousStatusRef = useRef('ready');

  const { messages, sendMessage, status, error, stop } = useChat({
    id: conversationId, // Use conversation ID for persistence
    messages: initialMessages, // Load initial messages
    transport: new DefaultChatTransport({
      api: '/api/chat',
      // Optimized: only send the last message to reduce data transfer
      prepareSendMessagesRequest({ messages, id }) {
        return { 
          body: { 
            message: messages[messages.length - 1], 
            id 
          } 
        };
      },
    }),
  });

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);

  useEffect(() => {
    if (
      previousStatusRef.current !== 'ready' &&
      status === 'ready'
    ) {
      router.refresh();
    }
    previousStatusRef.current = status;
  }, [status, router]);

  if (!session) {
    return null;
  }

  return (
    <div className="flex h-screen bg-white">
      {sidebarOpen && (
        <button
          aria-label="Close conversation history"
          className="fixed inset-0 z-10 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`${sidebarOpen ? 'flex' : 'hidden md:flex'} fixed inset-y-0 left-0 z-20 w-72 flex-col border-r border-rose-100 bg-rose-50/50 p-4 md:relative md:w-64`}>
        <Button
          onClick={() => {
            setSidebarOpen(false);
            router.push('/chat');
          }}
          className="mb-6 w-full justify-start gap-2 bg-rose-500 text-white hover:bg-rose-600"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </Button>
        <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Recent conversations
        </h2>
        <nav aria-label="Conversation history" className="flex-1 space-y-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="px-2 py-3 text-sm text-gray-500">Your chats will appear here.</p>
          ) : conversations.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSidebarOpen(false);
                router.push(`/chat/${item.id}`);
              }}
              title={item.title}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                item.id === conversationId
                  ? 'bg-rose-100 font-medium text-rose-700'
                  : 'text-gray-700 hover:bg-rose-100/70'
              }`}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.title}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-rose-100 bg-white px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open conversation history"
                className="shrink-0 text-rose-600 md:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={session.user.image || ''} />
                <AvatarFallback className="bg-rose-500 font-medium text-white">
                  {session.user.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-gray-900">
                  {conversationTitle || 'AI Chat'}
                </h1>
                <p className="text-sm text-rose-500">Chat with AI Assistant</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="shrink-0 border-rose-200 text-rose-600 hover:bg-rose-50"
            >
              Back to Dashboard
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-6 bg-rose-100 rounded-full flex items-center justify-center">
                <Bot className="h-8 w-8 text-rose-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Start a conversation
              </h3>
              <p className="text-gray-500">
                Ask me anything! I&apos;m here to help.
              </p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start space-x-3 max-w-2xl ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <Avatar className="h-7 w-7 flex-shrink-0">
                  {message.role === 'user' ? (
                    <>
                      <AvatarImage src={session.user.image || ''} />
                      <AvatarFallback className="bg-rose-500 text-white text-xs">
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </>
                  ) : (
                    <AvatarFallback className="bg-rose-100">
                      <Bot className="h-3 w-3 text-rose-500" />
                    </AvatarFallback>
                  )}
                </Avatar>
                
                <div className={`rounded-2xl px-4 py-3 ${
                  message.role === 'user' 
                    ? 'bg-rose-500 text-white' 
                    : 'bg-gray-50 text-gray-900 border border-gray-100'
                }`}>
                  <div className="text-sm leading-relaxed">
                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case 'text':
                          return message.role === 'assistant' ? (
                            <Streamdown 
                              key={i}
                              className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-code:text-rose-600 prose-code:bg-rose-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 prose-pre:border prose-pre:border-gray-200"
                              parseIncompleteMarkdown={true}
                            >
                              {part.text}
                            </Streamdown>
                          ) : (
                            <span key={i} className="whitespace-pre-wrap">{part.text}</span>
                          );
                        default:
                          return null;
                      }
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {(status === 'submitted' || status === 'streaming') && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-2xl">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-rose-100">
                    <Bot className="h-3 w-3 text-rose-500" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center space-x-2">
                    {status === 'submitted' && (
                      <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    )}
                    <span className="text-gray-500 text-sm">
                      {status === 'submitted' ? 'AI is thinking...' : 'AI is responding...'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => stop()}
                      className="ml-2 h-5 px-2 text-xs text-rose-500 hover:bg-rose-50"
                    >
                      Stop
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-2xl">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="bg-red-100">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-800 font-medium text-sm">Something went wrong</p>
                      <p className="text-red-600 text-xs">Please try again</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                      className="ml-2 h-6 px-2 text-xs border-red-200 text-red-600 hover:bg-red-100"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-rose-100 bg-white p-6">
          <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim() && status === 'ready') {
              sendMessage({ text: input });
              setInput('');
            }
          }}
          className="max-w-4xl mx-auto"
        >
          <div className="flex space-x-3">
            <input
              className="flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-colors"
              value={input}
              placeholder="Type your message..."
              onChange={(e) => setInput(e.target.value)}
              disabled={status !== 'ready'}
            />
            <Button 
              type="submit" 
              disabled={status !== 'ready' || !input.trim()}
              className="px-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          </form>
        </div>
      </main>
    </div>
  );
}
