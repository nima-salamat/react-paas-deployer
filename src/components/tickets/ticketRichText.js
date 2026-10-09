const RICH_TEXT_BLOCKS = ["p", "h1", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "pre"];
const RICH_TEXT_ALIGNMENTS = new Map([
  ["ticket-align-left", "left"],
  ["ticket-align-center", "center"],
  ["ticket-align-right", "right"],
]);
const EXPLICIT_ALIGNMENTS = new Set(["left", "center", "right"]);
const EXPLICIT_DIRECTIONS = new Set(["ltr", "rtl"]);

export function normalizeTicketMessageBody(body) {
  if (body == null) return "";
  if (typeof body === "string") return body;
  if (typeof body === "number" || typeof body === "boolean") return String(body);
  if (typeof body === "object") {
    if (typeof body.html === "string") return body.html;
    if (typeof body.body === "string") return body.body;
    if (typeof body.text === "string") return body.text;
    if (typeof body.content === "string") return body.content;
    if (typeof body.message === "string") return body.message;
    try {
      const serialized = JSON.stringify(body);
      return serialized === "{}" ? "" : serialized;
    } catch {
      return "";
    }
  }
  return String(body);
}

export function getTicketBlockAlignment(block) {
  const metadata = block.getAttribute("data-ticket-align")?.trim().toLowerCase();
  if (EXPLICIT_ALIGNMENTS.has(metadata)) return metadata;

  for (const [className, value] of RICH_TEXT_ALIGNMENTS) {
    if (block.classList.contains(className)) return value;
  }

  const inline = block.style?.textAlign?.trim().toLowerCase();
  return EXPLICIT_ALIGNMENTS.has(inline) ? inline : "";
}

function applyStoredAlignment(block) {
  const alignment = getTicketBlockAlignment(block);
  if (!alignment) return "";
  block.style.setProperty("text-align", alignment, "important");
  block.setAttribute("data-rendered-ticket-align", alignment);
  return alignment;
}

function setListItemDirectionForMarker(item, alignment) {
  if (alignment !== "left" && alignment !== "right") return;

  // Direction controls which side an outside marker occupies. Plaintext bidi
  // lets mixed Persian/Latin text keep its natural paragraph direction.
  item.style.setProperty("direction", alignment === "right" ? "rtl" : "ltr", "important");
  item.style.setProperty("unicode-bidi", "plaintext");
  item.style.setProperty("list-style-position", alignment === "right" ? "inside" : "outside");
}

function normalizeList(list) {
  const directItems = Array.from(list.children).filter((child) => child.tagName === "LI");
  const listAlignment = getTicketBlockAlignment(list);
  const itemAlignments = directItems.map(getTicketBlockAlignment);
  const allItemsShareAlignment = itemAlignments.length > 0
    && itemAlignments.every((alignment) => Boolean(alignment) && alignment === itemAlignments[0]);
  const effectiveAlignment = listAlignment || (allItemsShareAlignment ? itemAlignments[0] : "");

  if (effectiveAlignment) {
    list.style.setProperty("text-align", effectiveAlignment, "important");
    list.setAttribute("data-rendered-ticket-align", effectiveAlignment);
  }

  if (effectiveAlignment === "right") {
    // Keep the marker on the right, while plaintext bidi handles line content.
    list.style.setProperty("direction", "rtl", "important");
    list.style.setProperty("list-style-position", "inside");
    directItems.forEach((item) => {
      const itemDirection = item.getAttribute("dir")?.trim().toLowerCase();
      if (!EXPLICIT_DIRECTIONS.has(itemDirection)) {
        item.style.setProperty("direction", "rtl", "important");
        item.style.setProperty("unicode-bidi", "plaintext");
      }
      item.style.setProperty("list-style-position", "inside");
    });
    return;
  }

  if (effectiveAlignment === "left") {
    list.style.setProperty("direction", "ltr", "important");
    list.style.setProperty("list-style-position", "outside");
    directItems.forEach((item) => {
      const itemDirection = item.getAttribute("dir")?.trim().toLowerCase();
      if (!EXPLICIT_DIRECTIONS.has(itemDirection)) {
        item.style.setProperty("direction", "ltr", "important");
        item.style.setProperty("unicode-bidi", "plaintext");
      }
      item.style.setProperty("list-style-position", "outside");
    });
    return;
  }

  if (effectiveAlignment === "center") {
    list.style.setProperty("list-style-position", "inside");
    directItems.forEach((item) => item.style.setProperty("list-style-position", "inside"));
    return;
  }

  // Mixed lists can align individual lines differently without forcing all
  // list markers to the same side.
  directItems.forEach((item) => {
    setListItemDirectionForMarker(item, getTicketBlockAlignment(item));
  });
}

export function normalizeTicketRichTextBlocks(root) {
  root.querySelectorAll(RICH_TEXT_BLOCKS.join(",")).forEach((block) => {
    const alignment = applyStoredAlignment(block);
    const direction = block.getAttribute("dir")?.trim().toLowerCase();

    if (EXPLICIT_DIRECTIONS.has(direction)) {
      block.style.setProperty("direction", direction, "important");
      block.style.setProperty("unicode-bidi", "plaintext");
    } else if (block.tagName === "LI" && !direction) {
      setListItemDirectionForMarker(block, alignment);
    }

    if (block.tagName === "UL" || block.tagName === "OL") {
      block.style.setProperty("display", "block");
    } else if (block.tagName === "LI") {
      block.style.setProperty("display", "list-item");
    }
  });

  root.querySelectorAll("ol, ul").forEach(normalizeList);
}

export function normalizeTicketRichTextHtml(html) {
  if (!html || typeof DOMParser === "undefined") return html || "";
  const doc = new DOMParser().parseFromString("<div></div>", "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return html;
  root.innerHTML = html;
  normalizeTicketRichTextBlocks(root);
  return root.innerHTML;
}
