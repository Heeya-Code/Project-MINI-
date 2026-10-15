// "Every reload opens the public home page."
//
// A full page load — refresh, new tab, a typed or shared URL — is a FRESH APPLICATION ENTRY. Before React and the
// router start we rewrite the address to "/" so the router mounts on the public home page. In-app navigation never
// reloads the document, so it never goes through here and is left completely alone.
//
// Nothing about authentication changes: protected pages are still guarded by the server session and by the
// RoleRoute / AppLayout guards; this only decides where the app STARTS. A user whose session cookie is still valid
// simply sees an "Open your dashboard" button on the home page.
export function normalizeEntryUrl(win = window) {
  const { pathname } = win.location
  if (pathname === '/') return false
  win.history.replaceState(null, '', '/')
  return true
}
