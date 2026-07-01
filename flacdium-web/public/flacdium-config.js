// Flacdium backend origin (the shared music library this client streams from).
// Default for local/dev. In Docker this file is overwritten at container start from
// the FLACDIUM_BASE env var (see docker-flacdium-config.sh).
window.FLACDIUM_MODE = true;
window.FLACDIUM_BASE = 'http://localhost:8000';
