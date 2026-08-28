import { api } from './api.js';
import { icons, escapeHtml } from './ui.js';

let availableModels = [];
let currentSelectedModel = '';
let onChangeCallbackFn = null;

export async function initModelPicker({
  wrapperEl,
  buttonEl,
  labelEl,
  dropdownEl,
  onChangeCallback
}) {
  if (!wrapperEl || !buttonEl || !dropdownEl) return;
  onChangeCallbackFn = onChangeCallback;

  try {
    const data = await api.get('/api/models');
    availableModels = data.models || [];
    const defaultModel = data.default || (availableModels[0] ? availableModels[0].id : '');

    const savedModel = localStorage.getItem('nrn_ai_preferred_model');
    currentSelectedModel = savedModel || defaultModel;

    renderDropdownOptions(dropdownEl, labelEl, wrapperEl);
    updateCurrentLabel(labelEl);

    // Toggle dropdown
    buttonEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrapperEl.classList.toggle('open');
      buttonEl.setAttribute('aria-expanded', isOpen);
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!wrapperEl.contains(e.target)) {
        wrapperEl.classList.remove('open');
        buttonEl.setAttribute('aria-expanded', 'false');
      }
    });

  } catch (err) {
    console.error('Failed to load models:', err);
  }
}

function renderDropdownOptions(dropdownEl, labelEl, wrapperEl) {
  dropdownEl.innerHTML = '';

  availableModels.forEach((m) => {
    const isSelected = m.id === currentSelectedModel;
    const item = document.createElement('div');
    item.className = `model-option-card ${isSelected ? 'selected' : ''}`;
    item.setAttribute('data-id', m.id);
    item.setAttribute('role', 'menuitem');

    let visionBadge = '';
    if (m.supports_vision) {
      visionBadge = `<span class="badge" style="font-size:10px;padding:1px 4px;background-color:var(--color-accent-subtle);color:var(--color-accent);border-color:var(--color-accent);">👁 Vision</span>`;
    }

    item.innerHTML = `
      <div class="model-option-header">
        <div class="model-option-title-group">
          <span class="model-option-name">${escapeHtml(m.name)}</span>
          ${visionBadge}
        </div>
        <span class="model-option-check">${icons.check}</span>
      </div>
      <div class="model-option-desc">${escapeHtml(m.description || '')}</div>
    `;

    item.addEventListener('click', () => {
      setSelectedModel(m.id, labelEl, dropdownEl);
      wrapperEl.classList.remove('open');
      if (onChangeCallbackFn) {
        onChangeCallbackFn(m.id);
      }
    });

    dropdownEl.appendChild(item);
  });
}

function updateCurrentLabel(labelEl) {
  if (!labelEl) return;
  const current = availableModels.find((m) => m.id === currentSelectedModel);
  if (current) {
    labelEl.textContent = current.name.replace(/\(Free\)/i, '').trim();
    if (current.supports_vision) {
      labelEl.textContent += ' 👁';
    }
  } else {
    labelEl.textContent = 'Model';
  }
}

export function getSelectedModel() {
  return currentSelectedModel;
}

export function setSelectedModel(modelId, labelEl, dropdownEl) {
  if (!modelId) return;
  currentSelectedModel = modelId;
  localStorage.setItem('nrn_ai_preferred_model', currentSelectedModel);

  if (labelEl) {
    updateCurrentLabel(labelEl);
  }

  const dropdown = dropdownEl || document.getElementById('model-picker-dropdown');
  if (dropdown) {
    const cards = dropdown.querySelectorAll('.model-option-card');
    cards.forEach((card) => {
      card.classList.toggle('selected', card.getAttribute('data-id') === modelId);
    });
  }
}

export function isCurrentModelVisionCapable() {
  const m = availableModels.find((model) => model.id === currentSelectedModel);
  return m ? m.supports_vision : false;
}
