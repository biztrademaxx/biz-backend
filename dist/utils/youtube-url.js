"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeYoutubeVideoUrlForStorage = normalizeYoutubeVideoUrlForStorage;
/**
 * Normalize and validate a YouTube video URL for storage (canonical watch URL).
 */
function normalizeYoutubeVideoUrlForStorage(input) {
    if (input === null || input === undefined) {
        return { ok: true, value: null };
    }
    const s = String(input).trim();
    if (!s) {
        return { ok: true, value: null };
    }
    let url;
    try {
        const href = /^https?:\/\//i.test(s) ? s : `https://${s}`;
        url = new URL(href);
    }
    catch {
        return { ok: false, message: "Invalid URL" };
    }
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    let videoId = null;
    if (host === "youtu.be") {
        videoId = url.pathname.replace(/^\//, "").split("/").filter(Boolean)[0] ?? null;
    }
    else if (host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com") {
        const v = url.searchParams.get("v");
        if (v && /^[\w-]{11}$/.test(v)) {
            videoId = v;
        }
        else if (url.pathname.startsWith("/embed/")) {
            videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
        }
        else if (url.pathname.startsWith("/shorts/")) {
            videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
        }
        else if (url.pathname.startsWith("/live/")) {
            videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
        }
    }
    if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
        return {
            ok: false,
            message: "Enter a valid YouTube video URL (youtube.com/watch, youtu.be, embed, shorts, or live)",
        };
    }
    return { ok: true, value: `https://www.youtube.com/watch?v=${videoId}` };
}
