export type StructuredTextBlock =
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] };

function isUnorderedListLine(line: string): RegExpMatchArray | null {
  return line.match(/^\s*[-*•]\s+(.+)$/);
}

function isOrderedListLine(line: string): RegExpMatchArray | null {
  return line.match(/^\s*(?:\d+|[a-zA-Z])[.)]\s+(.+)$/);
}

export function parseStructuredText(input: string | null | undefined): StructuredTextBlock[] {
  const lines = (input ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: StructuredTextBlock[] = [];
  let paragraphLines: string[] = [];
  let listType: "unordered-list" | "ordered-list" | null = null;
  let listItems: string[] = [];

  function flushParagraph() {
    const text = paragraphLines.join("\n").trim();

    if (text) {
      blocks.push({ type: "paragraph", text });
    }

    paragraphLines = [];
  }

  function flushList() {
    if (listType && listItems.length > 0) {
      blocks.push({ type: listType, items: [...listItems] });
    }

    listType = null;
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const unorderedMatch = isUnorderedListLine(line);
    const orderedMatch = isOrderedListLine(line);

    if (unorderedMatch) {
      flushParagraph();

      if (listType !== "unordered-list") {
        flushList();
        listType = "unordered-list";
      }

      listItems.push(unorderedMatch[1].trim());
      continue;
    }

    if (orderedMatch) {
      flushParagraph();

      if (listType !== "ordered-list") {
        flushList();
        listType = "ordered-list";
      }

      listItems.push(orderedMatch[1].trim());
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}
