import { describe, expect, it } from "vitest";

import { normalizeClassroomEmbeddableUrl, resolveClassroomMediaPreview } from "@/lib/utils/classroom-media";

describe("classroom-media", () => {
  it("converts youtube watch urls into iframe embeds", () => {
    const preview = resolveClassroomMediaPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "video");

    expect(preview).toEqual({
      kind: "iframe",
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
  });

  it("adds embed=1 for internal material viewers", () => {
    expect(normalizeClassroomEmbeddableUrl("/my-classes/materials/material-1?classId=abc")).toBe(
      "/my-classes/materials/material-1?classId=abc&embed=1",
    );
  });

  it("keeps direct audio files in native audio mode", () => {
    const preview = resolveClassroomMediaPreview("https://cdn.local.test/audio/lecture.mp3", "audio");

    expect(preview).toEqual({
      kind: "audio",
      src: "https://cdn.local.test/audio/lecture.mp3",
    });
  });
});
