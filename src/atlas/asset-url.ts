/**
 * The one porting change the offline shell forces on the upstream viewer.
 *
 * Upstream is served from a web root, so `fetch('/models/atlas.json')` is
 * correct there. An INSTALLED cartridge is served from
 * `mnemo-plugin://app/<plugin-id>/index.html`, where a root-absolute path
 * resolves to `mnemo-plugin://app/models/atlas.json` — a URL whose first
 * segment matches no installed plugin id, so the host's protocol handler
 * returns 404 and the viewer reports "the anatomy catalogue could not be
 * loaded". Resolving against `document.baseURI` instead keeps the same two
 * call sites correct under BOTH the dev server (base `/`) and the installed
 * protocol (base `mnemo-plugin://app/<id>/`).
 *
 * Vite's `base: './'` only rewrites the URLs it can SEE at build time — these
 * two are built at runtime (one is a literal, one comes out of atlas.json), so
 * they are the ones that have to go through here.
 */
export function assetUrl(path: string): string {
  // A caller may already hand us an absolute URL (http:, blob:, data:). Leave
  // it alone rather than mangling it into the cartridge's own origin.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  return new URL(path.replace(/^\/+/, ''), document.baseURI).toString();
}
