import { useRef, useState } from "react";
import type { Question } from "../lib/types";
import { extractTextFromImage } from "../lib/ocr";
import { generateQuestionsFromText } from "../lib/customQuestions";
import { generateQuestionsFromImage, geminiConfigured } from "../lib/geminiVision";
import { setGeminiKey } from "../lib/config";

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
  const [hasKey, setHasKey] = useState(geminiConfigured());
  const [keyInput, setKeyInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveKey = () => {
    const k = keyInput.trim();
    if (k.length < 10) return;
    setGeminiKey(k);
    setHasKey(true);
  };

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
      const msg = e instanceof Error ? e.message : "Something went wrong reading that image.";
      // A 403 (leaked/invalid/permission) means the saved key is bad - send
      // the user back to the key screen to enter a fresh one.
      if (/403|API key|PERMISSION_DENIED|not configured/i.test(msg)) {
        setHasKey(false);
        setStage({ step: "idle" });
        setPreview(null);
        return;
      }
      setStage({ step: "error", message: msg });
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // One-time setup: a Gemini key can't be shipped in this public app (Google
  // auto-revokes committed keys), so each user provides their own once. It's
  // saved in this browser only.
  if (!hasKey) {
    return (
      <div className="custom-upload">
        <div className="custom-upload-label">
          The Custom quiz reads your photo with Google Gemini. Paste a free Gemini
          API key once to turn it on — it's saved only in this browser.
        </div>
        <ol className="key-steps">
          <li>
            Open{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>{" "}
            and sign in with Google.
          </li>
          <li>Click “Create API key”, then copy it.</li>
          <li>Paste it below.</li>
        </ol>
        <input
          type="password"
          className="key-input"
          placeholder="Paste your Gemini API key (AIza…)"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
        />
        <div className="actions">
          <button className="primary" disabled={keyInput.trim().length < 10} onClick={saveKey}>
            Save &amp; continue
          </button>
          <button className="ghost" onClick={onCancel}>
            Back
          </button>
        </div>
      </div>
    );
  }

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
