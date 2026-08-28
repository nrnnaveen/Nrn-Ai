// ==========================================================================
// NRN AI — ADVANCED THEME & PREFERENCES MANAGER
// Supports Light, Dark, System Theme, Density, and Reduced Motion
// ==========================================================================

const THEME_STORAGE_KEY = 'nrn_theme_preference';
const DENSITY_STORAGE_KEY = 'nrn_density_preference';
const MOTION_STORAGE_KEY = 'nrn_motion_preference';

let currentTheme = 'system';
let currentDensity = 'comfortable';
let reduceMotion = false;

export function initThemeSystem() {
  currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'system';
  currentDensity = localStorage.getItem(DENSITY_STORAGE_KEY) || 'comfortable';
  reduceMotion = localStorage.getItem(MOTION_STORAGE_KEY) === 'true';

  applyTheme(currentTheme);
  applyDensity(currentDensity);
  applyMotionPreference(reduceMotion);

  // Listen to OS system color scheme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  });

  // Listen to OS reduced motion changes
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    if (localStorage.getItem(MOTION_STORAGE_KEY) === null) {
      applyMotionPreference(e.matches);
    }
  });
}

export function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  const root = document.documentElement;

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    root.removeAttribute('data-theme-setting');
  } else {
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-setting', theme);
  }

  // Update any active theme switcher buttons
  document.querySelectorAll('[data-theme-switch]').forEach((btn) => {
    const btnTheme = btn.getAttribute('data-theme-switch');
    btn.classList.toggle('active', btnTheme === theme);
  });
}

export function getTheme() {
  return currentTheme;
}

export function applyDensity(density) {
  currentDensity = density;
  localStorage.setItem(DENSITY_STORAGE_KEY, density);
  document.documentElement.setAttribute('data-density', density);
  
  document.querySelectorAll('[data-density-switch]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-density-switch') === density);
  });
}

export function getDensity() {
  return currentDensity;
}

export function applyMotionPreference(reduced) {
  reduceMotion = reduced;
  localStorage.setItem(MOTION_STORAGE_KEY, String(reduced));
  document.documentElement.setAttribute('data-reduce-motion', String(reduced));
}

export function getMotionPreference() {
  return reduceMotion;
}
