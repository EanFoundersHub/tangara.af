/*
  Acceso oculto al Monitor Tángara
  - Escribe: tangara
  - O usa: Ctrl + Alt + T
  - Cierra con Escape o con el botón ×
*/
(() => {
  'use strict';

  const SECRET_SEQUENCE = 'tangara';
  const DASHBOARD_URL = 'monitor-tangara/index.html';
  const OVERLAY_ID = 'tangara-private-overlay';
  let buffer = '';
  let resetTimer = null;

  function isTypingField(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
    );
  }

  function createOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Monitor privado Tángara');
    overlay.innerHTML = `
      <style>
        #${OVERLAY_ID} {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: none;
          background: #0e0913;
        }
        #${OVERLAY_ID}.is-open { display: block; }
        #${OVERLAY_ID} iframe {
          width: 100%;
          height: 100%;
          border: 0;
          background: #0e0913;
        }
        #${OVERLAY_ID} .tangara-private-close {
          position: fixed;
          top: 12px;
          right: 14px;
          z-index: 2;
          width: 42px;
          height: 42px;
          border: 1px solid rgba(255,255,255,.22);
          border-radius: 999px;
          background: rgba(14,9,19,.78);
          color: #fff;
          font: 600 25px/1 system-ui, sans-serif;
          cursor: pointer;
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 30px rgba(0,0,0,.28);
        }
        #${OVERLAY_ID} .tangara-private-close:hover,
        #${OVERLAY_ID} .tangara-private-close:focus-visible {
          background: rgba(238,70,221,.92);
          outline: 2px solid #fff;
          outline-offset: 2px;
        }
      </style>
      <button class="tangara-private-close" type="button" aria-label="Cerrar monitor">×</button>
      <iframe title="Monitor de convocatoria Tángara" loading="eager"></iframe>
    `;

    overlay.querySelector('.tangara-private-close').addEventListener('click', closeOverlay);
    document.body.appendChild(overlay);
    return overlay;
  }

  function openOverlay() {
    const overlay = createOverlay();
    const iframe = overlay.querySelector('iframe');
    if (!iframe.src) iframe.src = DASHBOARD_URL;
    overlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    overlay.querySelector('.tangara-private-close').focus();
  }

  function closeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.documentElement.style.overflow = '';
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeOverlay();
      return;
    }

    if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 't') {
      event.preventDefault();
      openOverlay();
      return;
    }

    if (isTypingField(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;

    buffer = (buffer + event.key.toLowerCase()).slice(-SECRET_SEQUENCE.length);
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { buffer = ''; }, 2500);

    if (buffer === SECRET_SEQUENCE) {
      buffer = '';
      openOverlay();
    }
  });
})();
