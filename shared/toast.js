// =============================================================================
// SiteLog — shared/toast.js
// Centralized toast notifications. Replaces per-page implementations.
//
// API:
//   showToast('Αποθηκεύτηκε!')          → success (πράσινο)
//   showToast('Σφάλμα!', 'error')       → error   (κόκκινο)
//   showToast('Προσοχή!', 'warning')    → warning  (πορτοκαλί)
//   showToast('Πληροφορία', 'info')     → info     (μπλε)
//
// Backward compat (παλιά signatures):
//   showToast('msg', true)              → error
//   showToast('msg', '#e8600a')         → inline color (legacy)
// =============================================================================

(function () {
  'use strict';

  function getToastEl() {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    return t;
  }

  window.showToast = function (msg, typeOrColor) {
    const t = getToastEl();
    t.textContent = msg;

    const TYPES = ['success', 'error', 'warning', 'info'];
    let type = 'success';
    let inlineColor = null;

    if (typeOrColor === true) {
      type = 'error';
    } else if (typeof typeOrColor === 'string') {
      if (TYPES.includes(typeOrColor)) {
        type = typeOrColor;
      } else if (typeOrColor.startsWith('#') || typeOrColor.startsWith('rgb')) {
        inlineColor = typeOrColor; // legacy hex color
      }
    }

    t.className = 'toast show' + (inlineColor ? '' : ' toast-' + type);
    t.style.background = inlineColor || '';

    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.classList.remove('show');
      t.style.background = '';
    }, 3000);
  };

})();
