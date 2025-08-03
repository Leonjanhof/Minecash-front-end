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

  constructor() {
    // WebSocket server runs on port 8080, HTTP server on port 3000
    // Use environment variable for production, fallback to localhost for development
    const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8080';
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
      this.callbacks.onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
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
    };

    this.ws.onerror = (error) => {
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
    // Prevent duplicate joins to the same gamemode
    if (this.lastJoinedGamemode === gamemode) {
      return;
    }
    
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
}

// Create singleton instance
export const websocketService = new WebSocketService();

// Export the class for testing
export default WebSocketService; 