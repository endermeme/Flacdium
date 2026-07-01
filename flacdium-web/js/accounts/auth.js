// js/accounts/auth.js
// Flacdium account manager. Replaces the old cloud (PocketBase/Appwrite/OAuth) auth with
// Flacdium's shared accounts: login/signup via /api/auth/* using a bearer token. The token
// is what authorizes streaming/downloads (see flacdium-api.js mapTrack / player.js).
import { flacdiumLogin, flacdiumSignup, flacdiumMe, flacdiumLogout } from '../flacdium-api.js';

function toUser(me) {
    if (!me || !me.username) return null;
    return { id: me.username, name: me.username, username: me.username, email: me.username, isAdmin: !!me.is_admin };
}

export class AuthManager {
    constructor() {
        this.user = null;
        this.authListeners = [];
        this.init().catch(console.error);
    }

    async init() {
        // No token → no network call (fast boot). With a token, validate it once.
        try {
            this.user = toUser(await flacdiumMe());
        } catch {
            this.user = null;
        }
        this.updateUI(this.user);
        this.notify();
    }

    notify() {
        this.authListeners.forEach((listener) => listener(this.user));
    }

    onAuthStateChanged(callback) {
        this.authListeners.push(callback);
        if (this.user !== null) callback(this.user);
    }

    // Primary Flacdium auth. `signInWithEmail`/`signUpWithEmail` are kept as aliases so the
    // existing email auth UI keeps working — the "email" field is the Flacdium username.
    async login(username, password) {
        const { username: name } = await flacdiumLogin(username, password);
        this.user = toUser({ username: name });
        this.updateUI(this.user);
        this.notify();
        return this.user;
    }

    async signup(username, password) {
        const { username: name } = await flacdiumSignup(username, password);
        this.user = toUser({ username: name });
        this.updateUI(this.user);
        this.notify();
        return this.user;
    }

    signInWithEmail(username, password) {
        return this.login(username, password);
    }

    signUpWithEmail(username, password) {
        return this.signup(username, password);
    }

    async signOut() {
        flacdiumLogout();
        this.user = null;
        this.updateUI(null);
        this.notify();
        // Reload so already-rendered tracks drop their (now invalid) stream token and the
        // auth gate comes back up.
        window.location.reload();
    }

    // Bind the full-screen login gate (the auth wall). Called once at boot.
    setupGate() {
        const form = document.getElementById('flacdium-auth-form');
        if (!form || form.dataset.bound) return;
        form.dataset.bound = '1';
        const errEl = document.getElementById('gate-error');
        const userEl = document.getElementById('gate-username');
        const passEl = document.getElementById('gate-password');
        const setBusy = (busy) => {
            form.querySelectorAll('button').forEach((b) => (b.disabled = busy));
        };
        const run = async (fn) => {
            if (errEl) errEl.textContent = '';
            const u = (userEl?.value || '').trim();
            const p = passEl?.value || '';
            if (!u || !p) {
                if (errEl) errEl.textContent = 'Enter your username and password.';
                return;
            }
            setBusy(true);
            try {
                await fn(u, p);
                // Fresh boot with the new token: gate hidden, library loads authorized.
                window.location.reload();
            } catch (e) {
                if (errEl) errEl.textContent = e?.message || 'Sign in failed.';
                setBusy(false);
            }
        };
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            run((u, p) => this.login(u, p));
        });
        document.getElementById('gate-signup')?.addEventListener('click', () => run((u, p) => this.signup(u, p)));
    }

    updateUI(user) {
        // Auth wall: show the gate whenever there is no signed-in user.
        const gate = document.getElementById('flacdium-auth-gate');
        if (gate) gate.classList.toggle('hidden', !!user);

        const statusText = document.getElementById('auth-status');
        if (statusText) {
            statusText.textContent = user ? `Signed in as ${user.username}` : 'Not signed in.';
        }
        const connectBtn = document.getElementById('auth-connect-btn');
        if (connectBtn) {
            connectBtn.textContent = 'Sign Out';
            connectBtn.classList.add('danger');
            connectBtn.style.display = user ? '' : 'none';
            connectBtn.onclick = () => this.signOut();
        }
    }
}

export const authManager = new AuthManager();
