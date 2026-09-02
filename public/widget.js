/**
 * Ashfield Dental support widget — embed script.
 *
 * Usage, anywhere in a page:
 *
 *   <script src="https://your-deployment.vercel.app/widget.js" defer></script>
 *
 * Optional attributes on that tag:
 *
 *   data-colour="#0f766e"    launcher and header colour
 *   data-position="left"     bottom-left instead of bottom-right
 *   data-label="Ask us"      accessible label for the launcher
 *
 * Everything lives inside a shadow root and an iframe. That matters more than it sounds: this
 * script runs on a stranger's website, and a clinic's own CSS — resets, global `button` rules,
 * a stray `* { box-sizing }` — would otherwise reshape the widget in ways neither of us can
 * test for. The shadow root keeps their styles out, and the iframe keeps ours in.
 */

(function () {
  'use strict';

  // Captured immediately: document.currentScript is only meaningful during initial execution,
  // and it is how the widget discovers which deployment to load the panel from.
  var script = document.currentScript;
  if (!script) return;

  var origin = new URL(script.src, window.location.href).origin;
  var colour = script.getAttribute('data-colour') || '#0f766e';
  var side = script.getAttribute('data-position') === 'left' ? 'left' : 'right';
  var label = script.getAttribute('data-label') || 'Chat with the practice';

  if (window.__ashfieldWidgetLoaded) return;
  window.__ashfieldWidgetLoaded = true;

  var MOBILE_BREAKPOINT = 480;

  function build() {
    var host = document.createElement('div');
    host.setAttribute('data-ashfield-widget', '');
    // A high z-index is unavoidable on someone else's page, but position:fixed on the host
    // rather than the children keeps the footprint to a single stacking context.
    host.style.cssText =
      'position:fixed;bottom:0;' + side + ':0;z-index:2147483000;width:0;height:0;';
    document.body.appendChild(host);

    var root = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = [
      ':host{all:initial}',
      '*{box-sizing:border-box;margin:0;padding:0}',
      '.launcher{position:fixed;bottom:20px;' + side + ':20px;width:56px;height:56px;',
      'border:0;border-radius:9999px;background:' + colour + ';color:#fff;cursor:pointer;',
      'box-shadow:0 10px 25px rgba(0,0,0,.18);display:flex;align-items:center;',
      'justify-content:center;transition:transform .15s ease}',
      '.launcher:hover{transform:scale(1.05)}',
      '.launcher:focus-visible{outline:3px solid rgba(15,118,110,.45);outline-offset:2px}',
      '.launcher svg{width:24px;height:24px;pointer-events:none}',
      '.panel{position:fixed;bottom:88px;' + side + ':20px;width:400px;height:640px;',
      'max-height:calc(100vh - 120px);border:0;border-radius:16px;background:#fff;',
      'box-shadow:0 20px 50px rgba(0,0,0,.22);overflow:hidden;display:none}',
      '.panel.open{display:block}',
      '@media (max-width:' + MOBILE_BREAKPOINT + 'px){',
      // On a phone a floating card wastes the screen and puts the input under the keyboard.
      '.panel{inset:0;width:100vw;height:100dvh;max-height:none;border-radius:0}',
      '.launcher.hidden{display:none}}',
    ].join('');

    var launcher = document.createElement('button');
    launcher.className = 'launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-label', label);
    launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"' +
      ' stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var panel = document.createElement('iframe');
    panel.className = 'panel';
    panel.title = 'Chat with the practice';
    // The iframe is created without a src so the page costs nothing until someone opens it.
    // A visitor who never clicks never loads the widget app at all.
    panel.setAttribute('loading', 'lazy');

    var open = false;

    function toggle() {
      open = !open;
      if (open && !panel.src) panel.src = origin + '/embed';
      panel.classList.toggle('open', open);
      launcher.setAttribute('aria-expanded', String(open));
      launcher.classList.toggle('hidden', open && window.innerWidth <= MOBILE_BREAKPOINT);
      if (open) {
        // Focus the panel so keyboard users land inside it rather than back on the page.
        window.setTimeout(function () {
          panel.focus();
        }, 50);
      }
    }

    launcher.addEventListener('click', toggle);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && open) {
        toggle();
        launcher.focus();
      }
    });

    root.appendChild(style);
    root.appendChild(launcher);
    root.appendChild(panel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
