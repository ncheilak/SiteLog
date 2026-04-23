// =============================================================================
// SiteLog v3.0 — shared/auth.js
// Κοινή βιβλιοθήκη authentication για όλες τις σελίδες.
// Φορτώνεται μετά το Supabase CDN script.
// Εκθέτει: window.sb (client) + window.Auth (utilities)
// =============================================================================

(function () {
  'use strict';

  // ── CREDENTIALS ─────────────────────────────────────────────────────────────
  const SUPABASE_URL = 'https://ikmwxsfaopjkgajebyyf.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mob3KRMf905pSPlm-ASBwQ_Fzh5X3Ax';

  // ── SUPABASE CLIENT ──────────────────────────────────────────────────────────
  // Εκτίθεται ως window.sb για χρήση από όλα τα HTML αρχεία
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.sb = sb;

  // ── CACHE ────────────────────────────────────────────────────────────────────
  // Αποθηκεύουμε profile + assignments για να μην κάνουμε επαναλαμβανόμενα queries
  let _profile   = null;  // { id, email, full_name, role, is_active, ... }
  let _sites     = null;  // [{ id, name, project_code }, ...]
  let _initiated = false;

  // ── HELPER: BASE PATH ────────────────────────────────────────────────────────
  // Βρίσκει το base directory της τρέχουσας σελίδας (για redirects)
  function _basePath() {
    const parts = window.location.pathname.split('/');
    parts.pop(); // αφαίρεση filename
    return parts.join('/') + '/';
  }

  function _redirectTo(filename) {
    window.location.href = _basePath() + filename;
  }

  // ── initAuth ─────────────────────────────────────────────────────────────────
  // Φορτώνει profile + assignments στο cache.
  // Πρέπει να κληθεί (await) σε κάθε protected σελίδα.
  // Επιστρέφει { user, profile, sites } ή null αν δεν είναι logged in.
  async function initAuth() {
    if (_initiated) return { profile: _profile, sites: _sites };

    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;

    // Φόρτωση profile
    const { data: profile, error: pErr } = await sb
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (pErr || !profile || !profile.is_active) return null;

    _profile = profile;

    // Φόρτωση assigned sites (όχι για admin — βλέπει όλα μέσω RLS)
    if (profile.role === 'admin') {
      const { data: allSites } = await sb
        .from('sites')
        .select('id, name, project_code')
        .eq('is_active', true)
        .order('project_code');
      _sites = allSites || [];
    } else {
      const { data: assignments } = await sb
        .from('user_site_assignments')
        .select('sites(id, name, project_code)')
        .eq('user_id', session.user.id);
      _sites = (assignments || [])
        .map(a => a.sites)
        .filter(Boolean);
    }

    _initiated = true;
    return { profile: _profile, sites: _sites };
  }

  // ── _showAuthFallback ─────────────────────────────────────────────────────────
  // Εμφανίζει fallback μήνυμα αντί για κενή σελίδα κατά τη διάρκεια redirect.
  function _showAuthFallback(msg, linkHref, linkLabel) {
    document.body.style.cssText = 'margin:0;background:#0c0c0c;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:IBM Plex Sans,sans-serif;';
    document.body.innerHTML = `
      <div style="text-align:center;color:#666;padding:40px;">
        <div style="font-family:\'Bebas Neue\',sans-serif;font-size:2rem;color:#f5c800;letter-spacing:2px;margin-bottom:12px;">Site<em style="font-style:normal;">Log</em></div>
        <div style="font-size:0.85rem;margin-bottom:20px;">${msg}</div>
        <a href="${linkHref}" style="color:#f5c800;font-size:0.8rem;text-decoration:none;border-bottom:1px solid #f5c800;padding-bottom:2px;">${linkLabel}</a>
      </div>`;
  }

  // ── requireLogin ─────────────────────────────────────────────────────────────
  // Αν δεν υπάρχει session → fallback + redirect στο login.html
  // Χρησιμοποιείται στην αρχή κάθε protected σελίδας.
  async function requireLogin() {
    const result = await initAuth();
    if (!result) {
      _showAuthFallback('Απαιτείται σύνδεση.', 'login.html', '→ Σύνδεση');
      setTimeout(() => _redirectTo('login.html'), 1500);
      return false;
    }
    return true;
  }

  // ── requireRole ──────────────────────────────────────────────────────────────
  // Αν ο ρόλος δεν είναι στη λίστα → fallback + redirect στο index.html
  // π.χ. requireRole(['admin', 'site_manager'])
  async function requireRole(allowedRoles) {
    const ok = await requireLogin();
    if (!ok) return false;
    if (!allowedRoles.includes(_profile.role)) {
      _showAuthFallback('Δεν έχετε πρόσβαση σε αυτή τη σελίδα.', 'index.html', '← Αρχική');
      setTimeout(() => _redirectTo('index.html'), 1500);
      return false;
    }
    return true;
  }

  // ── getCurrentUser ────────────────────────────────────────────────────────────
  function getCurrentUser() {
    if (!_profile) return null;
    return {
      id:        _profile.id,
      email:     _profile.email,
      full_name: _profile.full_name,
    };
  }

  // ── getCurrentRole ────────────────────────────────────────────────────────────
  function getCurrentRole() {
    return _profile ? _profile.role : null;
  }

  // ── getAssignedSites ──────────────────────────────────────────────────────────
  function getAssignedSites() {
    return _sites || [];
  }

  // ── isAdmin ───────────────────────────────────────────────────────────────────
  function isAdmin() {
    return _profile ? _profile.role === 'admin' : false;
  }

  // ── canDeleteAttendance ───────────────────────────────────────────────────────
  // admin: πάντα
  // site_manager: μόνο σήμερα + δικό του site
  function canDeleteAttendance(siteId, logDate) {
    if (!_profile) return false;
    if (_profile.role === 'admin') return true;
    if (_profile.role === 'site_manager') {
      const today = new Date().toISOString().split('T')[0];
      const myIds = (_sites || []).map(s => s.id);
      return logDate === today && myIds.includes(siteId);
    }
    return false;
  }

  // ── signOut ───────────────────────────────────────────────────────────────────
  async function signOut() {
    await sb.auth.signOut();
    _profile   = null;
    _sites     = null;
    _initiated = false;
    _redirectTo('login.html');
  }

  // ── ROLE LABELS (για UI) ──────────────────────────────────────────────────────
  const ROLE_LABELS = {
    admin:           'Διαχειριστής',
    project_manager: 'Project Manager',
    site_manager:    'Site Manager',
    scanner:         'Scanner',
  };

  function getRoleLabel() {
    return _profile ? (ROLE_LABELS[_profile.role] || _profile.role) : '';
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────────
  window.Auth = {
    initAuth,
    requireLogin,
    requireRole,
    getCurrentUser,
    getCurrentRole,
    getAssignedSites,
    isAdmin,
    canDeleteAttendance,
    getRoleLabel,
    signOut,
  };

})();
