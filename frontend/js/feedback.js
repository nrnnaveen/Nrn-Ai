import { api } from './api.js';
import { showToast, icons, escapeHtml } from './ui.js';

export function initFeedbackModal(triggerBtn) {
  let modalBackdrop = document.getElementById('feedback-modal-backdrop');

  if (!modalBackdrop) {
    modalBackdrop = document.createElement('div');
    modalBackdrop.id = 'feedback-modal-backdrop';
    modalBackdrop.className = 'modal-backdrop';
    document.body.appendChild(modalBackdrop);
  }

  const renderModal = () => {
    modalBackdrop.innerHTML = `
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div class="modal-header">
          <h3 id="feedback-title" class="modal-title">Send Feedback</h3>
          <button class="btn-icon feedback-close-btn" aria-label="Close">${icons.close}</button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 8px;">Help us improve NRN AI. Your feedback is recorded directly into the project log.</p>
          <textarea id="feedback-textarea" class="form-input" style="height: 100px; padding: 8px; resize: vertical;" placeholder="What's on your mind?"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary feedback-cancel-btn">Cancel</button>
          <button class="btn btn-primary feedback-submit-btn">Submit Feedback</button>
        </div>
      </div>
    `;

    const close = () => modalBackdrop.classList.remove('open');

    modalBackdrop.querySelector('.feedback-close-btn').onclick = close;
    modalBackdrop.querySelector('.feedback-cancel-btn').onclick = close;
    
    const submitBtn = modalBackdrop.querySelector('.feedback-submit-btn');
    const textarea = modalBackdrop.querySelector('#feedback-textarea');

    submitBtn.onclick = async () => {
      const text = textarea.value.trim();
      if (!text) {
        showToast('Please enter your feedback before submitting.', 'error');
        textarea.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      try {
        await api.post('/api/feedback', { feedback: text });
        close();
        showToast('Thank you! Your feedback has been recorded.', 'success');
      } catch (err) {
        showToast(`Failed to submit feedback: ${err.message}`, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Feedback';
      }
    };
  };

  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => {
      renderModal();
      modalBackdrop.classList.add('open');
      const ta = modalBackdrop.querySelector('#feedback-textarea');
      if (ta) ta.focus();
    });
  }
}
