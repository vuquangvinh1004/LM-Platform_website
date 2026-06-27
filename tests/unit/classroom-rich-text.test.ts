import { describe, expect, it } from "vitest";

import { parseStructuredText } from "@/lib/utils/classroom-rich-text";

describe("classroom-rich-text", () => {
  it("parses paragraphs, bullet lists and numbered lists", () => {
    const blocks = parseStructuredText(`
Nhap mon hoc phan A

- Mon co so
- Nganh Logistics

1. Muc tieu 1
2. Muc tieu 2
`);

    expect(blocks).toEqual([
      { type: "paragraph", text: "Nhap mon hoc phan A" },
      { type: "unordered-list", items: ["Mon co so", "Nganh Logistics"] },
      { type: "ordered-list", items: ["Muc tieu 1", "Muc tieu 2"] },
    ]);
  });

  it("supports alphabetic ordered items like a) and b)", () => {
    const blocks = parseStructuredText("Boi canh bai toan.\na) Yeu cau 1\nb) Yeu cau 2");

    expect(blocks).toEqual([
      { type: "paragraph", text: "Boi canh bai toan." },
      { type: "ordered-list", items: ["Yeu cau 1", "Yeu cau 2"] },
    ]);
  });
});
