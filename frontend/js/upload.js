import { api } from './api.js';
import { showToast, icons, escapeHtml } from './ui.js';

let pendingAttachments = []; // List of { id, original_name, mime_type, file, previewUrl }

export function initUploadHandler({ attachBtn, fileInput, previewContainer, getActiveConversationId }) {
  if (!attachBtn || !fileInput || !previewContainer) return;

  attachBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        showToast(`File "${file.name}" exceeds 10MB limit.`, 'error');
        continue;
      }

      await handleFileUpload(file, previewContainer, getActiveConversationId());
    }

    fileInput.value = ''; // Reset input
  });
}

async function handleFileUpload(file, previewContainer, conversationId) {
  const isImage = file.type.startsWith('image/');
  let previewUrl = null;

  if (isImage) {
    previewUrl = URL.createObjectURL(file);
  }

  const tempId = 'upload_' + Date.now() + Math.random().toString(36).substring(2, 7);
  const item = {
    tempId,
    id: null,
    original_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    previewUrl,
    uploading: true
  };

  pendingAttachments.push(item);
  renderPreviewChips(previewContainer);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const targetConv = conversationId || 'new';
    const result = await api.upload(`/api/conversations/${targetConv}/upload`, formData);
    item.id = result.id;
    item.uploading = false;
    renderPreviewChips(previewContainer);
  } catch (err) {
    showToast(`Upload failed for "${file.name}": ${err.message}`, 'error');
    pendingAttachments = pendingAttachments.filter(a => a.tempId !== tempId);
    renderPreviewChips(previewContainer);
  }
}

function renderPreviewChips(container) {
  container.innerHTML = '';
  pendingAttachments.forEach((att) => {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    
    let thumbHtml = '';
    if (att.previewUrl) {
      thumbHtml = `<img src="${att.previewUrl}" alt="preview">`;
    }

    chip.innerHTML = `
      ${thumbHtml}
      <span class="attachment-name" title="${escapeHtml(att.original_name)}">${escapeHtml(att.original_name)}</span>
      <span class="attachment-remove" data-id="${att.tempId}" title="Remove">${icons.close}</span>
    `;

    chip.querySelector('.attachment-remove').addEventListener('click', () => {
      pendingAttachments = pendingAttachments.filter(a => a.tempId !== att.tempId);
      renderPreviewChips(container);
    });

    container.appendChild(chip);
  });
}

export function getPendingAttachmentIds() {
  return pendingAttachments.filter(a => a.id && !a.uploading).map(a => a.id);
}

export function clearPendingAttachments(container) {
  pendingAttachments = [];
  if (container) {
    container.innerHTML = '';
  }
}
