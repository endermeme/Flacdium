// js/flacdium-sync.js
// Syncs the user's library (favorites, playlists, history, folders) to the Flacdium server
// so it follows the account across browsers/devices. Server is the source of truth: on boot
// we pull a single snapshot into IndexedDB, and after any write we push the snapshot back
// (debounced, last-write-wins). Per-device prefs (settings, pinned) stay local.

import { db } from './db.js';
import { flacdiumBase, getToken } from './flacdium-api.js';

const COLLECTION_URL = () => flacdiumBase() + '/api/userdata/library';
const PUSH_DEBOUNCE_MS = 1500;

let syncReady = false; // becomes true only after the initial pull, so we never overwrite
let pushTimer = null; //  the server with empty data before loading it.

async function pullSnapshot() {
    const token = getToken();
    if (!token) return false;
    const res = await fetch(COLLECTION_URL(), { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error('userdata GET ' + res.status);
    const body = await res.json();
    if (body && body.data) {
        await db.importData(body.data, true); // clear=true → server snapshot replaces local
        return true;
    }
    return false;
}

async function pushSnapshot() {
    if (!syncReady) return;
    const token = getToken();
    if (!token) return;
    try {
        const data = await db.exportData();
        await fetch(COLLECTION_URL(), {
            method: 'PUT',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    } catch (e) {
        console.warn('Flacdium sync push failed:', e);
    }
}

function schedulePush() {
    if (!syncReady) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushSnapshot, PUSH_DEBOUNCE_MS);
}

// Pull the server snapshot into IndexedDB. Must be awaited before the UI reads library data.
export async function initLibrarySync() {
    try {
        await pullSnapshot();
    } catch (e) {
        console.warn('Flacdium sync pull failed (using local data):', e);
    }
    syncReady = true;
    // Any synced write (favorites/playlists/history/folders) schedules a push.
    window.addEventListener('flacdium-db-write', schedulePush);
    // Best-effort flush of a pending push when the tab is hidden/closed.
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && pushTimer) {
            clearTimeout(pushTimer);
            pushSnapshot();
        }
    });
}
