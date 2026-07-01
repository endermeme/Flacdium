// js/music-api.js

import { LosslessAPI } from './api.js';
import { PodcastsAPI } from './podcasts-api.js';
import { musicProviderSettings } from './storage.js';

/**
 * MusicAPI - Singleton class that provides a unified interface for accessing music streaming services.
 *
 * Supports multiple providers (primarily Tidal) and includes functionality for searching,
 * retrieving metadata, streaming, and managing playlists, artists, albums, tracks, and podcasts.
 *
 * @class MusicAPI
 * @classdesc Manages API interactions with music providers and provides caching mechanisms
 * for cover artwork and video metadata.
 *
 * @example
 * // Initialize the MusicAPI
 * await MusicAPI.initialize(settings);
 *
 * // Get the singleton instance
 * const api = MusicAPI.instance;
 *
 * // Search for tracks
 * const results = await api.search('query');
 *
 * // Get a specific track
 * const track = await api.getTrack('track-id');
 *
 * // Get stream URL
 * const streamUrl = await api.getStreamUrl('track-id', 'HIGH');
 *
 * @property {LosslessAPI} tidalAPI - The Tidal API instance
 * @property {PodcastsAPI} podcastsAPI - The Podcasts API instance
 * @property {Object} _settings - Configuration settings
 * @property {Map} videoArtworkCache - Cache for video artwork data
 *
 * @throws {Error} Throws if instance is accessed before initialization
 * @throws {Error} Throws if initialize is called more than once
 */
export class MusicAPI {
    static #instance = null;
    /**
     * @type {MusicAPI}
     */
    static get instance() {
        if (!MusicAPI.#instance) {
            throw new Error('MusicAPI not initialized. Call MusicAPI.initialize(settings) first.');
        }
        return MusicAPI.#instance;
    }

    /** @private */
    constructor(settings) {
        this.tidalAPI = new LosslessAPI(settings);
        this.podcastsAPI = new PodcastsAPI();
        this._settings = settings;
        this.videoArtworkCache = new Map();
        this.searchAbortController = null;
    }

    static async initialize(settings) {
        if (MusicAPI.#instance) {
            throw new Error('MusicAPI is already initialized');
        }

        const api = new MusicAPI(settings);
        return (MusicAPI.#instance = api);
    }

    getCurrentProvider() {
        return musicProviderSettings.getProvider();
    }

    // Get the appropriate API based on provider
    getAPI() {
        return this.tidalAPI;
    }

    // Search methods
    async search(query, options = {}) {
        // Cancel previous search request
        if (this.searchAbortController) {
            this.searchAbortController.abort();
        }

        // Create new AbortController for this search
        this.searchAbortController = new AbortController();
        const signal = this.searchAbortController.signal;

        const api = this.getAPI();
        if (typeof api.search === 'function') {
            const result = await api.search(query, { ...options, signal });
            this.searchAbortController = null;
            return result;
        }

        // Fallback for providers that don't implement unified search
        try {
            const [tracksResult, videosResult, artistsResult, albumsResult, playlistsResult] = await Promise.all([
                api.searchTracks(query, { ...options, signal }),
                api.searchVideos ? api.searchVideos(query, { ...options, signal }) : Promise.resolve({ items: [] }),
                api.searchArtists(query, { ...options, signal }),
                api.searchAlbums(query, { ...options, signal }),
                api.searchPlaylists ? api.searchPlaylists(query, { ...options, signal }) : Promise.resolve({ items: [] }),
            ]);

            this.searchAbortController = null;
            return {
                tracks: tracksResult,
                videos: videosResult,
                artists: artistsResult,
                albums: albumsResult,
                playlists: playlistsResult,
            };
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.searchAbortController = null;
                throw error;
            }
            // If aborted, return empty results
            return {
                tracks: { items: [] },
                videos: { items: [] },
                artists: { items: [] },
                albums: { items: [] },
                playlists: { items: [] },
            };
        }
    }

    async searchTracks(query, options = {}) {
        // Cancel previous search request
        if (this.searchAbortController) {
            this.searchAbortController.abort();
        }

        // Create new AbortController for this search
        this.searchAbortController = new AbortController();
        const signal = this.searchAbortController.signal;

        try {
            const result = await this.getAPI().searchTracks(query, { ...options, signal });
            this.searchAbortController = null;
            return result;
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.searchAbortController = null;
                throw error;
            }
            // If aborted, return empty results
            return { items: [] };
        }
    }

    async searchArtists(query, options = {}) {
        // Cancel previous search request
        if (this.searchAbortController) {
            this.searchAbortController.abort();
        }

        // Create new AbortController for this search
        this.searchAbortController = new AbortController();
        const signal = this.searchAbortController.signal;

        try {
            const result = await this.getAPI().searchArtists(query, { ...options, signal });
            this.searchAbortController = null;
            return result;
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.searchAbortController = null;
                throw error;
            }
            // If aborted, return empty results
            return { items: [] };
        }
    }

    async searchAlbums(query, options = {}) {
        // Cancel previous search request
        if (this.searchAbortController) {
            this.searchAbortController.abort();
        }

        // Create new AbortController for this search
        this.searchAbortController = new AbortController();
        const signal = this.searchAbortController.signal;

        try {
            const result = await this.getAPI().searchAlbums(query, { ...options, signal });
            this.searchAbortController = null;
            return result;
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.searchAbortController = null;
                throw error;
            }
            // If aborted, return empty results
            return { items: [] };
        }
    }

    async searchPlaylists(query, options = {}) {
        // Cancel previous search request
        if (this.searchAbortController) {
            this.searchAbortController.abort();
        }

        // Create new AbortController for this search
        this.searchAbortController = new AbortController();
        const signal = this.searchAbortController.signal;

        try {
            const result = await this.tidalAPI.searchPlaylists(query, { ...options, signal });
            this.searchAbortController = null;
            return result;
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.searchAbortController = null;
                throw error;
            }
            // If aborted, return empty results
            return { items: [] };
        }
    }

    async searchVideos(query, options = {}) {
        // Cancel previous search request
        if (this.searchAbortController) {
            this.searchAbortController.abort();
        }

        // Create new AbortController for this search
        this.searchAbortController = new AbortController();
        const signal = this.searchAbortController.signal;

        try {
            const result = await this.tidalAPI.searchVideos(query, { ...options, signal });
            this.searchAbortController = null;
            return result;
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.searchAbortController = null;
                throw error;
            }
            // If aborted, return empty results
            return { items: [] };
        }
    }

    async searchPodcasts(query, options = {}) {
        return this.podcastsAPI.searchPodcasts(query, options);
    }

    async getPodcast(id, options = {}) {
        return this.podcastsAPI.getPodcastById(id, options);
    }

    async getPodcastEpisodes(id, options = {}) {
        return this.podcastsAPI.getPodcastEpisodes(id, options);
    }

    async getTrendingPodcasts(options = {}) {
        return this.podcastsAPI.getTrendingPodcasts(options);
    }

    // Get methods
    async getTrack(id, quality) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.getTrack(cleanId, quality);
    }

    async getTrackMetadata(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.getTrackMetadata(cleanId);
    }

    async getAlbum(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.getAlbum(cleanId);
    }

    // Full Flacdium library browse (paginated). Used by the home/landing view.
    async getLibraryTracks(page = 1, sort = 'newest') {
        const api = this.getAPI();
        if (typeof api.getLibraryTracks === 'function') {
            return api.getLibraryTracks(page, sort);
        }
        return { tracks: [], total: 0, hasNext: false, page, totalPages: 1 };
    }

    async getArtist(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.getArtist(cleanId);
    }

    async getArtistBiography(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        if (typeof api.getArtistBiography === 'function') {
            return api.getArtistBiography(cleanId);
        }
        return null;
    }

    async getVideo(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.getVideo(cleanId);
    }

    async getVideoStreamUrl(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        if (typeof api.getVideoStreamUrl === 'function') {
            return api.getVideoStreamUrl(cleanId);
        }
    }

    async getArtistSocials(artistName) {
        return this.tidalAPI.getArtistSocials(artistName);
    }

    async getPlaylist(id, _provider = null) {
        // Playlists are always Tidal for now
        return this.tidalAPI.getPlaylist(id);
    }

    async getMix(id) {
        // Mixes are always Tidal for now
        return this.tidalAPI.getMix(id);
    }

    async getTrackRecommendations(id) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        if (typeof api.getTrackRecommendations === 'function') {
            return api.getTrackRecommendations(cleanId);
        }
        return [];
    }

    // Stream methods
    async getStreamUrl(id, quality) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.getStreamUrl(cleanId, quality);
    }

    // Cover/artwork methods
    getCoverUrl(id, size = '320') {
        if (typeof id === 'string' && id.startsWith('blob:')) {
            return id;
        }
        return this.tidalAPI.getCoverUrl(this.stripProviderPrefix(id), size);
    }

    getVideoCoverUrl(imageId, size = '1280') {
        if (!imageId) {
            return null;
        }
        if (typeof imageId === 'string' && imageId.startsWith('blob:')) {
            return imageId;
        }
        return this.tidalAPI.getVideoCoverUrl(this.stripProviderPrefix(imageId), size);
    }

    async getVideoArtwork(title, artist) {
        const cacheKey = `${title}-${artist}`.toLowerCase();
        if (this.videoArtworkCache.has(cacheKey)) {
            return this.videoArtworkCache.get(cacheKey);
        }

        try {
            const url = `https://artwork.boidu.dev/?s=${encodeURIComponent(title)}&a=${encodeURIComponent(artist)}`;
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json();
            const result = {
                videoUrl: data.videoUrl || null,
                hlsUrl: data.animated || null,
            };
            this.videoArtworkCache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.warn('Failed to fetch video artwork:', error);
            return null;
        }
    }

    getArtistPictureUrl(id, size = '320') {
        return this.tidalAPI.getArtistPictureUrl(this.stripProviderPrefix(id), size);
    }

    extractStreamUrlFromManifest(manifest) {
        return this.tidalAPI.extractStreamUrlFromManifest(manifest);
    }

    // Helper methods
    getProviderFromId(id) {
        if (typeof id === 'string') {
            if (id.startsWith('t:')) return 'tidal';
        }
        return null;
    }

    stripProviderPrefix(id) {
        if (typeof id === 'string') {
            if (id.startsWith('q:') || id.startsWith('t:')) {
                return id.slice(2);
            }
        }
        return id;
    }

    // Download methods
    async downloadTrack(id, quality, filename, options = {}) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(id);
        return api.downloadTrack(cleanId, quality, filename, options);
    }

    // Similar/recommendation methods
    async getSimilarArtists(artistId) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(artistId);
        return api.getSimilarArtists(cleanId);
    }

    async getArtistTopTracks(artistId, options = {}) {
        return this.tidalAPI.getArtistTopTracks(artistId, options);
    }

    async getSimilarAlbums(albumId) {
        const api = this.getAPI();
        const cleanId = this.stripProviderPrefix(albumId);
        return api.getSimilarAlbums(cleanId);
    }

    async getRecommendedTracksForPlaylist(tracks, limit = 20, options = {}) {
        // Use Tidal for recommendations
        return this.tidalAPI.getRecommendedTracksForPlaylist(tracks, limit, options);
    }

    // Cache methods
    async clearCache() {
        await this.tidalAPI.clearCache();
    }

    getCacheStats() {
        return this.tidalAPI.getCacheStats();
    }

    // Settings accessor for compatibility
    get settings() {
        return this._settings;
    }
}

export const musicAPI = new MusicAPI();
