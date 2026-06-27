import type { ClassroomSessionLectureType } from "@/lib/types/classroom";

export type ClassroomMediaPreview =
  | { kind: "iframe"; src: string }
  | { kind: "video"; src: string }
  | { kind: "audio"; src: string };

function withOriginlessPath(url: URL): string {
  return `${url.pathname}${url.search}`;
}

export function normalizeClassroomEmbeddableUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);

    const isInternalMaterialRoute =
      parsedUrl.pathname.startsWith("/my-classes/materials/") || parsedUrl.pathname.startsWith("/classes/materials/");

    if (isInternalMaterialRoute) {
      parsedUrl.searchParams.set("embed", "1");
      return withOriginlessPath(parsedUrl);
    }

    if (parsedUrl.hostname === "docs.google.com" && parsedUrl.pathname.includes("/presentation/")) {
      return url
        .replace("/edit", "/embed")
        .replace("/present", "/embed")
        .replace(/\/pub(\?.*)?$/, "/embed");
    }

    if (parsedUrl.hostname === "drive.google.com" && parsedUrl.pathname.includes("/file/d/")) {
      return url.replace("/view", "/preview");
    }
  } catch {
    if (url.startsWith("/my-classes/materials/") || url.startsWith("/classes/materials/")) {
      const separator = url.includes("?") ? "&" : "?";

      if (/[?&]embed=1(?:&|$)/.test(url)) {
        return url;
      }

      return `${url}${separator}embed=1`;
    }

    return url;
  }

  return url;
}

export function isInternalMaterialViewerUrl(url: string): boolean {
  if (url.startsWith("/my-classes/materials/") || url.startsWith("/classes/materials/")) {
    return true;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname.startsWith("/my-classes/materials/") || parsedUrl.pathname.startsWith("/classes/materials/");
  } catch {
    return false;
  }
}

function resolveYouTubeEmbed(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) {
      videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
    }
  }

  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

function resolveVimeoEmbed(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");

  if (host !== "vimeo.com" && host !== "player.vimeo.com") {
    return null;
  }

  const videoId = url.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
  return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
}

function resolveSpotifyEmbed(url: URL): string | null {
  const host = url.hostname.replace(/^open\./, "").replace(/^www\./, "");

  if (host !== "spotify.com") {
    return null;
  }

  if (url.pathname.startsWith("/embed/")) {
    return url.toString();
  }

  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
}

function resolveSoundCloudEmbed(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");

  if (!host.endsWith("soundcloud.com")) {
    return null;
  }

  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.toString())}`;
}

function resolveKnownIframeEmbed(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    return (
      resolveYouTubeEmbed(parsedUrl)
      ?? resolveVimeoEmbed(parsedUrl)
      ?? resolveSpotifyEmbed(parsedUrl)
      ?? resolveSoundCloudEmbed(parsedUrl)
    );
  } catch {
    return null;
  }
}

function hasMediaFileExtension(url: string, extensions: string[]): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return extensions.some((extension) => pathname.endsWith(extension));
  } catch {
    const normalized = url.toLowerCase().split("?")[0] ?? url.toLowerCase();
    return extensions.some((extension) => normalized.endsWith(extension));
  }
}

export function resolveClassroomMediaPreview(url: string, type: ClassroomSessionLectureType): ClassroomMediaPreview | null {
  const normalizedUrl = normalizeClassroomEmbeddableUrl(url);
  const knownIframeUrl = resolveKnownIframeEmbed(normalizedUrl);

  if (knownIframeUrl) {
    return { kind: "iframe", src: knownIframeUrl };
  }

  if (type === "video") {
    if (hasMediaFileExtension(normalizedUrl, [".mp4", ".webm", ".ogg", ".mov", ".m4v"])) {
      return { kind: "video", src: normalizedUrl };
    }

    return { kind: "iframe", src: normalizedUrl };
  }

  if (type === "audio") {
    if (hasMediaFileExtension(normalizedUrl, [".mp3", ".wav", ".ogg", ".m4a", ".aac"])) {
      return { kind: "audio", src: normalizedUrl };
    }

    return { kind: "iframe", src: normalizedUrl };
  }

  return { kind: "iframe", src: normalizedUrl };
}
