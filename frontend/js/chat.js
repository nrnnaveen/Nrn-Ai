// ==========================================================================
// NRN AI — CHAT CONTROLLER & GPT-STYLE ACTIONS
// Linear / Claude / Notion / Apple Restrained Design Language
// ==========================================================================

import { api } from './api.js';
import { renderMarkdown } from './markdown.js';
import { consumeSSEStream, cancelStreaming, isStreaming } from './streaming.js';
import { getSelectedModel, setSelectedModel } from './model_picker.js';
import { getPendingAttachmentIds, clearPendingAttachments } from './upload.js';
import { showToast, icons, formatTime, escapeHtml } from './ui.js';
import { setActiveConversationId, reloadConversations } from './sidebar.js';

let messages = [];
let currentConversation = null;
let messageFeedbackState = {}; // { [msgId]: 'like' | 'dislike' }

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

  // Enter to send (respecting setting)
  composerTextarea.addEventListener('keydown', (e) => {
    const enterToSend = localStorage.getItem('nrn_enter_to_send') !== 'false';
    if (enterToSend) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    } else {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSendMessage();
      }
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
      showToast('Generation stopped.');
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

  async function handleSendMessage(customText = null) {
    const text = (customText !== null ? customText : composerTextarea.value).trim();
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

    // Render optimistic user message (this clears the empty welcome state)
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
        conditionalScrollToBottom();
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
      renderEmptyState();
      return;
    }

    messages.forEach((msg, idx) => {
      const isLastAi = msg.role === 'assistant' && idx === messages.length - 1;
      const el = createMessageElement(msg, isLastAi);
      messagesContainer.appendChild(el);
    });
  }

  function renderEmptyState() {
    messagesContainer.innerHTML = `
      <div class="chat-empty-state">
        <h1 class="empty-title">How can I help you today?</h1>
        <p class="empty-subtitle">Select a suggested prompt below or type your message to get started.</p>
        
        <div class="empty-suggestions-grid">
          <div class="suggestion-card" data-prompt="Help me brainstorm innovative product features for a modern web app">
            <div class="suggestion-card-title">💡 Brainstorm ideas</div>
            <div class="suggestion-card-desc">Generate creative feature ideas and architectural concepts</div>
          </div>
          
          <div class="suggestion-card" data-prompt="Write a Python script to parse and analyze structured JSON data efficiently">
            <div class="suggestion-card-title">⚡ Code & debug</div>
            <div class="suggestion-card-desc">Write, optimize, or review clean code and scripts</div>
          </div>

          <div class="suggestion-card" data-prompt="Summarize the core architectural benefits of Server-Sent Events vs WebSockets">
            <div class="suggestion-card-title">📝 Summarize concepts</div>
            <div class="suggestion-card-desc">Condense complex technical topics into clear takeaways</div>
          </div>

          <div class="suggestion-card" data-prompt="Explain how modern neural network reasoning and attention mechanisms work">
            <div class="suggestion-card-title">🔍 Explain technology</div>
            <div class="suggestion-card-desc">Break down challenging technical mechanisms simply</div>
          </div>
        </div>
      </div>
    `;

    // Bind suggestion clicks & touches
    messagesContainer.querySelectorAll('.suggestion-card').forEach((card) => {
      card.addEventListener('click', () => {
        const promptText = card.getAttribute('data-prompt');
        composerTextarea.value = promptText;
        composerTextarea.focus();
        composerTextarea.style.height = 'auto';
        composerTextarea.style.height = Math.min(composerTextarea.scrollHeight, 180) + 'px';
      });
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
    const avatarLetter = msg.role === 'user' ? 'U' : 'N';

    if (msg.role === 'user') {
      wrapper.innerHTML = `
        <div class="message-header">
          <span class="message-sender">
            <span class="message-avatar-badge">${avatarLetter}</span>
            <span>${senderName}</span>
          </span>
          <span>${timeStr}</span>
        </div>
        ${attachmentsHtml}
        <div class="message-bubble">${escapeHtml(msg.content)}</div>
        <div class="message-actions-bar">
          <button class="action-btn-pill copy-user-btn" title="Copy text">
            ${icons.copy} <span>Copy</span>
          </button>
          <button class="action-btn-pill edit-msg-btn" data-id="${msg.id}" title="Edit prompt">
            ${icons.edit} <span>Edit</span>
          </button>
        </div>
      `;

      // Copy user prompt
      wrapper.querySelector('.copy-user-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(msg.content);
        showToast('Prompt copied to clipboard.', 'success');
      });

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
      const feedback = messageFeedbackState[msg.id] || null;

      wrapper.innerHTML = `
        <div class="message-header">
          <span class="message-sender">
            <span class="message-avatar-badge" style="color:var(--color-accent);">AI</span>
            <span>${senderName}</span>
          </span>
          <span>${timeStr}</span>
        </div>
        <div class="message-bubble markdown-body">${renderedBody}${cursorHtml}</div>
        <div class="message-actions-bar">
          <button class="action-btn-pill copy-ai-btn" title="Copy response">
            ${icons.copy} <span>Copy</span>
          </button>
          <button class="action-btn-pill like-btn ${feedback === 'like' ? 'active' : ''}" title="Good response">
            ${icons.thumbsUp}
          </button>
          <button class="action-btn-pill dislike-btn ${feedback === 'dislike' ? 'active' : ''}" title="Bad response">
            ${icons.thumbsDown}
          </button>
          <button class="action-btn-pill share-btn" title="Share response">
            ${icons.share} <span>Share</span>
          </button>
          ${isLastAi && !msg.isStreaming ? `
            <button class="action-btn-pill regenerate-btn" data-id="${msg.id}" title="Regenerate answer">
              ${icons.refresh} <span>Regenerate</span>
            </button>
          ` : ''}
        </div>
      `;

      // Copy assistant response
      const copyBtn = wrapper.querySelector('.copy-ai-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(msg.content);
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = `${icons.check} <span>Copied!</span>`;
        showToast('Response copied to clipboard.', 'success');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = `${icons.copy} <span>Copy</span>`;
        }, 2000);
      });

      // Like feedback
      const likeBtn = wrapper.querySelector('.like-btn');
      likeBtn.addEventListener('click', () => {
        const isLiked = messageFeedbackState[msg.id] === 'like';
        messageFeedbackState[msg.id] = isLiked ? null : 'like';
        likeBtn.classList.toggle('active', !isLiked);
        wrapper.querySelector('.dislike-btn').classList.remove('active');
        if (!isLiked) showToast('Thanks for your feedback!', 'success');
      });

      // Dislike feedback
      const dislikeBtn = wrapper.querySelector('.dislike-btn');
      dislikeBtn.addEventListener('click', () => {
        const isDisliked = messageFeedbackState[msg.id] === 'dislike';
        messageFeedbackState[msg.id] = isDisliked ? null : 'dislike';
        dislikeBtn.classList.toggle('active', !isDisliked);
        wrapper.querySelector('.like-btn').classList.remove('active');
        if (!isDisliked) showToast('Feedback recorded.', 'info');
      });

      // Share button
      const shareBtn = wrapper.querySelector('.share-btn');
      shareBtn.addEventListener('click', () => {
        if (navigator.share) {
          navigator.share({ title: 'NRN AI Response', text: msg.content }).catch(() => {});
        } else {
          navigator.clipboard.writeText(msg.content);
          showToast('Response copied for sharing.', 'success');
        }
      });

      // Regenerate button
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

  function conditionalScrollToBottom() {
    const autoScroll = localStorage.getItem('nrn_auto_scroll') !== 'false';
    if (autoScroll && scrollArea) {
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

  // Render initial empty welcome screen right away
  loadConversationMessages(null);

  return {
    loadConversationMessages,
    handleNewChat: () => {
      currentConversation = null;
      loadConversationMessages(null);
    }
  };
}
