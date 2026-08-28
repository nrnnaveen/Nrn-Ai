// ==========================================================================
// NRN AI — AUTH CONTROLLER
// ==========================================================================

import { api } from './api.js';
import { initThemeSystem } from './theme.js';
import { icons } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  initThemeSystem();

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const banner = document.getElementById('auth-banner');
  const togglePassBtn = document.getElementById('toggle-password-btn');
  const passwordInput = document.getElementById('password');
  const strengthFill = document.getElementById('strength-fill');

  // Password visibility toggle
  if (togglePassBtn && passwordInput) {
    togglePassBtn.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      togglePassBtn.innerHTML = isPassword ? icons.eyeOff : icons.eye;
    });
  }

  // Password strength meter on register
  if (passwordInput && strengthFill) {
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      let score = 0;
      if (val.length >= 8) score++;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
      if (/\d/.test(val) && /[^A-Za-z0-9]/.test(val)) score++;

      strengthFill.className = 'password-strength-fill';
      if (val.length > 0) {
        if (score === 1) strengthFill.classList.add('weak');
        else if (score === 2) strengthFill.classList.add('medium');
        else if (score >= 3) strengthFill.classList.add('strong');
      }
    });
  }

  function showError(msg) {
    if (!banner) return;
    banner.textContent = msg;
    banner.classList.add('visible');
  }

  function clearError() {
    if (!banner) return;
    banner.textContent = '';
    banner.classList.remove('visible');
  }

  function setButtonLoading(btn, loading, defaultText) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.innerHTML = `<div class="btn-spinner"></div> <span>Processing...</span>`;
    } else {
      btn.innerHTML = `<span>${defaultText}</span>`;
    }
  }

  // Check URL query parameters (e.g. ?expired=1)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('expired') === '1') {
    showError('Your session has expired. Please sign in again.');
  }

  // Handle Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();

      const submitBtn = document.getElementById('login-submit-btn');
      const login = loginForm.login.value.trim();
      const password = loginForm.password.value;

      if (!login || !password) {
        showError('Please enter both your login and password.');
        return;
      }

      setButtonLoading(submitBtn, true, 'Sign In');

      try {
        await api.post('/api/auth/login', { login, password });
        window.location.href = '/app';
      } catch (err) {
        setButtonLoading(submitBtn, false, 'Sign In');
        showError(err.message || 'Invalid credentials. Please try again.');
      }
    });
  }

  // Handle Register
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();

      const submitBtn = document.getElementById('register-submit-btn');
      const username = registerForm.username.value.trim();
      const email = registerForm.email.value.trim();
      const password = registerForm.password.value;

      if (!username || !email || !password) {
        showError('All fields are required.');
        return;
      }

      setButtonLoading(submitBtn, true, 'Create Account');

      try {
        await api.post('/api/auth/register', { username, email, password });
        window.location.href = '/app';
      } catch (err) {
        setButtonLoading(submitBtn, false, 'Create Account');
        showError(err.message || 'Registration failed. Please check your details.');
      }
    });
  }
});
