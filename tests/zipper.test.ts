import { describe, expect, it } from "vitest";
import { zipFile, zipFileName } from "../src/lib/zipper.js";

/** Minimal File stand-in (node 18 has no global File). */
class FakeFile extends Blob {
  name: string;
  lastModified = 0;
  webkitRelativePath = "";
  constructor(parts: BlobPart[], name: string) {
    super(parts);
    this.name = name;
  }
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

describe("zipFile", () => {
  it("produces a valid ZIP blob (PK magic bytes)", async () => {
    const file = new FakeFile([new Uint8Array([1, 2, 3, 4])], "2.stp");
    const blob = await zipFile(file);
    expect(blob.type).toBe("application/zip");
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    expect([...head]).toEqual(ZIP_MAGIC);
  });

  it("contains exactly one entry named after the original file", async () => {
    const file = new FakeFile([new TextEncoder().encode("cad-data")], "model.step");
    const blob = await zipFile(file);
    const buffer = await blob.arrayBuffer();
    // Find the local file header name (after PK\x03\x04 + fixed fields):
    // entry name is stored as UTF-8 right after the 30-byte local header.
    const bytes = new Uint8Array(buffer);
    const nameLen = bytes[26] | (bytes[27] << 8);
    const nameBytes = bytes.slice(30, 30 + nameLen);
    expect(new TextDecoder().decode(nameBytes)).toBe("model.step");
  });

  it("supports UTF-8 file names", async () => {
    const file = new FakeFile([new TextEncoder().encode("x")], "图纸.dwg");
    const blob = await zipFile(file);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const nameLen = bytes[26] | (bytes[27] << 8);
    const nameBytes = bytes.slice(30, 30 + nameLen);
    expect(new TextDecoder().decode(nameBytes)).toBe("图纸.dwg");
  });

  it("round-trips content through a ZIP reader", async () => {
    const content = "hello mailzip";
    const file = new FakeFile([new TextEncoder().encode(content)], "a.dxf");
    const blob = await zipFile(file);
    // JSZip itself can read back what it produced. (Node has no FileReader,
    // so pass an ArrayBuffer to loadAsync.)
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const entry = zip.file("a.dxf");
    expect(entry).not.toBeNull();
    expect(await entry!.async("text")).toBe(content);
  });
});

describe("zipFileName", () => {
  it("appends .zip", () => {
    expect(zipFileName("2.stp")).toBe("2.stp.zip");
  });
});
