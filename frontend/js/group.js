import { api } from './api.js';
import { WSManager } from './ws.js';
import { renderMarkdown } from './markdown.js';
import { showToast, icons, formatTime, escapeHtml } from './ui.js';
import { initThemeSystem } from './theme.js';

let currentUser = null;
let currentRoomId = 'general';
let wsClient = null;
let groupMessages = [];

document.addEventListener('DOMContentLoaded', async () => {
  initThemeSystem();
  try {
    currentUser = await api.get('/api/users/me');
    initGroupRoom();
  } catch (err) {
    window.location.href = '/login';
  }
});

async function initGroupRoom() {
  const messagesContainer = document.getElementById('group-messages-container');
  const scrollArea = document.getElementById('group-scroll-area');
  const composerForm = document.getElementById('group-composer-form');
  const composerInput = document.getElementById('group-composer-input');
  const sendBtn = document.getElementById('group-send-btn');
  const statusDot = document.getElementById('connection-status-dot');
  const statusText = document.getElementById('connection-status-text');
  const presenceCountEl = document.getElementById('online-count-badge');

  // Load message history
  await loadRoomHistory();

  // Initialize WebSocket connection
  wsClient = new WSManager(`/ws/group/${currentRoomId}`, {
    onMessage: (event) => {
      if (event.type === 'message' && event.data) {
        const newMsg = event.data;
        // Avoid duplicate if already exists
        if (!groupMessages.some(m => m.id === newMsg.id)) {
          groupMessages.push(newMsg);
          renderGroupMessages(messagesContainer);
          scrollToBottom(scrollArea);
        }
      } else if (event.type === 'presence' && event.data) {
        if (presenceCountEl && event.data.online_count !== undefined) {
          presenceCountEl.textContent = `${event.data.online_count} online`;
        }
      }
    },
    onStatusChange: (status) => {
      if (!statusDot || !statusText) return;
      statusDot.className = 'status-dot ' + status;
      if (status === 'connected') {
        statusText.textContent = 'Connected';
      } else if (status === 'connecting') {
        statusText.textContent = 'Connecting...';
      } else {
        statusText.textContent = 'Disconnected';
      }
    }
  });

  wsClient.connect();

  // Send message handler
  composerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = composerInput.value.trim();
    if (!text) return;

    composerInput.value = '';
    sendBtn.disabled = true;

    // Send over WebSocket or fallback to HTTP
    const sentOverWs = wsClient.send({ content: text });
    if (!sentOverWs) {
      try {
        await api.post(`/api/group/rooms/${currentRoomId}/messages`, { content: text });
      } catch (err) {
        showToast(`Failed to send message: ${err.message}`, 'error');
      }
    }

    sendBtn.disabled = false;
    composerInput.focus();
  });
}

async function loadRoomHistory() {
  const messagesContainer = document.getElementById('group-messages-container');
  const scrollArea = document.getElementById('group-scroll-area');

  try {
    groupMessages = await api.get(`/api/group/rooms/${currentRoomId}/messages`);
    renderGroupMessages(messagesContainer);
    scrollToBottom(scrollArea);
  } catch (err) {
    showToast(`Failed to load room history: ${err.message}`, 'error');
  }
}

function renderGroupMessages(container) {
  if (!container) return;
  container.innerHTML = '';

  if (!groupMessages.length) {
    container.innerHTML = `
      <div class="chat-empty-state">
        <h2 class="empty-title">General AI Group</h2>
        <p class="empty-subtitle">No messages yet. Start the conversation with other members and NRN AI.</p>
      </div>
    `;
    return;
  }

  groupMessages.forEach((msg) => {
    const isOwn = currentUser && msg.sender_id === currentUser.id;
    const isAi = msg.sender_type === 'ai';

    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${isOwn ? 'user' : 'assistant'}`;

    let senderLabel = msg.sender_name;
    if (isOwn) {
      senderLabel = `${msg.sender_name} (you)`;
    } else if (isAi) {
      senderLabel = 'NRN AI';
    }

    const timeStr = formatTime(msg.created_at);

    if (isAi) {
      const rendered = renderMarkdown(msg.content);
      wrapper.innerHTML = `
        <div class="message-header">
          <span class="message-sender" style="color: var(--color-accent);">${senderLabel}</span>
          <span>${timeStr}</span>
        </div>
        <div class="message-bubble markdown-body" style="border-left: 2px solid var(--color-accent); padding-left: 12px;">
          ${rendered}
        </div>
      `;
    } else {
      wrapper.innerHTML = `
        <div class="message-header">
          <span class="message-sender">${senderLabel}</span>
          <span>${timeStr}</span>
        </div>
        <div class="message-bubble ${isOwn ? '' : 'other-user-bubble'}" style="${!isOwn ? 'background-color: var(--color-surface-alt); padding: 8px 12px; border: 1px solid var(--color-border); max-width: 80%;' : ''}">
          ${escapeHtml(msg.content)}
        </div>
      `;
    }

    container.appendChild(wrapper);
  });
}

function scrollToBottom(scrollArea) {
  if (scrollArea) {
    scrollArea.scrollTop = scrollArea.scrollHeight;
  }
}
