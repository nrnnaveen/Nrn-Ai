import { api } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // Check if session expired banner should be shown
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('expired')) {
    const banner = document.getElementById('auth-banner');
    if (banner) {
      banner.className = 'auth-banner error';
      banner.textContent = 'Your session has expired. Please log in again.';
      banner.style.display = 'block';
    }
  }

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    initLoginForm(loginForm);
  }

  if (registerForm) {
    initRegisterForm(registerForm);
  }
});

function showErrorBanner(message) {
  const banner = document.getElementById('auth-banner');
  if (banner) {
    banner.className = 'auth-banner error';
    banner.textContent = message;
    banner.style.display = 'block';
  }
}

function clearErrorBanner() {
  const banner = document.getElementById('auth-banner');
  if (banner) {
    banner.style.display = 'none';
    banner.textContent = '';
  }
}

function initLoginForm(form) {
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrorBanner();

    const loginInput = form.querySelector('#login');
    const passwordInput = form.querySelector('#password');

    const login = loginInput.value.trim();
    const password = passwordInput.value;

    if (!login) {
      showErrorBanner('Please enter your email or username.');
      loginInput.focus();
      return;
    }

    if (!password) {
      showErrorBanner('Please enter your password.');
      passwordInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    try {
      await api.post('/api/auth/login', { login, password });
      window.location.href = '/app';
    } catch (err) {
      showErrorBanner(err.message || 'Incorrect email or password.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login';
    }
  });
}

function initRegisterForm(form) {
  const submitBtn = form.querySelector('button[type="submit"]');
  const usernameInput = form.querySelector('#username');
  const emailInput = form.querySelector('#email');
  const passwordInput = form.querySelector('#password');
  const confirmPasswordInput = form.querySelector('#confirm_password');

  // Password requirements items
  const reqLength = document.getElementById('req-length');
  const reqLetter = document.getElementById('req-letter');
  const reqNumber = document.getElementById('req-number');
  const reqMatch = document.getElementById('req-match');

  function validateLivePassword() {
    const pwd = passwordInput.value;
    const confirm = confirmPasswordInput ? confirmPasswordInput.value : '';

    const hasLength = pwd.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(pwd);
    const hasNumberOrSpec = /[\d!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pwd);
    const hasMatch = pwd.length > 0 && pwd === confirm;

    if (reqLength) reqLength.classList.toggle('met', hasLength);
    if (reqLetter) reqLetter.classList.toggle('met', hasLetter);
    if (reqNumber) reqNumber.classList.toggle('met', hasNumberOrSpec);
    if (reqMatch) reqMatch.classList.toggle('met', hasMatch);

    return hasLength && hasLetter && hasNumberOrSpec && (!confirmPasswordInput || hasMatch);
  }

  passwordInput.addEventListener('input', validateLivePassword);
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', validateLivePassword);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrorBanner();

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

    if (!username || username.length < 3) {
      showErrorBanner('Username must be at least 3 characters.');
      usernameInput.focus();
      return;
    }

    if (!email || !email.includes('@')) {
      showErrorBanner('Please enter a valid email address.');
      emailInput.focus();
      return;
    }

    if (!validateLivePassword()) {
      showErrorBanner('Please ensure your password meets all requirements.');
      passwordInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      await api.post('/api/auth/register', { username, email, password });
      window.location.href = '/app';
    } catch (err) {
      showErrorBanner(err.message || 'Failed to create account.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create account';
    }
  });
}
