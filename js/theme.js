const root = document.documentElement;
const toggle = document.getElementById('theme-toggle');

const isDark = () => root.dataset.theme === 'dark';

function render() {
  toggle.textContent = isDark() ? 'light' : 'dark';
  toggle.setAttribute('aria-pressed', isDark());
}

toggle.addEventListener('click', () => {
  const theme = isDark() ? 'light' : 'dark';
  root.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {}
  render();
  document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
});

render();
