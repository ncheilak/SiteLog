(function () {
  'use strict';

  const DB_NAME = 'SiteLogOfflineQueue';
  const STORE_NAME = 'pendingActions';
  let db = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) {
          d.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = (e) => { db = e.target.result; resolve(db); };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async function addToQueue(table, payload) {
    const dbase = await openDB();
    const tx = dbase.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.add({ table, payload, timestamp: Date.now() });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function addCompound(payload) {
    return addToQueue('__compound__', payload);
  }

  async function getAllPending() {
    const dbase = await openDB();
    const tx = dbase.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function deletePending(id) {
    const dbase = await openDB();
    const tx = dbase.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function syncAll() {
    if (!navigator.onLine) return;
    const pending = await getAllPending();
    if (pending.length === 0) return;

    const dbSupabase = window.sb;

    for (const item of pending) {
      try {
        if (item.table === '__compound__' && item.payload?.type === 'adhoc_checkin') {
          const { adhocData, logData } = item.payload;
          let newId;
          const { data: existing } = await dbSupabase
            .from('adhoc_workers')
            .select('id')
            .like('id', 'AH-%')
            .order('id', { ascending: false })
            .limit(1);
          if (!existing || existing.length === 0) {
            newId = 'AH-1001';
          } else {
            const lastNum = parseInt(existing[0].id.replace('AH-', ''), 10);
            newId = 'AH-' + (isNaN(lastNum) ? 1001 : lastNum + 1);
          }
          const { error: adhocErr } = await dbSupabase.from('adhoc_workers').insert({ id: newId, ...adhocData });
          if (adhocErr) { console.warn('[Sync] Adhoc insert failed:', adhocErr); break; }
          const { error: logErr } = await dbSupabase.from('attendance_log').insert({ adhoc_worker_id: newId, ...logData });
          if (logErr) { console.warn('[Sync] Log insert failed:', logErr); break; }
        } else {
          const action = item.payload?.action || 'insert';
          const table = item.table;
          const data = item.payload?.data || item.payload;

          if (action === 'update' && item.payload?.id) {
            const { error } = await dbSupabase.from(table).update(data).eq('id', item.payload.id);
            if (error) { console.warn('[Sync] Update failed for', table, error); break; }
          } else {
            const { error } = await dbSupabase.from(table).insert(data);
            if (error) { console.warn('[Sync] Insert failed for', table, error); break; }
          }
        }
        await deletePending(item.id);
      } catch (err) {
        console.error('[Sync] Unexpected error:', err);
        break;
      }
    }
    updateSyncIndicator();
  }

  function updateSyncIndicator() {
    const el = document.getElementById('syncIndicator');
    if (!el) return;
    getAllPending().then(pending => {
      if (pending.length === 0) {
        el.textContent = '✓ Συγχρονισμένο';
        el.style.color = 'var(--green)';
      } else {
        el.textContent = `⏳ ${pending.length} εκκρεμείς εγγραφές`;
        el.style.color = 'var(--orange)';
      }
    });
  }

  window.addEventListener('online', () => {
    console.log('[OfflineSync] Σύνδεση αποκαταστάθηκε – συγχρονισμός…');
    syncAll();
  });

  window.OfflineSync = {
    addToQueue,
    addCompound,
    syncAll,
    getAllPending,
    updateSyncIndicator
  };
})();