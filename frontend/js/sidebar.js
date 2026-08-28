import { api } from './api.js';
import { icons, showToast, showConfirmModal, escapeHtml, formatDateGroup } from './ui.js';

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
  onNewChat,
}) {
  onSelectConversationCallback = onSelectConversation;
  onNewChatCallback = onNewChat;

  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      setActiveConversationId(null);
      if (onNewChatCallback) onNewChatCallback();
      closeMobileSidebar();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (searchClearBtn) {
        searchClearBtn.classList.toggle('visible', q.length > 0);
      }
      filterConversations(q, container);
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchClearBtn.classList.remove('visible');
        renderConversations(conversations, container);
      }
    });
  }

  // Load current user for footer
  loadUserProfile();

  // Load conversation list
  await reloadConversations(container);
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
    item.classList.toggle('active', item.getAttribute('data-id') === id);
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
    emptyNotice.style.padding = '12px 8px';
    emptyNotice.style.fontSize = 'var(--fs-xs)';
    emptyNotice.style.color = 'var(--color-text-faint)';
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
    console.error('Failed to load user profile:', err);
  }
}

export function closeMobileSidebar() {
  const sidebar = document.querySelector('.app-sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}
