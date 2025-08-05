// WebSocket Client Service
// Purpose: Handle WebSocket connection to backend for real-time gaming

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface WebSocketCallbacks {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private callbacks: WebSocketCallbacks = {};
  private messageHandlers: Set<MessageHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private connectionCount = 0; // Track how many components are using the connection
  private lastJoinedGamemode: string | null = null; // Track last joined gamemode to prevent duplicates
  private keepAliveInterval: NodeJS.Timeout | null = null; // Keep-alive interval

  constructor() {
    // WebSocket server runs on port 8080, HTTP server on port 3000
    // Use environment variable for production, fallback to localhost for development
    const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || 
      (import.meta.env.PROD ? 'wss://minecash-backend-production.up.railway.app' : 'ws://localhost:8080');
    this.url = wsUrl;
  }

  connect(callbacks: WebSocketCallbacks = {}) {
    this.connectionCount++;
    console.log(`webSocket connection requested (count: ${this.connectionCount})`);

    // If already connected, just update callbacks (don't call onConnect again)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.callbacks = { ...this.callbacks, ...callbacks };
      console.log('webSocket already connected - updating callbacks only');
      return;
    }

    // If already connecting, just update callbacks
    if (this.isConnecting) {
      this.callbacks = { ...this.callbacks, ...callbacks };
      console.log('webSocket already connecting - updating callbacks only');
      return;
    }

    this.isConnecting = true;
    this.callbacks = { ...this.callbacks, ...callbacks };

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('failed to create webSocket connection:', error);
      this.isConnecting = false;
      this.connectionCount = Math.max(0, this.connectionCount - 1);
    }
  }

  private setupEventHandlers() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('webSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.startKeepAlive();
      
      // If we were previously in a gamemode, automatically rejoin
      if (this.lastJoinedGamemode) {
        console.log(`auto-rejoining ${this.lastJoinedGamemode} after reconnection`);
        // Small delay to ensure connection is stable
        setTimeout(() => {
          this.send({
            type: 'join_game',
            gamemode: this.lastJoinedGamemode
          });
        }, 100);
      }
      
      this.callbacks.onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle ping/pong for keep-alive - don't log or process these messages
        if (message.type === 'ping') {
          this.send({ type: 'pong', timestamp: Date.now() });
          return;
        }
        
        // Explicitly filter out pong messages to prevent them from reaching handlers
        if (message.type === 'pong') {
          return;
        }
        
        // Additional safety check - don't process any message that looks like a pong
        if (message.type && message.type.toLowerCase().includes('pong')) {
          return;
        }
        
        // Log non-ping/pong messages for debugging
        console.log('webSocket message received:', message);
        
        // Call the main message callback
        this.callbacks.onMessage?.(message);
        
        // Call all registered message handlers
        this.messageHandlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error('error in message handler:', error);
          }
        });
      } catch (error) {
        console.error('error parsing webSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('webSocket disconnected');
      this.isConnecting = false;
      this.callbacks.onDisconnect?.();
      
      // Only attempt reconnect if components are still using the connection
      if (this.connectionCount > 0) {
        this.attemptReconnect();
      }
      // Note: Don't reset lastJoinedGamemode here - let it persist across reconnections
      // This allows us to automatically rejoin the same room when reconnecting
    };

    this.ws.onerror = (error) => {
      // Filter out pong-related errors to prevent error notifications
      const errorMessage = error?.toString() || '';
      if (errorMessage.toLowerCase().includes('pong') || errorMessage.toLowerCase().includes('ping')) {
        console.log('Blocked pong-related WebSocket error:', errorMessage);
        return;
      }
      
      console.error('webSocket error:', error);
      this.isConnecting = false;
      this.callbacks.onError?.(error);
    };
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect(this.callbacks);
    }, delay);
  }

  send(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('webSocket not connected, message not sent:', message);
    }
  }

  joinGame(gamemode: string, token?: string) {
    // Always attempt to join (let backend handle duplicates)
    console.log(`joining ${gamemode} game room`);
    this.lastJoinedGamemode = gamemode;
    this.send({
      type: 'join_game',
      gamemode,
      token
    });
  }

  leaveGame() {
    // Send leave message to server to properly handle room leaving
    if (this.lastJoinedGamemode) {
      this.send({
        type: 'leave_game',
        gamemode: this.lastJoinedGamemode
      });
      this.lastJoinedGamemode = null;
    }
  }

  placeBet(amount: number, gameId?: string) {
    this.send({
      type: 'place_bet',
      amount,
      gameId
    });
  }

  sendGameAction(action: string, additionalData?: any) {
    this.send({
      type: 'game_action',
      action,
      ...additionalData
    });
  }

  sendChatMessage(message: string, gamemode: string) {
    this.send({
      type: 'chat_message',
      message,
      gamemode
    });
  }

  // Message handler management
  addMessageHandler(handler: MessageHandler) {
    this.messageHandlers.add(handler);
  }

  removeMessageHandler(handler: MessageHandler) {
    this.messageHandlers.delete(handler);
  }

  disconnect() {
    this.connectionCount = Math.max(0, this.connectionCount - 1);
    console.log(`webSocket disconnect requested (count: ${this.connectionCount})`);

    // Only actually disconnect when no components are using the connection
    if (this.connectionCount === 0) {
      console.log('webSocket actually disconnecting');
      this.stopKeepAlive();
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.callbacks = {};
      this.lastJoinedGamemode = null; // Reset gamemode tracking on full disconnect
    }
  }

  // Force disconnect (for debugging or admin purposes)
  forceDisconnect() {
    console.log('webSocket force disconnecting');
    this.connectionCount = 0;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks = {};
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionCount(): number {
    return this.connectionCount;
  }

  // Reset gamemode tracking (useful when switching between games)
  resetGamemodeTracking() {
    this.lastJoinedGamemode = null;
  }

  // Get current gamemode (for checking if already in a room)
  getCurrentGamemode(): string | null {
    return this.lastJoinedGamemode;
  }

  // Start client-side keep-alive
  private startKeepAlive() {
    // Clear any existing interval
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    // Send ping every 25 seconds to keep connection alive
    this.keepAliveInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, 25000); // 25 seconds (slightly less than server's 30 seconds)
  }

  // Stop keep-alive
  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}

// Create singleton instance
export const websocketService = new WebSocketService();

// Export the class for testing
export default WebSocketService; 