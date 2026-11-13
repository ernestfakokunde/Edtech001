import type { GeneratedSet } from "./api";

function normalisePdfText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e]/g, "?");
}

function wrapText(value: string, width = 84) {
  const words = normalisePdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) { line = word; continue; }
    if ((line.length + word.length + 1) <= width) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function createPdf(lines: string[]) {
  const linesPerPage = 46;
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / linesPerPage)) }, (_, index) => lines.slice(index * linesPerPage, (index + 1) * linesPerPage));
  const fontId = 3 + pages.length * 2;
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ];

  pages.forEach((pageLines, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    const content = [
      "BT",
      "/F1 11 Tf",
      "48 794 Td",
      "16 TL",
      ...pageLines.map((line, lineIndex) => `${lineIndex === 0 ? "" : "T* "}(${escapePdfText(line)}) Tj`),
      "ET",
    ].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const parts = ["%PDF-1.4\n"];
  const offsets = [0];
  let byteLength = new TextEncoder().encode(parts[0]).length;
  objects.forEach((object, index) => {
    offsets.push(byteLength);
    const part = `${index + 1} 0 obj\n${object}\nendobj\n`;
    parts.push(part);
    byteLength += new TextEncoder().encode(part).length;
  });
  const xrefOffset = byteLength;
  parts.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return new Blob(parts, { type: "application/pdf" });
}

export function downloadQuestionPaperPdf(sourceName: string, set: GeneratedSet) {
  const lines = [
    "RecappEdu Question Paper",
    `Source: ${normalisePdfText(sourceName)}`,
    `Questions: ${set.items.length}`,
    "",
  ];
  set.items.forEach((item, index) => {
    const question = item.question;
    lines.push(...wrapText(`${index + 1}. ${question.prompt}`));
    const options = question.metadata?.options ?? [];
    options.forEach((option, optionIndex) => lines.push(...wrapText(`   ${String.fromCharCode(65 + optionIndex)}. ${option}`)));
    lines.push("");
  });

  const url = URL.createObjectURL(createPdf(lines));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sourceName.replace(/\.[^.]+$/, "") || "recappedu"}-question-paper.pdf`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
