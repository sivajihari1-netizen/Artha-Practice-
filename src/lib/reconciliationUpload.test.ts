import { describe, expect, it } from "vitest";
import { isAcceptedExtension, MAX_UPLOAD_SIZE_BYTES, sourceAAccept, SOURCE_B_ACCEPT } from "./reconciliationUpload";

describe("sourceAAccept — verified upload-format support", () => {
  it("GST_2B_VS_PURCHASE accepts CSV, Excel, and JSON (the one genuinely supported JSON path)", () => {
    expect(sourceAAccept("GST_2B_VS_PURCHASE")).toBe(".csv,.xlsx,.xls,.json");
  });

  it("GST_1_VS_SALES does NOT accept JSON — no GSTR-1-specific parser exists", () => {
    expect(sourceAAccept("GST_1_VS_SALES")).toBe(".csv,.xlsx,.xls");
  });

  it("BANK_VS_BOOKS does NOT accept JSON — matches the backend's own allowJsonA = type !== BANK_VS_BOOKS", () => {
    expect(sourceAAccept("BANK_VS_BOOKS")).toBe(".csv,.xlsx,.xls");
  });
});

describe("SOURCE_B_ACCEPT", () => {
  it("never includes JSON, for any type", () => {
    expect(SOURCE_B_ACCEPT).toBe(".csv,.xlsx,.xls");
    expect(SOURCE_B_ACCEPT).not.toContain("json");
  });
});

describe("isAcceptedExtension", () => {
  it("accepts a matching extension, case-insensitively", () => {
    expect(isAcceptedExtension("Purchase.CSV", ".csv,.xlsx,.xls")).toBe(true);
  });

  it("rejects a non-matching extension", () => {
    expect(isAcceptedExtension("statement.pdf", ".csv,.xlsx,.xls")).toBe(false);
  });

  it("rejects .json against the source-B accept list", () => {
    expect(isAcceptedExtension("books.json", SOURCE_B_ACCEPT)).toBe(false);
  });

  it("accepts .json against the GST_2B_VS_PURCHASE source-A accept list", () => {
    expect(isAcceptedExtension("gstr2b.json", sourceAAccept("GST_2B_VS_PURCHASE"))).toBe(true);
  });
});

describe("MAX_UPLOAD_SIZE_BYTES", () => {
  it("matches the backend's own 10MB cap exactly", () => {
    expect(MAX_UPLOAD_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
