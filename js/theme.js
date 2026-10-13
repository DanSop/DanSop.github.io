// The initial theme is set inline in <head> (default.html) to avoid a flash.
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function updateToggle(button) {
  button.textContent = currentTheme() === 'dark' ? 'light' : 'dark';
}

document.addEventListener('DOMContentLoaded', function () {
  const button = document.getElementById('theme-toggle');
  if (!button) return;

  updateToggle(button);
  button.addEventListener('click', function () {
    const theme = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch (e) {}
    updateToggle(button);
    document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  });
});
