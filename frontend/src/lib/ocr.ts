import { createWorker } from "tesseract.js";

export type OcrProgress = { status: string; progress: number };

export async function extractTextFromImage(
  file: File,
  onProgress?: (p: OcrProgress) => void
): Promise<string> {
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (onProgress) onProgress({ status: m.status, progress: m.progress ?? 0 });
    },
  });

  try {
    const {
      data: { text },
    } = await worker.recognize(file);
    return text.trim();
  } finally {
    await worker.terminate();
  }
}
