// Robust clipboard copy.
//
// navigator.clipboard.writeText is only available in secure contexts and can
// still REJECT at runtime (document not focused, in-app/WebView browsers,
// permission policy). The old code called it without awaiting or catching, then
// always showed "Copied!" — so a silent failure looked like success and nothing
// reached the clipboard. This helper awaits the API, falls back to a hidden
// textarea + execCommand('copy') for browsers/contexts where the API fails, and
// returns a real boolean so callers only claim success when it actually copied.
export async function copyToClipboard(text) {
  const value = String(text ?? '');
  if (!value) return false;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // fall through to legacy path
    }
  }

  // Legacy fallback — works in non-secure contexts and many in-app browsers.
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
