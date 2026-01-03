import { spawn } from "child_process";
import { writeFile, readFile, unlink, readdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

export type PdfQuality = "screen" | "ebook" | "printer" | "prepress";

export interface CompressOptions {
  quality: PdfQuality;
}

export interface SplitResult {
  buffer: Buffer<ArrayBuffer>;
  pageStart: number;
  pageEnd: number;
  filename: string;
}

/**
 * Check if Ghostscript is available on the system
 */
export async function isGhostscriptAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const gs = spawn("gs", ["--version"]);

    gs.on("error", () => {
      resolve(false);
    });

    gs.on("close", (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Get the number of pages in a PDF
 */
export async function getPdfPageCount(buffer: Buffer<ArrayBuffer>): Promise<number> {
  const tempId = randomBytes(8).toString("hex");
  const inputPath = join(tmpdir(), `input-${tempId}.pdf`);

  try {
    await writeFile(inputPath, buffer);

    return new Promise((resolve, reject) => {
      const gs = spawn("gs", [
        "-q",
        "-dNODISPLAY",
        "-dNOSAFER",
        "-c",
        `(${inputPath}) (r) file runpdfbegin pdfpagecount = quit`,
      ]);

      let output = "";
      let errorOutput = "";

      gs.stdout.on("data", (data) => {
        output += data.toString();
      });

      gs.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      gs.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Ghostscript failed: ${errorOutput}`));
          return;
        }

        const pageCount = parseInt(output.trim(), 10);
        if (isNaN(pageCount)) {
          reject(new Error(`Could not parse page count: ${output}`));
          return;
        }

        resolve(pageCount);
      });

      gs.on("error", (err) => {
        reject(err);
      });
    });
  } finally {
    try {
      await unlink(inputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Compress a PDF using Ghostscript
 *
 * Quality settings:
 * - screen: 72 dpi, smallest file size (web viewing)
 * - ebook: 150 dpi, good balance (recommended)
 * - printer: 300 dpi, high quality
 * - prepress: 300 dpi, minimal compression
 */
export async function compressPdf(
  buffer: Buffer<ArrayBuffer>,
  options: CompressOptions = { quality: "ebook" }
): Promise<Buffer<ArrayBuffer>> {
  const tempId = randomBytes(8).toString("hex");
  const inputPath = join(tmpdir(), `input-${tempId}.pdf`);
  const outputPath = join(tmpdir(), `output-${tempId}.pdf`);

  try {
    await writeFile(inputPath, buffer);

    await new Promise<void>((resolve, reject) => {
      const gs = spawn("gs", [
        "-sDEVICE=pdfwrite",
        `-dPDFSETTINGS=/${options.quality}`,
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dCompatibilityLevel=1.4",
        `-sOutputFile=${outputPath}`,
        inputPath,
      ]);

      let errorOutput = "";

      gs.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      gs.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Ghostscript compression failed: ${errorOutput}`));
          return;
        }
        resolve();
      });

      gs.on("error", (err) => {
        reject(err);
      });
    });

    return (await readFile(outputPath)) as Buffer<ArrayBuffer>;
  } finally {
    // Cleanup temp files
    try {
      await unlink(inputPath);
    } catch {
      // Ignore
    }
    try {
      await unlink(outputPath);
    } catch {
      // Ignore
    }
  }
}

/**
 * Split a PDF into multiple parts by page ranges
 */
export async function splitPdfByPages(
  buffer: Buffer<ArrayBuffer>,
  pagesPerPart: number,
  originalFilename: string
): Promise<SplitResult[]> {
  const tempId = randomBytes(8).toString("hex");
  const inputPath = join(tmpdir(), `input-${tempId}.pdf`);
  const outputDir = tmpdir();
  const outputPrefix = `split-${tempId}`;

  try {
    await writeFile(inputPath, buffer);

    // Get total page count
    const totalPages = await getPdfPageCount(buffer);
    const results: SplitResult[] = [];

    // Calculate number of parts
    const numParts = Math.ceil(totalPages / pagesPerPart);

    // Extract base name without extension
    const baseName = originalFilename.replace(/\.pdf$/i, "");

    for (let i = 0; i < numParts; i++) {
      const startPage = i * pagesPerPart + 1;
      const endPage = Math.min((i + 1) * pagesPerPart, totalPages);
      const outputPath = join(outputDir, `${outputPrefix}-part${i + 1}.pdf`);

      await new Promise<void>((resolve, reject) => {
        const gs = spawn("gs", [
          "-sDEVICE=pdfwrite",
          "-dNOPAUSE",
          "-dQUIET",
          "-dBATCH",
          `-dFirstPage=${startPage}`,
          `-dLastPage=${endPage}`,
          `-sOutputFile=${outputPath}`,
          inputPath,
        ]);

        let errorOutput = "";

        gs.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        gs.on("close", (code) => {
          if (code !== 0) {
            reject(new Error(`Ghostscript split failed: ${errorOutput}`));
            return;
          }
          resolve();
        });

        gs.on("error", (err) => {
          reject(err);
        });
      });

      const partBuffer = (await readFile(outputPath)) as Buffer<ArrayBuffer>;

      results.push({
        buffer: partBuffer,
        pageStart: startPage,
        pageEnd: endPage,
        filename: `${baseName}_part${i + 1}_pages${startPage}-${endPage}.pdf`,
      });

      // Cleanup this part's output file
      try {
        await unlink(outputPath);
      } catch {
        // Ignore
      }
    }

    return results;
  } finally {
    // Cleanup input file
    try {
      await unlink(inputPath);
    } catch {
      // Ignore
    }
  }
}

/**
 * Get PDF file size in MB
 */
export function getFileSizeMB(buffer: Buffer<ArrayBuffer>): number {
  return buffer.length / (1024 * 1024);
}

/**
 * Check if a PDF needs splitting based on size limit
 */
export function needsSplitting(buffer: Buffer<ArrayBuffer>, maxSizeMB: number = 100): boolean {
  return getFileSizeMB(buffer) > maxSizeMB;
}
