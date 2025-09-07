import React, { useState, useEffect, useRef } from 'react';

interface Sticker {
  id: string;
  name: string;
  scenario: string;
  description: string;
  notes: string;
  imageUrl?: string;
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  stickers?: Sticker[];
}

interface ChatInterfaceProps {
  apiBase: string;
  groupName?: string;
  avatarUrl?: string;
  embedded?: boolean; // For use inside phone frame
}

export default function ChatInterface({ apiBase, groupName, avatarUrl, embedded = false }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableStickers, setAvailableStickers] = useState<Sticker[]>([]);
  const [chatAvatarUrl, setChatAvatarUrl] = useState(avatarUrl || '');
  const [displayGroupName, setDisplayGroupName] = useState(groupName || 'Loading...');
  const [groupId, setGroupId] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when new messages are added
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Focus the input field
  const focusInput = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  useEffect(() => {
    // Small delay to ensure DOM has updated
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  }, [messages]);

  // Extract groupId from URL on client-side
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const extractedGroupId = urlParams.get('groupId') || '';
    setGroupId(extractedGroupId);
    console.log('ChatInterface: Extracted groupId from URL:', extractedGroupId);
  }, []);

  // Load available stickers
  useEffect(() => {
    if (groupId && apiBase) {
      loadAvailableStickers();
      loadGroupData();
    }
  }, [groupId, apiBase]);

  // Update avatar and group name when props change
  useEffect(() => {
    if (avatarUrl) {
      setChatAvatarUrl(avatarUrl);
    }
    if (groupName) {
      setDisplayGroupName(groupName);
    }
  }, [avatarUrl, groupName]);

  const loadAvailableStickers = async () => {
    try {
      const response = await fetch(`${apiBase}/chat/stickers/${groupId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded available stickers response:', data);
        
        // Handle different response formats
        let stickers = [];
        if (Array.isArray(data)) {
          stickers = data;
        } else if (data.stickers && Array.isArray(data.stickers)) {
          stickers = data.stickers;
        } else if (data.stickerDefinitions && Array.isArray(data.stickerDefinitions)) {
          stickers = data.stickerDefinitions;
        }
        
        setAvailableStickers(stickers);
        console.log('✅ Processed stickers array:', stickers);
      } else {
        console.error('Failed to load stickers:', response.status);
      }
    } catch (error) {
      console.error('Error loading stickers:', error);
    }
  };

  const loadGroupData = async () => {
    try {
      const response = await fetch(`${apiBase}/sticker-groups/${groupId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded group data:', data);
        
        // Update group name
        if (data.name) {
          setDisplayGroupName(data.name);
        }
        
        // Update avatar from the input configuration
        if (data.input?.avatarCreation?.generatedAvatar?.url) {
          const avatarUrl = data.input.avatarCreation.generatedAvatar.url;
          setChatAvatarUrl(avatarUrl);
          console.log('✅ Updated chat avatar URL:', avatarUrl);
        } else {
          console.log('ℹ️ No avatar URL found in group data');
        }
      }
    } catch (error) {
      console.error('Error loading group data:', error);
    }
  };

  const addMessage = (text: string, isUser: boolean, stickers?: Sticker[]) => {
    if (!text.trim() && !stickers?.length) return;
    
    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      isUser,
      timestamp: new Date(),
      stickers
    };
    
    setMessages(prev => [...prev, newMessage]);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message
    addMessage(userMessage, true);
    
    // Scroll to bottom immediately after adding user message
    setTimeout(() => {
      scrollToBottom();
    }, 50);
    
    // Focus input after sending message
    setTimeout(() => {
      focusInput();
    }, 100);
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${apiBase}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          groupId: groupId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Chat response:', data);
        
        // Add AI response
        if (data.message) {
          addMessage(data.message, false);
        }
        
        // Add stickers if any
        if (data.stickerIds && data.stickerIds.length > 0) {
          const stickers = Array.isArray(availableStickers) ? availableStickers : [];
          const selectedStickers = data.stickerIds
            .map((id: string) => stickers.find(sticker => sticker.id === id))
            .filter(Boolean) as Sticker[];
          
          if (selectedStickers.length > 0) {
            addMessage('', false, selectedStickers);
          } else {
            // Show message to generate stickers
            addMessage("I'd love to show you a sticker, but you haven't generated any yet!", false);
          }
        }
        
        // Scroll to bottom after AI response
        setTimeout(() => {
          scrollToBottom();
        }, 100);
        
        // Focus input after AI response
        setTimeout(() => {
          focusInput();
        }, 200);
      } else {
        console.error('Chat request failed:', response.status);
        addMessage('Sorry, I encountered an error. Please try again.', false);
        // Focus input after error
        setTimeout(() => {
          focusInput();
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addMessage('Sorry, I encountered an error. Please try again.', false);
      // Focus input after error
      setTimeout(() => {
        focusInput();
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderStickerCollection = () => {
    // Ensure availableStickers is always an array
    const stickers = Array.isArray(availableStickers) ? availableStickers : [];
    
    if (stickers.length === 0) {
      return (
        <div className="w-full text-center py-4">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200">
            <div className="text-amber-600 mb-2">
              <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>
            </div>
            <p className="text-sm text-amber-700 font-medium mb-3">No stickers available</p>
            <p className="text-xs text-amber-600 mb-3">Generate your avatar and stickers first to see them in action!</p>
            <button 
              onClick={() => window.location.href = `/create?groupId=${groupId || ''}#avatar-creation`}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              Go to Avatar Creation
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex gap-2 overflow-x-auto">
        {stickers.slice(0, 8).map((sticker) => (
          <div key={sticker.id} className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
            {sticker.imageUrl ? (
              <img src={sticker.imageUrl} alt={sticker.name} className="w-7 h-7 rounded" />
            ) : (
              <div className="w-7 h-7 rounded bg-gray-300 flex items-center justify-center text-xs text-gray-500">?</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderMessage = (message: ChatMessage) => {
    if (!message.text && !message.stickers?.length) return null;

    if (message.isUser) {
      // User message - right aligned with blue background
      return (
        <div key={message.id} className="flex items-start space-x-2 justify-end">
          <div className="bg-indigo-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm max-w-[280px]">
            <p className="text-sm">{message.text}</p>
          </div>
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            <img 
              src="/dummy-sticker.webp" 
              alt="User" 
              className="w-6 h-6 rounded" 
            />
          </div>
        </div>
      );
    }

    // AI message - left aligned with white background
    return (
      <div key={message.id} className="flex items-start space-x-2">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
          {chatAvatarUrl ? (
            <img 
              src={chatAvatarUrl} 
              alt="AI" 
              className="w-6 h-6 rounded" 
            />
          ) : (
            <div className="w-6 h-6 bg-gray-300 rounded flex items-center justify-center">
              <span className="text-xs text-gray-500">AI</span>
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[280px]">
          {message.text && (
            <p className="text-sm text-gray-800">{message.text}</p>
          )}
          {message.stickers && message.stickers.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {message.stickers.map((sticker) => (
                <div key={sticker.id}>
                  {sticker.imageUrl ? (
                    <img src={sticker.imageUrl} alt={sticker.name} className="w-16 h-16 rounded-lg" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500 text-xs">?</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`w-full h-full min-h-[600px] overflow-hidden flex flex-col ${embedded ? '' : 'bg-white rounded-2xl shadow-lg border border-gray-200'}`}>
      {/* Chat Header */}
      <div className="h-16 bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center px-4 text-white flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            {chatAvatarUrl ? (
              <img src={chatAvatarUrl} alt="AI Assistant" className="w-8 h-8 rounded-lg" />
            ) : (
              <div className="w-8 h-8 bg-gray-300 rounded-lg flex items-center justify-center">
                <span className="text-xs text-gray-500 font-medium">AI</span>
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold">{displayGroupName}</h3>
            <p className="text-xs text-white/80">Online</p>
          </div>
        </div>
      </div>
      
      {/* Chat Messages Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 min-h-0">
        {/* Welcome Message */}
        <div className="flex items-start space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
            {chatAvatarUrl ? (
              <img src={chatAvatarUrl} alt="AI" className="w-6 h-6 rounded" />
            ) : (
              <div className="w-6 h-6 bg-gray-300 rounded flex items-center justify-center">
                <span className="text-xs text-gray-500">AI</span>
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[280px]">
            <p className="text-sm text-gray-800">Hi! I'm your AI Assistant. How can I help you today? 🚀</p>
          </div>
        </div>
        
        {/* Example Sticker Response */}
        {Array.isArray(availableStickers) && availableStickers.length > 0 && (
          <div className="flex items-start space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <img src={chatAvatarUrl} alt="AI" className="w-6 h-6 rounded" />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[280px]">
              <p className="text-sm text-gray-800 mb-2">Great question! Let me show you something cool:</p>
              <div className="flex justify-center">
                {availableStickers[0].imageUrl ? (
                  <img src={availableStickers[0].imageUrl} alt={availableStickers[0].name} className="w-16 h-16 rounded-lg" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500">?</div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Chat Messages */}
        {messages.map(renderMessage)}
        
        {/* Typing Indicator */}
        {isLoading && (
          <div className="flex items-start space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <img src={chatAvatarUrl} alt="AI" className="w-6 h-6 rounded" />
            </div>
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[280px]">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
        {/* Bottom padding to ensure input area is visible */}
        <div className="h-4"></div>
      </div>
      
      {/* Sticker Collection */}
      <div className="bg-white border-t border-gray-200 p-3 flex-shrink-0">
        {renderStickerCollection()}
      </div>
      
      {/* Input Area */}
      <div className="h-20 bg-white border-t border-gray-200 flex items-center px-4 space-x-3 flex-shrink-0">
        <button className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
          </svg>
        </button>
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>
        <button
          onClick={sendMessage}
          disabled={!inputMessage.trim() || isLoading}
          className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}
