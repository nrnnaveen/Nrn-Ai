// Resilient WebSocket Client with Reconnect and Heartbeat

export class WSManager {
  constructor(endpoint, { onMessage, onStatusChange }) {
    this.endpoint = endpoint;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseDelay = 1000;
    this.isExplicitlyClosed = false;
    this.pingInterval = null;
  }

  connect() {
    this.isExplicitlyClosed = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const fullUrl = `${protocol}//${host}${this.endpoint}`;

    if (this.onStatusChange) this.onStatusChange('connecting');

    try {
      this.socket = new WebSocket(fullUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        if (this.onStatusChange) this.onStatusChange('connected');
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (this.onMessage) this.onMessage(parsed);
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', event.data);
        }
      };

      this.socket.onclose = (event) => {
        this.stopHeartbeat();
        if (this.onStatusChange) this.onStatusChange('disconnected');

        if (!this.isExplicitlyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(this.baseDelay * Math.pow(1.5, this.reconnectAttempts), 15000);
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), delay);
        }
      };

      this.socket.onerror = (err) => {
        console.warn('WebSocket connection error:', err);
      };
    } catch (err) {
      console.error('Failed to instantiate WebSocket:', err);
      if (this.onStatusChange) this.onStatusChange('disconnected');
    }
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.socket.send(payload);
      return true;
    }
    return false;
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  close() {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
