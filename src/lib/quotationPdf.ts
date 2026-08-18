import PDFDocument from "pdfkit";
import { sanitizeBrandColor } from "@/lib/color";
import type { ScopeItem, FeeItem, TermItem, StatHighlight } from "@/lib/quotationPresets";

type QuotationPdfData = {
  quotationNumber: string;
  status: string;
  title: string;
  subtitle: string | null;
  preparedByName: string | null;
  introNote: string | null;
  statHighlights: StatHighlight[];
  aboutPoints: ScopeItem[];
  scopeItems: ScopeItem[];
  feeItems: FeeItem[];
  termsItems: TermItem[];
  issueDate: Date;
  validUntil: Date | null;
  firm: {
    name: string; address: string | null; city: string | null;
    phone: string | null; email: string | null; website: string | null;
    showCaTagline: boolean; brandColor: string;
  };
  clientName: string;
};

const INK = "#334155";
const MUTED = "#64748b";
const BORDER = "#E5E7EB";
const SECONDARY = "#F8FAFC";
const PAGE_LEFT = 50;
const PAGE_RIGHT = 545;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;
const PAGE_BOTTOM = 780;

function fmtInr(n: number): string {
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function firmInitials(name: string): string {
  const words = name.replace(/[^\w\s&]/g, "").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
}

/**
 * Renders a service proposal as a PDF, one section per page — Cover,
 * Introduction, Scope of Services, Our Fee, Terms & Signature — mirroring a
 * classic consulting-proposal layout. A section only spills onto an extra
 * page if its own content genuinely doesn't fit; sections are never merged
 * onto a shared page.
 */
export async function renderQuotationPdf(quotation: QuotationPdfData): Promise<Buffer> {
  const PRIMARY = sanitizeBrandColor(quotation.firm.brandColor);
  const stats = quotation.statHighlights.filter((s) => s.value.trim());
  const hasIntroPage = !!(quotation.introNote || stats.length > 0 || quotation.aboutPoints.length > 0);

  const sections = [
    hasIntroPage ? "Introduction" : null,
    quotation.scopeItems.length ? "Scope of Services" : null,
    quotation.feeItems.length ? "Our Fee" : null,
    quotation.termsItems.length ? "Terms & Signature" : null,
  ].filter((s): s is string => !!s);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let pageNum = 1;
    let currentLabel = sections[0] ?? "Proposal";

    function contentHeader(label: string) {
      doc.rect(0, 0, 595, 6).fill(PRIMARY);
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(9.5).text(quotation.firm.name, PAGE_LEFT, 26, { width: 300 });
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(8).text(label.toUpperCase(), PAGE_LEFT, 26, { width: PAGE_WIDTH, align: "right", characterSpacing: 0.5 });
      doc.moveTo(PAGE_LEFT, 44).lineTo(PAGE_RIGHT, 44).strokeColor(BORDER).stroke();
    }
    function footer() {
      doc.font("Helvetica").fontSize(7.5).fillColor("#9ca3af")
        .text(`Private & Confidential`, PAGE_LEFT, PAGE_BOTTOM, { width: PAGE_WIDTH })
        .text(`${quotation.quotationNumber} · Page ${pageNum}`, PAGE_LEFT, PAGE_BOTTOM, { width: PAGE_WIDTH, align: "right" });
    }
    let onCoverPage = true;
    function newPage(label = currentLabel) {
      // The cover page has its own contact-details block sitting at the
      // bottom — stamping the generic footer there would print right on
      // top of it. Only stamp the footer when actually leaving a content page.
      if (!onCoverPage) footer();
      onCoverPage = false;
      doc.addPage({ size: "A4", margin: 0 });
      pageNum++;
      currentLabel = label;
      contentHeader(label);
    }
    function beginSection(label: string): number {
      newPage(label);
      const y = 70;
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(9).text(label.toUpperCase(), PAGE_LEFT, y, { characterSpacing: 0.6 });
      doc.moveTo(PAGE_LEFT, y + 14).lineTo(PAGE_RIGHT, y + 14).strokeColor(PRIMARY).lineWidth(1.5).stroke();
      doc.lineWidth(1);
      return y + 30;
    }
    function subLabel(y: number, text: string): number {
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7.5).text(text.toUpperCase(), PAGE_LEFT, y, { characterSpacing: 0.5 });
      return y + 16;
    }

    // ---- Cover page ----
    doc.rect(0, 0, 595, 842).fill(PRIMARY);
    doc.fillOpacity(0.15).roundedRect(PAGE_LEFT, 56, 40, 40, 10).fill("#ffffff");
    doc.fillOpacity(1).fillColor("#ffffff").font("Helvetica-Bold").fontSize(13).text(firmInitials(quotation.firm.name), PAGE_LEFT, 68, { width: 40, align: "center" });
    doc.font("Helvetica-Bold").fontSize(13).text(quotation.firm.name, PAGE_LEFT + 50, 62, { width: 350 });
    if (quotation.firm.showCaTagline) {
      doc.fillOpacity(0.8).font("Helvetica").fontSize(8.5).fillColor("#ffffff").text("Chartered Accountants", PAGE_LEFT + 50, 78, { width: 350 });
      doc.fillOpacity(1);
    }

    doc.fillOpacity(0.7).fillColor("#ffffff").font("Helvetica-Bold").fontSize(9)
      .text((quotation.subtitle || "PROFESSIONAL SERVICES PROPOSAL").toUpperCase(), PAGE_LEFT, 190, { width: 420, characterSpacing: 1 });
    doc.fillOpacity(1).fillColor("#ffffff").font("Helvetica-Bold").fontSize(28).text(quotation.title, PAGE_LEFT, 210, { width: 460, lineGap: 2 });

    let coverY = doc.y + 30;
    doc.moveTo(PAGE_LEFT, coverY).lineTo(PAGE_LEFT + 200, coverY).strokeColor("#ffffff").opacity(0.4).stroke();
    doc.opacity(1);
    coverY += 16;
    doc.fillOpacity(0.85).font("Helvetica").fontSize(9.5).fillColor("#ffffff");
    // width+height+ellipsis forces a single line with truncation instead of
    // wrapping into the next row's space for an unusually long name.
    const coverValueOpts = { width: 350, height: 14, ellipsis: true } as const;
    doc.text(`Prepared for`, PAGE_LEFT, coverY); doc.font("Helvetica-Bold").text(quotation.clientName, PAGE_LEFT + 90, coverY, coverValueOpts);
    coverY += 16;
    doc.font("Helvetica");
    if (quotation.preparedByName) { doc.text(`Prepared by`, PAGE_LEFT, coverY); doc.font("Helvetica-Bold").text(quotation.preparedByName, PAGE_LEFT + 90, coverY, coverValueOpts); doc.font("Helvetica"); coverY += 16; }
    doc.text(`Quotation No.`, PAGE_LEFT, coverY); doc.font("Helvetica-Bold").text(quotation.quotationNumber, PAGE_LEFT + 90, coverY); doc.font("Helvetica");
    coverY += 16;
    doc.text(`Issue Date`, PAGE_LEFT, coverY); doc.font("Helvetica-Bold").text(quotation.issueDate.toLocaleDateString("en-IN"), PAGE_LEFT + 90, coverY); doc.font("Helvetica");
    coverY += 16;
    if (quotation.validUntil) {
      doc.text(`Valid Until`, PAGE_LEFT, coverY); doc.font("Helvetica-Bold").text(quotation.validUntil.toLocaleDateString("en-IN"), PAGE_LEFT + 90, coverY); doc.font("Helvetica");
      coverY += 16;
    }
    doc.fillOpacity(1);

    // Contents index — one row per page that follows, in the same order.
    if (sections.length > 0) {
      const indexY = 560;
      doc.moveTo(PAGE_LEFT, indexY).lineTo(PAGE_RIGHT, indexY).strokeColor("#ffffff").opacity(0.3).stroke();
      doc.opacity(1);
      const colW = PAGE_WIDTH / sections.length;
      sections.forEach((label, i) => {
        const x = PAGE_LEFT + i * colW;
        doc.fillOpacity(0.6).fillColor("#ffffff").font("Helvetica-Bold").fontSize(14).text(String(i + 1).padStart(2, "0"), x, indexY + 16, { width: colW - 10 });
        doc.fillOpacity(0.85).font("Helvetica").fontSize(8.5).text(label, x, indexY + 36, { width: colW - 10 });
      });
      doc.fillOpacity(1);
    }

    const contactLines = [quotation.firm.address, quotation.firm.city].filter(Boolean).join(", ");
    doc.fillOpacity(0.55).font("Helvetica").fontSize(8).fillColor("#ffffff");
    let footY = 760;
    for (const line of [contactLines, quotation.firm.phone ? `Phone: ${quotation.firm.phone}` : null, quotation.firm.email]) {
      if (!line) continue;
      doc.text(line, PAGE_LEFT, footY, { width: 420 });
      footY += 12;
    }
    doc.fillOpacity(1);

    // ---- Page: Introduction ----
    if (hasIntroPage) {
      let y = beginSection("Introduction");

      if (quotation.introNote) {
        doc.font("Helvetica").fontSize(10).fillColor(INK).text(quotation.introNote, PAGE_LEFT, y, { width: PAGE_WIDTH, lineGap: 3 });
        y = doc.y + 30;
      }

      if (stats.length > 0) {
        y = subLabel(y, "Firm at a Glance");
        const colW = PAGE_WIDTH / stats.length;
        const boxH = 64;
        stats.forEach((s, i) => {
          const x = PAGE_LEFT + i * colW;
          doc.roundedRect(x, y, colW - 10, boxH, 6).fillAndStroke(SECONDARY, BORDER);
          doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(18).text(s.value, x, y + 14, { width: colW - 10, align: "center" });
          doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(s.label, x + 4, y + 40, { width: colW - 18, align: "center" });
        });
        y += boxH + 32;
      }

      if (quotation.aboutPoints.length > 0) {
        y = subLabel(y, "Why Choose Us");
        const colW = PAGE_WIDTH / 2;
        quotation.aboutPoints.forEach((p, i) => {
          const x = PAGE_LEFT + (i % 2) * colW;
          const rowY = y + Math.floor(i / 2) * 54;
          doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(p.title, x, rowY, { width: colW - 20 });
          doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(p.description, x, rowY + 14, { width: colW - 20 });
        });
      }
    }

    // ---- Page: Scope of Services ----
    if (quotation.scopeItems.length > 0) {
      let y = beginSection("Scope of Services");
      quotation.scopeItems.forEach((item, i) => {
        const descHeight = doc.font("Helvetica").fontSize(9).heightOfString(item.description, { width: PAGE_WIDTH - 74 });
        const boxH = Math.max(48, descHeight + 28);
        if (y + boxH > PAGE_BOTTOM - 20) { newPage(); y = 70; }
        doc.roundedRect(PAGE_LEFT, y, PAGE_WIDTH, boxH, 8).fillAndStroke(SECONDARY, BORDER);
        doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(16).text(String(i + 1).padStart(2, "0"), PAGE_LEFT + 16, y + boxH / 2 - 9, { width: 32 });
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(10.5).text(item.title, PAGE_LEFT + 58, y + 12, { width: PAGE_WIDTH - 76 });
        doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(item.description, PAGE_LEFT + 58, y + 27, { width: PAGE_WIDTH - 76 });
        y += boxH + 14;
      });
    }

    // ---- Page: Our Fee ----
    if (quotation.feeItems.length > 0) {
      let y = beginSection("Our Fee");
      doc.roundedRect(PAGE_LEFT, y, PAGE_WIDTH, 24, 6).fill(SECONDARY);
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8);
      doc.text("PARTICULARS", PAGE_LEFT + 14, y + 8);
      doc.text("FEE", 400, y + 8, { width: 70, align: "right" });
      doc.text("FREQUENCY", 470, y + 8, { width: 75, align: "right" });
      y += 24;
      doc.font("Helvetica").fontSize(10).fillColor(INK);
      const feeTotals = new Map<string, number>();
      quotation.feeItems.forEach((item) => {
        // A long particulars line wraps to 2+ lines — measure it so the row
        // is tall enough, otherwise the next row (or the divider) prints
        // straight over the wrapped text.
        const particularsHeight = doc.font("Helvetica").fontSize(10).heightOfString(item.particulars, { width: 335 });
        const rowH = Math.max(26, particularsHeight + 12);
        if (y + rowH > PAGE_BOTTOM - 20) { newPage(); y = 70; }
        feeTotals.set(item.frequency, (feeTotals.get(item.frequency) ?? 0) + item.fee);
        doc.fillColor(INK).text(item.particulars, PAGE_LEFT + 14, y + 8, { width: 335 });
        doc.text(fmtInr(item.fee), 400, y + 8, { width: 70, align: "right" });
        doc.fillColor(MUTED).text(item.frequency, 470, y + 8, { width: 75, align: "right" });
        y += rowH;
        doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).strokeColor(BORDER).stroke();
        y += 6;
      });
      y += 10;
      if (y + feeTotals.size * 18 > PAGE_BOTTOM - 20) { newPage(); y = 70; }
      for (const [freq, total] of feeTotals) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor(MUTED).text(`Total ${freq}:`, 340, y, { width: 130, align: "right" });
        doc.fillColor(PRIMARY).text(fmtInr(total), 470, y, { width: 75, align: "right" });
        y += 18;
      }
      y += 10;
      doc.font("Helvetica").fontSize(8).fillColor("#9ca3af").text("Fees stated are exclusive of applicable GST.", PAGE_LEFT, y);
    }

    // ---- Page: Terms & Signature ----
    if (quotation.termsItems.length > 0) {
      let y = beginSection("Terms & Signature");
      quotation.termsItems.forEach((t, i) => {
        doc.font("Helvetica-Bold").fontSize(9);
        const labelHeight = doc.heightOfString(t.label, { width: 115 });
        const descHeight = doc.font("Helvetica").fontSize(9).heightOfString(t.description, { width: PAGE_WIDTH - 155 });
        const rowH = Math.max(labelHeight, descHeight) + 14;
        if (y + rowH > PAGE_BOTTOM - 130) { newPage(); y = 70; }
        if (i % 2 === 1) doc.rect(PAGE_LEFT, y - 4, PAGE_WIDTH, rowH).fill(SECONDARY);
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(9).text(t.label, PAGE_LEFT + 12, y, { width: 115 });
        doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(t.description, PAGE_LEFT + 140, y, { width: PAGE_WIDTH - 155 });
        y += rowH;
      });

      // ---- Signature block ----
      const sigBoxH = 90;
      if (y + sigBoxH + 20 > PAGE_BOTTOM - 20) { newPage(); y = 70; }
      y += 24;
      doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).strokeColor(BORDER).stroke();
      y += 20;
      const halfW = PAGE_WIDTH / 2;
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(8).text("OFFERED BY", PAGE_LEFT, y, { characterSpacing: 0.5 });
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(8).text("ACCEPTED BY", PAGE_LEFT + halfW, y, { characterSpacing: 0.5 });
      y += 20;
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(quotation.preparedByName || quotation.firm.name, PAGE_LEFT, y, { width: halfW - 20 });
      doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(quotation.firm.name, PAGE_LEFT, y + 14, { width: halfW - 20 });
      doc.moveTo(PAGE_LEFT + halfW, y).lineTo(PAGE_RIGHT, y).strokeColor(BORDER).stroke();
      doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text("Name:", PAGE_LEFT + halfW, y + 10);
      doc.moveTo(PAGE_LEFT + halfW, y + 30).lineTo(PAGE_RIGHT, y + 30).strokeColor(BORDER).stroke();
      doc.text("Designation:", PAGE_LEFT + halfW, y + 34);
      doc.moveTo(PAGE_LEFT + halfW, y + 54).lineTo(PAGE_RIGHT, y + 54).strokeColor(BORDER).stroke();
      doc.text("Date:", PAGE_LEFT + halfW, y + 58);
    }

    footer();
    doc.end();
  });
}
