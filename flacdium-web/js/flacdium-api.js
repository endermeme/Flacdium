// js/flacdium-api.js
// Adapter replacing the TIDAL backend with the Flacdium shared-library JSON API.
// Every LosslessAPI data request funnels through fetchWithRetry(); in Flacdium mode
// we intercept the relative path here and return a Response-like object whose .json()
// yields data in the exact shape LosslessAPI already parses (search/album/artist/track).
//
// Playback: each mapped track carries `audioUrl` (= /preview/{id}?token=…), so player.js
// takes its native direct-audio path (bit-perfect FLAC), bypassing HLS/Shaka/manifests.

const TOKEN_KEY = 'flacdium_token';

export function isFlacdiumMode() {
    return typeof window !== 'undefined' && window.FLACDIUM_MODE !== false;
}

export function flacdiumBase() {
    const base = (typeof window !== 'undefined' && window.FLACDIUM_BASE) || 'http://localhost:8000';
    return String(base).replace(/\/+$/, '');
}

export function getToken() {
    try {
        return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
        return '';
    }
}

export function setToken(token) {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch {
        /* storage unavailable */
    }
}

// --- id encoding for album/artist derived from tag names (UTF-8 safe base64url) ---
function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64decode(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}
function albumId(f) {
    return 'al_' + b64encode(JSON.stringify({ al: f.album || '', ar: f.album_artist || f.artist || '' }));
}
function artistId(f) {
    return 'ar_' + b64encode(f.artist || '');
}
function decodeAlbumId(id) {
    try {
        return JSON.parse(b64decode(String(id).replace(/^al_/, '')));
    } catch {
        return null;
    }
}
function decodeArtistId(id) {
    try {
        return b64decode(String(id).replace(/^ar_/, ''));
    } catch {
        return null;
    }
}

function qualityFor(f) {
    return (f.bit_depth || 0) > 16 || (f.sample_rate || 0) > 48000 ? 'HI_RES_LOSSLESS' : 'LOSSLESS';
}

// Flacdium track JSON -> TIDAL-ish raw track consumed by LosslessAPI.prepareTrack().
export function mapTrack(f) {
    const base = flacdiumBase();
    const token = getToken();
    const cover = f.cover_url ? base + f.cover_url : null;
    const tokenQuery = token ? '?token=' + encodeURIComponent(token) : '';
    const stream = base + (f.stream_url || '/preview/' + f.id) + tokenQuery;
    const releaseDate = f.release_date || (f.year ? String(f.year) + '-01-01' : undefined);
    const artist = { id: artistId(f), name: f.artist || 'Unknown Artist', type: 'ARTIST', picture: null };
    return {
        id: f.id,
        title: f.title || 'Untitled',
        duration: f.duration_seconds || 0,
        trackNumber: f.track_number || 1,
        volumeNumber: f.disc_number || 1,
        audioQuality: qualityFor(f),
        explicit: false,
        copyright: '',
        isrc: '',
        popularity: 0,
        replayGain: 0,
        peak: 1,
        type: 'track',
        url: '',
        streamStartDate: releaseDate,
        artist,
        artists: [artist],
        album: { id: albumId(f), title: f.album || 'Unknown Album', cover, releaseDate },
        // Flacdium-specific: native direct-audio path in player.js (bit-perfect FLAC).
        audioUrl: stream,
        isFlacdium: true,
        flacSpecs: f.specs_label || '',
        // Native source specs (from backend serialize_api_track) — used by the bit-perfect
        // badge to show real rate/bit depth and warn when the OS will resample.
        sampleRate: f.sample_rate || 0,
        bitDepth: f.bit_depth || 0,
        channels: f.channels || 0,
        downloadUrl: base + (f.download_url || '/download/' + f.id),
    };
}

function dedupeAlbums(tracks) {
    const map = new Map();
    for (const t of tracks) {
        const a = t.album;
        if (!a) continue;
        const existing = map.get(a.id);
        if (existing) {
            existing.numberOfTracks += 1;
            continue;
        }
        map.set(a.id, {
            id: a.id,
            title: a.title,
            cover: a.cover,
            releaseDate: a.releaseDate,
            artist: t.artist,
            artists: [t.artist],
            numberOfTracks: 1,
            type: 'ALBUM',
        });
    }
    return Array.from(map.values());
}

function dedupeArtists(tracks) {
    const map = new Map();
    for (const t of tracks) {
        const a = t.artist;
        if (!a || map.has(a.id)) continue;
        map.set(a.id, { id: a.id, name: a.name, picture: null, type: 'ARTIST' });
    }
    return Array.from(map.values());
}

// In-flight request dedup: collapses concurrent identical GETs (e.g. getArtist fires
// /artist/?id= and /artist/?f= in parallel — both map to the same /api/tracks query).
const _inflight = new Map();

async function apiGet(path) {
    if (_inflight.has(path)) return _inflight.get(path);
    const promise = (async () => {
        const token = getToken();
        const headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;
        const res = await fetch(flacdiumBase() + path, { headers });
        if (!res.ok) throw new Error('Flacdium API ' + res.status + ' for ' + path);
        return res.json();
    })();
    _inflight.set(path, promise);
    try {
        return await promise;
    } finally {
        _inflight.delete(path);
    }
}

// Full-library browse (the landing view for a small shared library). Returns mapped-but-
// not-prepared raw tracks; the caller runs them through LosslessAPI.prepareTrack().
export async function flacdiumLibraryRaw(page = 1, sort = 'newest') {
    const data = await apiGet(
        '/api/tracks?per_page=60&tracks_page=' + page + '&sort=' + encodeURIComponent(sort)
    );
    return {
        items: (data.items || []).map(mapTrack),
        total: data.total_items ?? 0,
        hasNext: !!data.has_next,
        page: data.page ?? page,
        totalPages: data.total_pages ?? 1,
    };
}

async function searchData(term) {
    const data = await apiGet('/api/tracks?per_page=50&q=' + encodeURIComponent(term || ''));
    const items = (data.items || []).map(mapTrack);
    const empty = { items: [], limit: 0, offset: 0, totalNumberOfItems: 0 };
    return {
        tracks: { items, limit: items.length, offset: 0, totalNumberOfItems: data.total_items ?? items.length },
        albums: wrap(dedupeAlbums(items)),
        artists: wrap(dedupeArtists(items)),
        playlists: empty,
        videos: empty,
    };
}

function wrap(items) {
    return { items, limit: items.length, offset: 0, totalNumberOfItems: items.length };
}

async function albumData(id) {
    const key = decodeAlbumId(id) || { al: '', ar: '' };
    const data = await apiGet('/api/tracks?per_page=100&album=' + encodeURIComponent(key.al));
    let items = (data.items || []).map(mapTrack).filter((t) => t.album.title === key.al);
    if (key.ar) {
        const matchArtist = items.filter((t) => t.artist.name === key.ar);
        if (matchArtist.length) items = matchArtist;
    }
    items.sort((a, b) => (a.volumeNumber - b.volumeNumber) || (a.trackNumber - b.trackNumber));
    const first = items[0];
    return {
        id,
        title: key.al || (first && first.album.title) || 'Unknown Album',
        cover: first ? first.album.cover : null,
        releaseDate: first ? first.album.releaseDate : undefined,
        artist: first ? first.artist : undefined,
        numberOfTracks: items.length,
        type: 'ALBUM',
        items,
    };
}

async function artistData(id) {
    const name = decodeArtistId(id) || '';
    const data = await apiGet('/api/tracks?per_page=100&artist=' + encodeURIComponent(name));
    const items = (data.items || []).map(mapTrack).filter((t) => t.artist.name === name);
    return {
        artist: { id, name: name || 'Unknown Artist', picture: null, type: 'ARTIST' },
        albums: dedupeAlbums(items),
        tracks: items,
    };
}

async function trackData(id) {
    const f = await apiGet('/api/tracks/' + encodeURIComponent(id));
    const track = mapTrack(f);
    // parseTrackLookup wants [trackWithDuration, infoWithManifest]; manifest carries the
    // direct FLAC url so getStreamUrl works even if the direct path is ever bypassed.
    const info = { manifest: { urls: [track.audioUrl] }, manifestMimeType: 'application/json', audioQuality: track.audioQuality };
    return [track, info];
}

// --- auth (shared Flacdium accounts) ---
async function authPost(path, username, password) {
    const res = await fetch(flacdiumBase() + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    let data = {};
    try {
        data = await res.json();
    } catch {
        /* non-json error */
    }
    if (!res.ok) throw new Error(data.detail || ('Request failed (' + res.status + ')'));
    setToken(data.token);
    return { username: data.username };
}

export function flacdiumLogin(username, password) {
    return authPost('/api/auth/login', username, password);
}
export function flacdiumSignup(username, password) {
    return authPost('/api/auth/signup', username, password);
}
export async function flacdiumMe() {
    const token = getToken();
    if (!token) return null; // no token → no network call on boot
    try {
        const res = await fetch(flacdiumBase() + '/api/auth/me', {
            headers: { Authorization: 'Bearer ' + token },
        });
        if (!res.ok) {
            setToken('');
            return null;
        }
        return await res.json();
    } catch {
        return null;
    }
}
export function flacdiumLogout() {
    setToken('');
}

export function hasFlacdiumToken() {
    return !!getToken();
}

// Live stream URL for a track id using the CURRENT token. Called at play time so a track
// browsed before login still streams once the user signs in (token added on the fly).
export function flacdiumStreamUrl(id) {
    const token = getToken();
    return flacdiumBase() + '/preview/' + id + (token ? '?token=' + encodeURIComponent(token) : '');
}

function responseLike(data) {
    return { ok: true, status: 200, json: async () => data, headers: new Map() };
}

// Route a LosslessAPI relative path to the Flacdium API. Returns a Response-like object,
// or null for paths Flacdium intentionally does not serve (recommendations/lyrics/etc).
export async function flacdiumRoute(relativePath) {
    const url = new URL(relativePath, 'http://local');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const sp = url.searchParams;
    if (path === '/search') {
        const term = sp.get('q') || sp.get('s') || sp.get('a') || sp.get('al') || sp.get('v') || sp.get('p') || '';
        return responseLike(await searchData(term));
    }
    if (path === '/album') {
        return responseLike(await albumData(sp.get('id')));
    }
    if (path === '/artist') {
        return responseLike(await artistData(sp.get('id') || sp.get('f')));
    }
    if (path === '/track') {
        return responseLike(await trackData(sp.get('id')));
    }
    // Unserved TIDAL-only routes (recommendations, similar, manifests, playlist, mix, video).
    return responseLike({ items: [], tracks: [], albums: [] });
}
