// ==========================================================================
// NRN AI — SIDEBAR CONTROLLER & DATE GROUPING
// Linear / Claude / Notion / Apple Restrained Design Language
// ==========================================================================

import { api } from './api.js';
import { showConfirmModal, showToast, icons, formatDateGroup, escapeHtml } from './ui.js';

let conversations = [];
let activeConversationId = null;
let onSelectConversationCallback = null;
let onNewChatCallback = null;

export async function initSidebar({
  container,
  newChatBtn,
  searchInput,
  searchClearBtn,
  onSelectConversation,
  onNewChat
}) {
  onSelectConversationCallback = onSelectConversation;
  onNewChatCallback = onNewChat;

  // New Chat action
  newChatBtn.addEventListener('click', () => {
    setActiveConversationId(null);
    if (onNewChatCallback) {
      onNewChatCallback();
    }
    closeMobileSidebar();
  });

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (searchClearBtn) {
        searchClearBtn.classList.toggle('visible', q.length > 0);
      }
      filterConversations(q, container);
    });

    if (searchClearBtn) {
      searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchClearBtn.classList.remove('visible');
        renderConversations(conversations, container);
        searchInput.focus();
      });
    }
  }

  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K -> Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }

    // Cmd/Ctrl + Shift + O -> New Chat
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
      e.preventDefault();
      newChatBtn.click();
    }
  });

  // Load past conversations from API
  await reloadConversations(container);
  await loadUserProfile();
}

export async function reloadConversations(container) {
  try {
    conversations = await api.get('/api/conversations');
    renderConversations(conversations, container);
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

export function setActiveConversationId(id) {
  activeConversationId = id;
  const items = document.querySelectorAll('.convo-item');
  items.forEach((item) => {
    const itemId = item.getAttribute('data-id');
    item.classList.toggle('active', itemId === id);
  });
}

export function getActiveConversationId() {
  return activeConversationId;
}

function filterConversations(query, container) {
  if (!query) {
    renderConversations(conversations, container);
    return;
  }
  const filtered = conversations.filter((c) => c.title.toLowerCase().includes(query));
  renderConversations(filtered, container, query);
}

function renderConversations(list, container, searchFilter = '') {
  if (!container) return;
  container.innerHTML = '';

  if (!list.length) {
    const emptyNotice = document.createElement('div');
    emptyNotice.style.padding = '16px 8px';
    emptyNotice.style.fontSize = 'var(--fs-xs)';
    emptyNotice.style.color = 'var(--color-text-faint)';
    emptyNotice.style.textAlign = 'center';
    emptyNotice.textContent = searchFilter ? 'No matching conversations.' : 'No conversations yet.';
    container.appendChild(emptyNotice);
    return;
  }

  // Group by date
  const groups = {
    'Today': [],
    'Yesterday': [],
    'Previous 7 Days': [],
    'Older': []
  };

  list.forEach((conv) => {
    const groupKey = formatDateGroup(conv.updated_at);
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(conv);
  });

  Object.entries(groups).forEach(([groupName, groupItems]) => {
    if (!groupItems.length) return;

    const groupWrapper = document.createElement('div');
    groupWrapper.className = 'convo-group-wrapper';

    const groupTitle = document.createElement('div');
    groupTitle.className = 'convo-group-title';
    groupTitle.textContent = groupName;
    groupWrapper.appendChild(groupTitle);

    const listUl = document.createElement('div');
    listUl.className = 'convo-list';

    groupItems.forEach((conv) => {
      const item = document.createElement('div');
      item.className = `convo-item ${conv.id === activeConversationId ? 'active' : ''}`;
      item.setAttribute('data-id', conv.id);

      item.innerHTML = `
        <span class="convo-title" title="${escapeHtml(conv.title)}">${escapeHtml(conv.title)}</span>
        <div class="convo-actions">
          <button class="convo-action-btn rename" title="Rename">${icons.edit}</button>
          <button class="convo-action-btn delete" title="Delete">${icons.trash}</button>
        </div>
      `;

      // Select conversation
      item.addEventListener('click', (e) => {
        if (e.target.closest('.convo-actions')) return;
        setActiveConversationId(conv.id);
        if (onSelectConversationCallback) {
          onSelectConversationCallback(conv);
        }
        closeMobileSidebar();
      });

      // Rename button
      item.querySelector('.rename').addEventListener('click', (e) => {
        e.stopPropagation();
        promptRename(conv, container);
      });

      // Delete button
      item.querySelector('.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        promptDelete(conv, container);
      });

      listUl.appendChild(item);
    });

    groupWrapper.appendChild(listUl);
    container.appendChild(groupWrapper);
  });
}

function promptRename(conv, container) {
  const newTitle = prompt('Rename conversation:', conv.title);
  if (newTitle && newTitle.trim() && newTitle.trim() !== conv.title) {
    api.patch(`/api/conversations/${conv.id}`, { title: newTitle.trim() })
      .then((updated) => {
        conv.title = updated.title;
        renderConversations(conversations, container);
        const titleEl = document.getElementById('chat-title');
        if (titleEl && activeConversationId === conv.id) {
          titleEl.textContent = updated.title;
        }
        showToast('Conversation renamed.', 'success');
      })
      .catch((err) => showToast(`Failed to rename: ${err.message}`, 'error'));
  }
}

function promptDelete(conv, container) {
  showConfirmModal({
    title: 'Delete conversation',
    body: `Are you sure you want to delete "${conv.title}"? All messages and attachments will be permanently removed.`,
    confirmText: 'Delete permanently',
    danger: true,
    onConfirm: async () => {
      try {
        await api.delete(`/api/conversations/${conv.id}`);
        conversations = conversations.filter((c) => c.id !== conv.id);
        if (activeConversationId === conv.id) {
          setActiveConversationId(null);
          if (onNewChatCallback) onNewChatCallback();
        }
        renderConversations(conversations, container);
        showToast('Conversation deleted.', 'success');
      } catch (err) {
        showToast(`Failed to delete: ${err.message}`, 'error');
      }
    }
  });
}

async function loadUserProfile() {
  try {
    const user = await api.get('/api/users/me');
    const avatarEl = document.getElementById('user-avatar');
    const nameEl = document.getElementById('user-name');
    if (avatarEl) {
      avatarEl.textContent = user.username.charAt(0).toUpperCase();
    }
    if (nameEl) {
      nameEl.textContent = user.username;
    }
  } catch (err) {
    console.debug('Failed to load user profile in sidebar:', err);
  }
}

export function closeMobileSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}
