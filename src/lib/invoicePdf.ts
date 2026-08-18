import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { amountToWordsInr, buildUpiLink } from "@/lib/invoice";
import { sanitizeBrandColor, lightenHex } from "@/lib/color";

type InvoicePdfData = {
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date | null;
  paymentTerms: string | null;
  discountType: string | null;
  discountValue: number;
  discountAmount: number;
  applyGst: boolean;
  gstType: string | null;
  gstRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  firm: {
    name: string; gstin: string | null; pan: string | null; address: string | null; city: string | null;
    phone: string | null; email: string | null; website: string | null;
    bankName: string | null; bankAccountName: string | null; bankAccountNo: string | null; bankIfsc: string | null;
    upiId: string | null; showCaTagline: boolean; brandColor: string;
  };
  client: { name: string; gstin: string | null; pan: string | null };
  items: { description: string; quantity: number; rate: number; amount: number }[];
  paymentLinkUrl?: string | null;
};

// Neutral palette matches the on-screen invoice design (see InvoiceDocument.tsx);
// PRIMARY/PRIMARY_LIGHT are derived per-firm from their chosen brand color.
const SECONDARY = "#F8FAFC";
const INK = "#334155";
const MUTED = "#64748b";
const BORDER = "#E5E7EB";
const SUCCESS = "#16A34A";
const PAGE_LEFT = 50;
const PAGE_RIGHT = 545;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;

function statusColors(primary: string, primaryLight: string): Record<string, { bg: string; fg: string }> {
  return {
    DRAFT: { bg: "#f1f5f9", fg: "#475569" },
    SENT: { bg: primaryLight, fg: primary },
    PAID: { bg: "#f0fdf4", fg: SUCCESS },
    OVERDUE: { bg: "#fef2f2", fg: "#dc2626" },
    CANCELLED: { bg: "#f1f5f9", fg: "#94a3b8" },
  };
}

function formatInr(n: number): string {
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function firmInitials(name: string): string {
  const words = name.replace(/[^\w\s&]/g, "").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
}

/** Renders a premium, GST-aware invoice as a PDF and resolves with the bytes. */
export async function renderInvoicePdf(invoice: InvoicePdfData): Promise<Buffer> {
  const PRIMARY = sanitizeBrandColor(invoice.firm.brandColor);
  const PRIMARY_LIGHT = lightenHex(PRIMARY, 0.9);
  const STATUS_COLOR = statusColors(PRIMARY, PRIMARY_LIGHT);

  const qrBuffer = invoice.firm.upiId
    ? await QRCode.toBuffer(
        buildUpiLink({ upiId: invoice.firm.upiId, payeeName: invoice.firm.name, amount: invoice.total, note: invoice.invoiceNumber }),
        { margin: 1, width: 200 }
      )
    : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ---- Header ----
    let y = 44;
    doc.roundedRect(PAGE_LEFT, y, 36, 36, 8).fill(PRIMARY);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(13).text(firmInitials(invoice.firm.name), PAGE_LEFT, y + 11, { width: 36, align: "center" });

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(14).text(invoice.firm.name, PAGE_LEFT + 46, y, { width: 260 });
    if (invoice.firm.showCaTagline) {
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(8.5).text("CHARTERED ACCOUNTANTS", PAGE_LEFT + 46, y + 17, { width: 260, characterSpacing: 0.5 });
    }

    let leftY = y + (invoice.firm.showCaTagline ? 32 : 20);
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5);
    const addrLine = [invoice.firm.address, invoice.firm.city].filter(Boolean).join(", ");
    for (const line of [
      addrLine,
      invoice.firm.phone ? `Phone: ${invoice.firm.phone}` : null,
      invoice.firm.email ? `Email: ${invoice.firm.email}` : null,
      invoice.firm.website,
      invoice.firm.gstin ? `GSTIN: ${invoice.firm.gstin}` : null,
      invoice.firm.pan ? `PAN: ${invoice.firm.pan}` : null,
    ]) {
      if (!line) continue;
      doc.text(line, PAGE_LEFT + 46, leftY, { width: 260 });
      leftY += 11.5;
    }

    doc.fillColor(INK).font("Helvetica-Bold").fontSize(18).text(invoice.applyGst ? "TAX INVOICE" : "INVOICE", PAGE_LEFT, y, { width: PAGE_WIDTH, align: "right" });
    doc.fillColor(MUTED).font("Helvetica").fontSize(9.5).text(invoice.invoiceNumber, PAGE_LEFT, y + 21, { width: PAGE_WIDTH, align: "right" });
    doc.fontSize(8).text(`Issue Date: ${invoice.issueDate.toLocaleDateString("en-IN")}`, PAGE_LEFT, y + 37, { width: PAGE_WIDTH, align: "right" });
    doc.text(`Due Date: ${invoice.dueDate ? invoice.dueDate.toLocaleDateString("en-IN") : "—"}`, PAGE_LEFT, y + 48, { width: PAGE_WIDTH, align: "right" });

    const statusColor = STATUS_COLOR[invoice.status] ?? STATUS_COLOR.DRAFT;
    const badgeWidth = 70;
    doc.roundedRect(PAGE_RIGHT - badgeWidth, y + 62, badgeWidth, 16, 8).fill(statusColor.bg);
    doc.fillColor(statusColor.fg).font("Helvetica-Bold").fontSize(8).text(invoice.status, PAGE_RIGHT - badgeWidth, y + 66, { width: badgeWidth, align: "center" });

    y = Math.max(leftY, y + 90) + 14;
    doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).strokeColor(BORDER).stroke();
    y += 20;

    // ---- Bill To / Invoice Details cards ----
    const cardW = (PAGE_WIDTH - 16) / 2;
    const cardH = 92;
    doc.roundedRect(PAGE_LEFT, y, cardW, cardH, 8).fillAndStroke(SECONDARY, BORDER);
    doc.roundedRect(PAGE_LEFT + cardW + 16, y, cardW, cardH, 8).fillAndStroke(SECONDARY, BORDER);

    doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(7.5).text("BILL TO", PAGE_LEFT + 14, y + 12, { characterSpacing: 0.5 });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(invoice.client.name, PAGE_LEFT + 14, y + 26, { width: cardW - 28 });
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5);
    let clientY = y + 44;
    if (invoice.client.gstin) { doc.text(`GSTIN: ${invoice.client.gstin}`, PAGE_LEFT + 14, clientY); clientY += 12; }
    if (invoice.client.pan) { doc.text(`PAN: ${invoice.client.pan}`, PAGE_LEFT + 14, clientY); }

    const detailX = PAGE_LEFT + cardW + 30;
    doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(7.5).text("INVOICE DETAILS", detailX, y + 12, { characterSpacing: 0.5 });
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5);
    doc.text("Issue Date", detailX, y + 28); doc.fillColor(INK).text(invoice.issueDate.toLocaleDateString("en-IN"), detailX + 100, y + 28);
    doc.fillColor(MUTED).text("Due Date", detailX, y + 44); doc.fillColor(INK).text(invoice.dueDate ? invoice.dueDate.toLocaleDateString("en-IN") : "—", detailX + 100, y + 44);
    doc.fillColor(MUTED).text("Payment Terms", detailX, y + 60); doc.fillColor(INK).text(invoice.paymentTerms || "—", detailX + 100, y + 60, { width: cardW - 130 });

    y += cardH + 22;

    // ---- Line items table ----
    const col = { desc: PAGE_LEFT + 12, qty: 330, rate: 385, amount: 460 };
    doc.roundedRect(PAGE_LEFT, y, PAGE_WIDTH, 24, 6).fill(SECONDARY);
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7.5);
    doc.text("DESCRIPTION", col.desc, y + 8, { characterSpacing: 0.4 });
    doc.text("QTY", col.qty, y + 8);
    doc.text("RATE", col.rate, y + 8);
    doc.text("AMOUNT", col.amount, y + 8, { width: 75, align: "right" });
    y += 24;

    doc.font("Helvetica").fontSize(9.5).fillColor(INK);
    invoice.items.forEach((item) => {
      const lineCount = item.description.split("\n").length;
      const rowHeight = 20 + (lineCount - 1) * 11;
      doc.text(item.description, col.desc, y + 6, { width: 300 });
      doc.text(String(item.quantity), col.qty, y + 6);
      doc.text(formatInr(item.rate), col.rate, y + 6);
      doc.text(formatInr(item.amount), col.amount, y + 6, { width: 75, align: "right" });
      y += rowHeight;
      doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).strokeColor(BORDER).stroke();
      y += 4;
    });
    y += 10;

    // ---- Totals ----
    const totalsX = 350;
    function totalLine(label: string, value: string, opts: { bold?: boolean } = {}) {
      doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.bold ? 12 : 9.5);
      doc.fillColor(opts.bold ? INK : MUTED);
      doc.text(label, totalsX, y, { width: 105 });
      doc.fillColor(opts.bold ? PRIMARY : MUTED);
      doc.text(value, col.amount, y, { width: 75, align: "right" });
      y += opts.bold ? 20 : 15;
    }
    totalLine("Subtotal", formatInr(invoice.subtotal));
    if (invoice.discountAmount > 0) {
      const label = invoice.discountType === "PERCENT" ? `Discount (${invoice.discountValue}%)` : "Discount";
      totalLine(label, `- ${formatInr(invoice.discountAmount)}`);
    }
    if (invoice.applyGst) {
      if (invoice.gstType === "INTER") {
        totalLine(`IGST (${invoice.gstRate}%)`, formatInr(invoice.taxAmount));
      } else {
        totalLine(`CGST (${invoice.gstRate / 2}%)`, formatInr(invoice.taxAmount / 2));
        totalLine(`SGST (${invoice.gstRate / 2}%)`, formatInr(invoice.taxAmount / 2));
      }
    }
    doc.moveTo(totalsX, y).lineTo(PAGE_RIGHT, y).strokeColor(BORDER).stroke();
    y += 8;
    totalLine("Total", formatInr(invoice.total), { bold: true });

    y += 4;
    doc.roundedRect(totalsX - 20, y, PAGE_RIGHT - (totalsX - 20), 26, 6).fill(SECONDARY);
    doc.font("Helvetica-Oblique").fontSize(7.5).fillColor(MUTED).text(amountToWordsInr(invoice.total), totalsX - 12, y + 8, { width: PAGE_RIGHT - totalsX });
    y += 40;

    // ---- Pay Now button ----
    if (invoice.paymentLinkUrl && (invoice.status === "SENT" || invoice.status === "OVERDUE")) {
      const btnW = 160, btnH = 30;
      doc.roundedRect(PAGE_RIGHT - btnW, y, btnW, btnH, 6).fill(PRIMARY);
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9.5)
        .text(`Pay ${formatInr(invoice.total)} Now`, PAGE_RIGHT - btnW, y + 10, { width: btnW, align: "center", link: invoice.paymentLinkUrl, underline: false });
      y += btnH + 16;
    }

    // ---- Payment details ----
    const hasBank = invoice.firm.bankName || invoice.firm.bankAccountNo || invoice.firm.upiId;
    if (hasBank) {
      const boxH = 92;
      doc.roundedRect(PAGE_LEFT, y, PAGE_WIDTH, boxH, 8).strokeColor(BORDER).lineWidth(1).stroke();
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(7.5).text("PAYMENT DETAILS", PAGE_LEFT + 14, y + 12, { characterSpacing: 0.5 });
      doc.font("Helvetica").fontSize(8.5).fillColor(INK);
      let by = y + 27;
      if (invoice.firm.bankAccountName) { doc.text(`A/c Name: ${invoice.firm.bankAccountName}`, PAGE_LEFT + 14, by); by += 13; }
      if (invoice.firm.bankName) { doc.text(`Bank: ${invoice.firm.bankName}`, PAGE_LEFT + 14, by); by += 13; }
      if (invoice.firm.bankAccountNo) { doc.text(`A/c No: ${invoice.firm.bankAccountNo}`, PAGE_LEFT + 14, by); by += 13; }
      if (invoice.firm.bankIfsc) { doc.text(`IFSC: ${invoice.firm.bankIfsc}`, PAGE_LEFT + 14, by); by += 13; }
      if (invoice.firm.upiId) { doc.text(`UPI ID: ${invoice.firm.upiId}`, PAGE_LEFT + 14, by); }

      if (qrBuffer) {
        doc.image(qrBuffer, PAGE_RIGHT - 78, y + 10, { width: 68, height: 68 });
        doc.font("Helvetica").fontSize(6.5).fillColor(MUTED).text("Scan to pay via UPI", PAGE_RIGHT - 78, y + 80, { width: 68, align: "center" });
      }
      y += boxH + 16;
    }

    // ---- Notes ----
    doc.roundedRect(PAGE_LEFT, y, PAGE_WIDTH, 40, 8).fill(SECONDARY);
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(invoice.notes || "Thank you for your business.", PAGE_LEFT + 14, y + 14, { width: PAGE_WIDTH - 28 });

    doc.font("Helvetica").fontSize(7.5).fillColor("#9ca3af")
      .text("This is a computer-generated invoice. No signature required.", PAGE_LEFT, 790, { align: "center", width: PAGE_WIDTH });

    doc.end();
  });
}
