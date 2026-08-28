import { api } from './api.js';
import { renderMarkdown } from './markdown.js';
import { consumeSSEStream, cancelStreaming, isStreaming } from './streaming.js';
import { getSelectedModel, setSelectedModel } from './model_picker.js';
import { getPendingAttachmentIds, clearPendingAttachments } from './upload.js';
import { showToast, icons, formatTime, escapeHtml } from './ui.js';
import { setActiveConversationId, reloadConversations, getActiveConversationId } from './sidebar.js';

let messages = [];
let currentConversation = null;

export function initChat({
  messagesContainer,
  scrollArea,
  composerForm,
  composerTextarea,
  sendBtn,
  stopBtn,
  chatTitleEl,
  modelLabelEl,
  modelDropdownEl,
  previewContainer,
  sidebarContainer,
}) {
  // Auto-resize composer textarea
  composerTextarea.addEventListener('input', () => {
    composerTextarea.style.height = 'auto';
    composerTextarea.style.height = Math.min(composerTextarea.scrollHeight, 180) + 'px';
  });

  // Enter to send, Shift+Enter for newline
  composerTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  composerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      cancelStreaming();
      setStreamingState(false);
    });
  }

  // Click on chat title to rename inline
  if (chatTitleEl) {
    chatTitleEl.addEventListener('click', () => {
      if (!currentConversation) return;
      const newTitle = prompt('Rename conversation:', currentConversation.title);
      if (newTitle && newTitle.trim() && newTitle.trim() !== currentConversation.title) {
        api.patch(`/api/conversations/${currentConversation.id}`, { title: newTitle.trim() })
          .then((updated) => {
            currentConversation.title = updated.title;
            chatTitleEl.textContent = updated.title;
            reloadConversations(sidebarContainer);
            showToast('Conversation renamed.', 'success');
          })
          .catch((err) => showToast(`Failed to rename: ${err.message}`, 'error'));
      }
    });
  }

  function setStreamingState(streaming) {
    if (sendBtn) sendBtn.style.display = streaming ? 'none' : 'flex';
    if (stopBtn) stopBtn.style.display = streaming ? 'flex' : 'none';
  }

  async function handleSendMessage() {
    const text = composerTextarea.value.trim();
    const attachmentIds = getPendingAttachmentIds();

    if (!text && !attachmentIds.length) return;
    if (isStreaming()) return;

    composerTextarea.value = '';
    composerTextarea.style.height = 'auto';
    clearPendingAttachments(previewContainer);

    let convId = currentConversation ? currentConversation.id : null;
    const selectedModel = getSelectedModel();

    // If starting a brand new conversation
    if (!convId) {
      try {
        currentConversation = await api.post('/api/conversations', {
          title: text.substring(0, 40) || 'New Conversation',
          model: selectedModel
        });
        convId = currentConversation.id;
        setActiveConversationId(convId);
      } catch (err) {
        showToast(`Failed to initialize conversation: ${err.message}`, 'error');
        return;
      }
    }

    // Render optimistic user message
    const tempUserMsg = {
      id: 'temp_user_' + Date.now(),
      role: 'user',
      content: text,
      attachments: [],
      created_at: new Date().toISOString()
    };
    messages.push(tempUserMsg);
    renderMessagesList();
    scrollToBottom();

    // Prepare assistant message bubble for streaming
    const tempAssistantMsg = {
      id: 'temp_ai_' + Date.now(),
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      isStreaming: true
    };
    messages.push(tempAssistantMsg);
    renderMessagesList();
    scrollToBottom();

    setStreamingState(true);

    const streamUrl = `/api/conversations/${convId}/messages`;
    await consumeSSEStream({
      url: streamUrl,
      method: 'POST',
      body: {
        content: text,
        model: selectedModel,
        attachment_ids: attachmentIds
      },
      onChunk: (accumulated) => {
        tempAssistantMsg.content = accumulated;
        updateAssistantBubble(tempAssistantMsg.id, accumulated, true);
        scrollToBottom();
      },
      onComplete: (fullText, finalData) => {
        tempAssistantMsg.content = fullText;
        tempAssistantMsg.isStreaming = false;
        if (finalData && finalData.message_id) {
          tempAssistantMsg.id = finalData.message_id;
        }
        if (finalData && finalData.title && chatTitleEl) {
          currentConversation.title = finalData.title;
          chatTitleEl.textContent = finalData.title;
        }
        updateAssistantBubble(tempAssistantMsg.id, fullText, false);
        setStreamingState(false);
        reloadConversations(sidebarContainer);
      },
      onError: (err) => {
        tempAssistantMsg.content = 'NRN AI couldn\'t respond right now — please try again.';
        tempAssistantMsg.isStreaming = false;
        updateAssistantBubble(tempAssistantMsg.id, tempAssistantMsg.content, false);
        setStreamingState(false);
        showToast(err.message || 'Stream error occurred.', 'error');
      }
    });
  }

  function renderMessagesList() {
    messagesContainer.innerHTML = '';

    if (!messages.length) {
      messagesContainer.innerHTML = `
        <div class="chat-empty-state">
          <h2 class="empty-title">Start a new conversation</h2>
          <p class="empty-subtitle">Ask questions, solve problems, analyze data, or draft code with NRN AI.</p>
        </div>
      `;
      return;
    }

    messages.forEach((msg, idx) => {
      const isLastAi = msg.role === 'assistant' && idx === messages.length - 1;
      const el = createMessageElement(msg, isLastAi);
      messagesContainer.appendChild(el);
    });
  }

  function createMessageElement(msg, isLastAi = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${msg.role}`;
    wrapper.id = `msg-${msg.id}`;

    let attachmentsHtml = '';
    if (msg.attachments && msg.attachments.length) {
      attachmentsHtml = '<div class="message-attachments">';
      msg.attachments.forEach((att) => {
        if (att.mime_type && att.mime_type.startsWith('image/')) {
          attachmentsHtml += `<img src="${att.url}" alt="${escapeHtml(att.original_name)}" class="message-image-thumb">`;
        } else {
          attachmentsHtml += `
            <a href="${att.url}" target="_blank" class="attachment-chip" style="text-decoration:none;">
              <span class="attachment-name">${escapeHtml(att.original_name)}</span>
            </a>
          `;
        }
      });
      attachmentsHtml += '</div>';
    }

    const timeStr = formatTime(msg.created_at);
    const senderName = msg.role === 'user' ? 'You' : 'NRN AI';

    if (msg.role === 'user') {
      wrapper.innerHTML = `
        <div class="message-header">
          <span class="message-sender">${senderName}</span>
          <span>${timeStr}</span>
        </div>
        ${attachmentsHtml}
        <div class="message-bubble">${escapeHtml(msg.content)}</div>
        <div class="message-actions-bar">
          <button class="action-btn-pill edit-msg-btn" data-id="${msg.id}">
            ${icons.edit} <span>Edit</span>
          </button>
        </div>
      `;

      // Edit message handler
      const editBtn = wrapper.querySelector('.edit-msg-btn');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          showInlineEditor(wrapper, msg);
        });
      }
    } else {
      // Assistant message
      const renderedBody = renderMarkdown(msg.content);
      const cursorHtml = msg.isStreaming ? '<span class="streaming-cursor"></span>' : '';

      wrapper.innerHTML = `
        <div class="message-header">
          <span class="message-sender">${senderName}</span>
          <span>${timeStr}</span>
        </div>
        <div class="message-bubble markdown-body">${renderedBody}${cursorHtml}</div>
        <div class="message-actions-bar">
          ${isLastAi && !msg.isStreaming ? `
            <button class="action-btn-pill regenerate-btn" data-id="${msg.id}">
              ${icons.refresh} <span>Regenerate</span>
            </button>
          ` : ''}
        </div>
      `;

      const regenBtn = wrapper.querySelector('.regenerate-btn');
      if (regenBtn) {
        regenBtn.addEventListener('click', () => {
          handleRegenerate(msg.id);
        });
      }
    }

    return wrapper;
  }

  function updateAssistantBubble(msgId, content, isStillStreaming) {
    const wrapper = document.getElementById(`msg-${msgId}`);
    if (!wrapper) return;

    const bubble = wrapper.querySelector('.message-bubble');
    if (bubble) {
      const rendered = renderMarkdown(content);
      const cursor = isStillStreaming ? '<span class="streaming-cursor"></span>' : '';
      bubble.innerHTML = `${rendered}${cursor}`;
    }

    if (!isStillStreaming) {
      renderMessagesList();
    }
  }

  function showInlineEditor(wrapper, msg) {
    const bubble = wrapper.querySelector('.message-bubble');
    const actionsBar = wrapper.querySelector('.message-actions-bar');
    if (!bubble) return;

    bubble.style.display = 'none';
    if (actionsBar) actionsBar.style.display = 'none';

    const editBox = document.createElement('div');
    editBox.className = 'inline-edit-box';
    editBox.innerHTML = `
      <textarea class="inline-edit-textarea">${escapeHtml(msg.content)}</textarea>
      <div class="inline-edit-actions">
        <button class="btn btn-secondary btn-sm cancel-edit-btn">Cancel</button>
        <button class="btn btn-primary btn-sm save-edit-btn">Save & Submit</button>
      </div>
    `;

    wrapper.appendChild(editBox);
    const textarea = editBox.querySelector('textarea');
    textarea.focus();

    editBox.querySelector('.cancel-edit-btn').onclick = () => {
      editBox.remove();
      bubble.style.display = 'block';
      if (actionsBar) actionsBar.style.display = 'flex';
    };

    editBox.querySelector('.save-edit-btn').onclick = async () => {
      const newText = textarea.value.trim();
      if (!newText) return;

      editBox.remove();
      await handleEditAndResubmit(msg.id, newText);
    };
  }

  async function handleEditAndResubmit(msgId, newText) {
    if (isStreaming()) return;
    const convId = currentConversation.id;
    const selectedModel = getSelectedModel();

    setStreamingState(true);

    const streamUrl = `/api/conversations/${convId}/messages/${msgId}`;
    await consumeSSEStream({
      url: streamUrl,
      method: 'PATCH',
      body: { content: newText, model: selectedModel },
      onStart: async () => {
        // Reload messages up to this point
        await loadConversationMessages(currentConversation);
      },
      onChunk: (accumulated) => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = accumulated;
          updateAssistantBubble(lastMsg.id, accumulated, true);
        }
      },
      onComplete: (fullText, finalData) => {
        setStreamingState(false);
        loadConversationMessages(currentConversation);
        reloadConversations(sidebarContainer);
      },
      onError: (err) => {
        setStreamingState(false);
        showToast(err.message || 'Edit stream error.', 'error');
      }
    });
  }

  async function handleRegenerate(msgId) {
    if (isStreaming()) return;
    const convId = currentConversation.id;
    setStreamingState(true);

    const streamUrl = `/api/conversations/${convId}/messages/${msgId}/regenerate`;
    await consumeSSEStream({
      url: streamUrl,
      method: 'POST',
      body: {},
      onStart: async () => {
        await loadConversationMessages(currentConversation);
      },
      onChunk: (accumulated) => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.content = accumulated;
          updateAssistantBubble(lastMsg.id, accumulated, true);
        }
      },
      onComplete: (fullText, finalData) => {
        setStreamingState(false);
        loadConversationMessages(currentConversation);
      },
      onError: (err) => {
        setStreamingState(false);
        showToast(err.message || 'Regeneration failed.', 'error');
      }
    });
  }

  function scrollToBottom() {
    if (scrollArea) {
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }

  async function loadConversationMessages(conv) {
    currentConversation = conv;
    if (chatTitleEl) {
      chatTitleEl.textContent = conv ? conv.title : 'New Conversation';
    }
    if (conv && conv.model) {
      setSelectedModel(conv.model, modelLabelEl, modelDropdownEl);
    }

    if (!conv) {
      messages = [];
      renderMessagesList();
      return;
    }

    try {
      messages = await api.get(`/api/conversations/${conv.id}/messages`);
      renderMessagesList();
      scrollToBottom();
    } catch (err) {
      showToast(`Failed to load messages: ${err.message}`, 'error');
    }
  }

  return {
    loadConversationMessages,
    handleNewChat: () => {
      currentConversation = null;
      loadConversationMessages(null);
    }
  };
}
