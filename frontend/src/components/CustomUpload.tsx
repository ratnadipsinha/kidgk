import { useRef, useState } from "react";
import type { Question } from "../lib/types";
import { extractTextFromImage } from "../lib/ocr";
import { generateQuestionsFromText } from "../lib/customQuestions";
import { generateQuestionsFromImage, geminiConfigured } from "../lib/geminiVision";

type Props = {
  grade: number;
  onReady: (questions: Question[]) => void;
  onCancel: () => void;
};

type Stage =
  | { step: "idle" }
  | { step: "reading" }
  | { step: "ocr"; progress: number }
  | { step: "generating" }
  | { step: "error"; message: string };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export default function CustomUpload({ grade, onReady, onCancel }: Props) {
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setPreview(URL.createObjectURL(file));
    try {
      // Preferred path: send the image straight to Gemini's vision model,
      // which reads the page's real layout and content far better than OCR.
      if (geminiConfigured()) {
        setStage({ step: "reading" });
        const dataUrl = await readAsDataUrl(file);
        const questions = await generateQuestionsFromImage(dataUrl, grade, 5);
        onReady(questions);
        return;
      }

      // Fallback (no Gemini key configured): OCR the text, then use Groq.
      setStage({ step: "ocr", progress: 0 });
      const text = await extractTextFromImage(file, (p) => {
        if (p.status === "recognizing text") {
          setStage({ step: "ocr", progress: p.progress });
        }
      });
      setStage({ step: "generating" });
      const questions = await generateQuestionsFromText(text, grade, 5);
      onReady(questions);
    } catch (e) {
      setStage({
        step: "error",
        message: e instanceof Error ? e.message : "Something went wrong reading that image.",
      });
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="custom-upload">
      <div className="custom-upload-label">Upload a photo of a page, notes, or a diagram</div>

      {preview && <img src={preview} alt="" className="custom-upload-preview" />}

      {stage.step === "idle" && (
        <>
          <button
            type="button"
            className="primary"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose a photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={onFileChange}
          />
        </>
      )}

      {stage.step === "reading" && (
        <div className="custom-upload-status">Reading the page…</div>
      )}

      {stage.step === "ocr" && (
        <div className="custom-upload-status">
          Reading the photo… {Math.round(stage.progress * 100)}%
        </div>
      )}

      {stage.step === "generating" && (
        <div className="custom-upload-status">Building your questions…</div>
      )}

      {stage.step === "error" && (
        <div className="custom-upload-status custom-upload-error">
          {stage.message}
        </div>
      )}

      <button type="button" className="ghost" onClick={onCancel}>
        Back
      </button>
    </div>
  );
}
