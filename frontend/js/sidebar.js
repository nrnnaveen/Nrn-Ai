// ==========================================================================
// NRN AI — SIDEBAR CONTROLLER, RESIZER & DATE GROUPING
// Linear / Claude / Notion / Apple Restrained Design Language
// ==========================================================================

import { api } from './api.js';
import { showConfirmModal, showToast, icons, formatDateGroup, escapeHtml } from './ui.js';

let conversations = [];
let activeConversationId = null;
let onSelectConversationCallback = null;
let onNewChatCallback = null;

const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 480;

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

  // 1. Initialize Sidebar Resizer & Collapse Systems
  initSidebarResizer();
  initSidebarToggle();

  // 2. New Chat action
  newChatBtn.addEventListener('click', () => {
    setActiveConversationId(null);
    if (onNewChatCallback) {
      onNewChatCallback();
    }
    closeMobileSidebar();
  });

  // 3. Search input
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

  // 4. Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K -> Focus search
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
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

    // Cmd/Ctrl + B -> Toggle sidebar
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      toggleSidebar();
    }
  });

  // 5. Load past conversations from API
  await reloadConversations(container);
  await loadUserProfile();
}

/**
 * Initializes adjustable sidebar drag handle (col-resize)
 */
function initSidebarResizer() {
  const sidebar = document.getElementById('app-sidebar');
  const resizer = document.getElementById('sidebar-resizer');
  if (!sidebar || !resizer) return;

  // Restore saved width on desktop
  const savedWidth = localStorage.getItem('nrn_sidebar_width');
  if (savedWidth && window.innerWidth > 768) {
    const widthNum = parseInt(savedWidth, 10);
    if (!isNaN(widthNum) && widthNum >= MIN_SIDEBAR_WIDTH && widthNum <= MAX_SIDEBAR_WIDTH) {
      sidebar.style.width = `${widthNum}px`;
    }
  }

  let isDragging = false;

  const startDrag = (clientX) => {
    if (window.innerWidth <= 768) return;
    isDragging = true;
    document.body.classList.add('is-resizing-sidebar');
  };

  const onDrag = (clientX) => {
    if (!isDragging || window.innerWidth <= 768) return;
    const clampedWidth = Math.min(Math.max(clientX, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
    sidebar.style.width = `${clampedWidth}px`;
  };

  const stopDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.classList.remove('is-resizing-sidebar');
    const finalWidth = sidebar.offsetWidth;
    if (finalWidth >= MIN_SIDEBAR_WIDTH && finalWidth <= MAX_SIDEBAR_WIDTH && window.innerWidth > 768) {
      localStorage.setItem('nrn_sidebar_width', finalWidth.toString());
    }
  };

  // Mouse drag
  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startDrag(e.clientX);
  });

  document.addEventListener('mousemove', (e) => {
    onDrag(e.clientX);
  });

  document.addEventListener('mouseup', stopDrag);

  // Double-click to reset to default
  resizer.addEventListener('dblclick', () => {
    if (window.innerWidth <= 768) return;
    sidebar.style.width = `${DEFAULT_SIDEBAR_WIDTH}px`;
    localStorage.setItem('nrn_sidebar_width', DEFAULT_SIDEBAR_WIDTH.toString());
    showToast('Sidebar width reset to default.', 'success');
  });
}

/**
 * Initializes show/hide sidebar toggle controls
 */
function initSidebarToggle() {
  const sidebar = document.getElementById('app-sidebar');
  const collapseBtn = document.getElementById('collapse-sidebar-btn');
  const headerToggleBtn = document.getElementById('header-sidebar-toggle-btn');
  if (!sidebar) return;

  // Restore collapsed state on desktop only
  const isCollapsed = localStorage.getItem('nrn_sidebar_collapsed') === 'true';
  if (isCollapsed && window.innerWidth > 768) {
    sidebar.classList.add('collapsed');
  }

  if (collapseBtn) {
    collapseBtn.addEventListener('click', toggleSidebar);
  }

  if (headerToggleBtn) {
    headerToggleBtn.addEventListener('click', toggleSidebar);
  }
}

export function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;

  if (window.innerWidth <= 768) {
    // Mobile drawer toggle
    const isOpen = sidebar.classList.toggle('open');
    if (backdrop) {
      backdrop.classList.toggle('open', isOpen);
    }
  } else {
    // Desktop collapse toggle
    const isCollapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('nrn_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  }
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
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}
