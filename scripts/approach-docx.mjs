/**
 * Build "Approach and key decisions" as a Word file, from the markdown.
 *
 * The write-up exists twice — as SUBMISSION.md in the repository and as a .docx
 * to attach to a submission form — and two copies of a document drift. This
 * generates the second from the first, so there is only one to edit.
 *
 * It must come out as one page, which is why no figure is embedded: the
 * diagrams are drawn for 6.5 inches, and the room left beside this much prose
 * is about two, where their labels stop being readable. They stay in the
 * README at full size.
 *
 *   node scripts/approach-docx.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

const source = readFileSync("SUBMISSION.md", "utf8");

/** `**bold**` and `` `code` `` become runs; a trailing space stays outside the run. */
function runs(text) {
  const out = [];
  for (const part of text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)) {
    if (!part) continue;
    const bold = part.startsWith("**");
    const code = part.startsWith("`");
    const inner = bold ? part.slice(2, -2) : code ? part.slice(1, -1) : part;
    const lead = inner.match(/^\s*/)[0];
    const tail = inner.match(/\s*$/)[0];
    const core = inner.slice(lead.length, inner.length - tail.length);
    if (lead) out.push(new TextRun(lead));
    if (core) {
      out.push(
        new TextRun({ text: core, bold, font: code ? "Consolas" : undefined, size: code ? 21 : undefined }),
      );
    }
    if (tail) out.push(new TextRun(tail));
  }
  return out;
}

const children = [];
for (const block of source.split("\n\n")) {
  const line = block.trim().split("\n").map((l) => l.trim()).join(" ");
  if (!line) continue;
  if (line.startsWith("# ")) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
        children: [new TextRun({ text: line.slice(2), bold: true, size: 32 })],
      }),
    );
  } else {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 160, line: 276 },
        children: runs(line),
      }),
    );
  }
}

const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter, in DXA
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    },
  ],
});

const out = "Approach and key decisions.docx";
writeFileSync(out, await Packer.toBuffer(doc));
console.log(`${out} — ${children.length} paragraphs`);
