// Applies the saved theme before first paint (external file so the strict CSP allows it).
try {
  var t = localStorage.getItem('classpulse_theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = t;
} catch (e) {}
