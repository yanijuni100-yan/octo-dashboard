export function applyTheme(name: string): void {
  if (name && name !== 'ungu') document.documentElement.setAttribute('data-theme', name)
  else document.documentElement.removeAttribute('data-theme')
  try {
    localStorage.setItem('octo_theme', name || 'ungu')
  } catch {
    /* abaikan */
  }
}

export function currentTheme(): string {
  try {
    return localStorage.getItem('octo_theme') || 'ungu'
  } catch {
    return 'ungu'
  }
}
