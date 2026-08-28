// ==========================================================================
// NRN AI — SETTINGS MODAL SYSTEM
// Provides Appearance, Chat, Interface, and Account settings
// ==========================================================================

import { getTheme, applyTheme, getDensity, applyDensity, getMotionPreference, applyMotionPreference } from './theme.js';
import { api } from './api.js';
import { showToast, icons, escapeHtml } from './ui.js';

let settingsModalEl = null;
let currentTab = 'appearance';

export function initSettingsModal(triggerBtn) {
  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => {
      openSettingsModal();
    });
  }

  // Keyboard shortcut Ctrl/Cmd + ,
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      openSettingsModal();
    }
  });
}

export async function openSettingsModal() {
  if (!settingsModalEl) {
    createSettingsModal();
  }

  // Load account info
  let user = { username: 'User', email: '' };
  try {
    user = await api.get('/api/users/me');
  } catch (err) {
    console.debug('Failed to load user in settings:', err);
  }

  renderSettingsContent(user);
  settingsModalEl.classList.add('open');
}

export function closeSettingsModal() {
  if (settingsModalEl) {
    settingsModalEl.classList.remove('open');
  }
}

function createSettingsModal() {
  settingsModalEl = document.createElement('div');
  settingsModalEl.id = 'settings-modal-backdrop';
  settingsModalEl.className = 'modal-backdrop';
  document.body.appendChild(settingsModalEl);

  settingsModalEl.addEventListener('click', (e) => {
    if (e.target === settingsModalEl) {
      closeSettingsModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsModalEl.classList.contains('open')) {
      closeSettingsModal();
    }
  });
}

function renderSettingsContent(user) {
  const theme = getTheme();
  const density = getDensity();
  const reducedMotion = getMotionPreference();
  const enterToSend = localStorage.getItem('nrn_enter_to_send') !== 'false';
  const autoScroll = localStorage.getItem('nrn_auto_scroll') !== 'false';
  const codeWrap = localStorage.getItem('nrn_code_wrap') === 'true';

  settingsModalEl.innerHTML = `
    <div class="modal-dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="settings-header">
        <h2 id="settings-title" class="modal-title" style="font-size:var(--fs-base);">Settings</h2>
        <button class="btn-icon" id="settings-close-btn" aria-label="Close settings">${icons.close}</button>
      </div>

      <div class="settings-layout">
        <!-- Sidebar Navigation -->
        <nav class="settings-nav" aria-label="Settings navigation">
          <button class="settings-nav-item ${currentTab === 'appearance' ? 'active' : ''}" data-tab="appearance">
            ${icons.sun} <span>Appearance</span>
          </button>
          <button class="settings-nav-item ${currentTab === 'chat' ? 'active' : ''}" data-tab="chat">
            ${icons.send} <span>Chat</span>
          </button>
          <button class="settings-nav-item ${currentTab === 'interface' ? 'active' : ''}" data-tab="interface">
            ${icons.monitor} <span>Interface</span>
          </button>
          <button class="settings-nav-item ${currentTab === 'account' ? 'active' : ''}" data-tab="account">
            ${icons.settings} <span>Account</span>
          </button>
        </nav>

        <!-- Tab Body -->
        <div class="settings-panel" id="settings-panel-content">
          ${renderTabContent(currentTab, { theme, density, reducedMotion, enterToSend, autoScroll, codeWrap, user })}
        </div>
      </div>
    </div>
  `;

  // Close button
  settingsModalEl.querySelector('#settings-close-btn').addEventListener('click', closeSettingsModal);

  // Tab switching
  settingsModalEl.querySelectorAll('.settings-nav-item').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      currentTab = tabBtn.getAttribute('data-tab');
      renderSettingsContent(user);
    });
  });

  // Bind tab controls
  bindTabEvents(user);
}

function renderTabContent(tab, state) {
  if (tab === 'appearance') {
    return `
      <div class="settings-section">
        <h3 class="settings-section-title">Color Theme</h3>
        <p class="settings-section-desc">Choose a theme or sync with your operating system.</p>
        
        <div class="segmented-control" role="group" aria-label="Theme selector">
          <button class="segmented-btn ${state.theme === 'light' ? 'active' : ''}" data-theme-val="light">
            ${icons.sun} <span>Light</span>
          </button>
          <button class="segmented-btn ${state.theme === 'dark' ? 'active' : ''}" data-theme-val="dark">
            ${icons.moon} <span>Dark</span>
          </button>
          <button class="segmented-btn ${state.theme === 'system' ? 'active' : ''}" data-theme-val="system">
            ${icons.monitor} <span>System</span>
          </button>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Interface Density</h3>
        <p class="settings-section-desc">Adjust spacing and padding for message readability.</p>
        
        <div class="segmented-control" role="group" aria-label="Density selector">
          <button class="segmented-btn ${state.density === 'comfortable' ? 'active' : ''}" data-density-val="comfortable">
            <span>Comfortable</span>
          </button>
          <button class="segmented-btn ${state.density === 'compact' ? 'active' : ''}" data-density-val="compact">
            <span>Compact</span>
          </button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-toggle-row">
          <div>
            <div class="settings-toggle-label">Wrap Code Blocks</div>
            <div class="settings-section-desc">Wrap long code lines instead of horizontal scrolling</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-code-wrap" ${state.codeWrap ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;
  }

  if (tab === 'chat') {
    return `
      <div class="settings-section">
        <div class="settings-toggle-row">
          <div>
            <div class="settings-toggle-label">Send on Enter</div>
            <div class="settings-section-desc">Press Enter to send, Shift+Enter for a new line</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-enter-send" ${state.enterToSend ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-toggle-row">
          <div>
            <div class="settings-toggle-label">Auto-scroll during response</div>
            <div class="settings-section-desc">Automatically follow token generation in real-time</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-auto-scroll" ${state.autoScroll ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;
  }

  if (tab === 'interface') {
    return `
      <div class="settings-section">
        <div class="settings-toggle-row">
          <div>
            <div class="settings-toggle-label">Reduce Motion</div>
            <div class="settings-section-desc">Minimize transitions and interface animations</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-reduced-motion" ${state.reducedMotion ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `;
  }

  if (tab === 'account') {
    return `
      <div class="settings-section">
        <h3 class="settings-section-title">Account Profile</h3>
        <div class="account-card">
          <div class="account-avatar">${escapeHtml(state.user.username.charAt(0).toUpperCase())}</div>
          <div class="account-details">
            <div class="account-username">${escapeHtml(state.user.username)}</div>
            <div class="account-email">${escapeHtml(state.user.email || 'Private Account')}</div>
          </div>
        </div>
      </div>

      <div class="settings-section" style="padding-top: var(--sp-4);">
        <button class="btn btn-danger btn-sm" id="settings-logout-btn">
          ${icons.logout} <span>Log out of NRN AI</span>
        </button>
      </div>
    `;
  }

  return '';
}

function bindTabEvents(user) {
  // Theme selection
  settingsModalEl.querySelectorAll('[data-theme-val]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const themeVal = btn.getAttribute('data-theme-val');
      applyTheme(themeVal);
      renderSettingsContent(user);
    });
  });

  // Density selection
  settingsModalEl.querySelectorAll('[data-density-val]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const densityVal = btn.getAttribute('data-density-val');
      applyDensity(densityVal);
      renderSettingsContent(user);
    });
  });

  // Code wrap
  const codeWrapToggle = settingsModalEl.querySelector('#toggle-code-wrap');
  if (codeWrapToggle) {
    codeWrapToggle.addEventListener('change', (e) => {
      localStorage.setItem('nrn_code_wrap', String(e.target.checked));
      document.documentElement.classList.toggle('wrap-code-blocks', e.target.checked);
    });
  }

  // Enter to send
  const enterToggle = settingsModalEl.querySelector('#toggle-enter-send');
  if (enterToggle) {
    enterToggle.addEventListener('change', (e) => {
      localStorage.setItem('nrn_enter_to_send', String(e.target.checked));
    });
  }

  // Auto scroll
  const scrollToggle = settingsModalEl.querySelector('#toggle-auto-scroll');
  if (scrollToggle) {
    scrollToggle.addEventListener('change', (e) => {
      localStorage.setItem('nrn_auto_scroll', String(e.target.checked));
    });
  }

  // Reduced motion
  const motionToggle = settingsModalEl.querySelector('#toggle-reduced-motion');
  if (motionToggle) {
    motionToggle.addEventListener('change', (e) => {
      applyMotionPreference(e.target.checked);
      renderSettingsContent(user);
    });
  }

  // Logout
  const logoutBtn = settingsModalEl.querySelector('#settings-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await api.post('/api/auth/logout');
        window.location.href = '/login';
      } catch {
        window.location.href = '/login';
      }
    });
  }
}
