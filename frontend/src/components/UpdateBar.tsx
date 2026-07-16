import { useState } from "react";
import { applyUpdate, checkForUpdate } from "../api";

type Status =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "up-to-date" }
  | { state: "available"; local: string; remote: string }
  | { state: "updating" }
  | { state: "restarting" }
  | { state: "error"; message: string };

async function waitForBackend(): Promise<void> {
  // update.ps1 stops the backend as its first step, so briefly it's down.
  // Poll /api/health until it answers again, then reload to pick up any
  // frontend changes too.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        window.location.reload();
        return;
      }
    } catch {
      // backend still down or restarting — keep polling
    }
  }
}

export default function UpdateBar() {
  const [status, setStatus] = useState<Status>({ state: "idle" });

  const check = async () => {
    setStatus({ state: "checking" });
    try {
      const result = await checkForUpdate();
      if (result.error) {
        setStatus({ state: "error", message: result.error });
      } else if (result.update_available) {
        setStatus({
          state: "available",
          local: result.local ?? "?",
          remote: result.remote ?? "?",
        });
      } else {
        setStatus({ state: "up-to-date" });
        setTimeout(() => setStatus({ state: "idle" }), 3000);
      }
    } catch {
      setStatus({ state: "error", message: "Could not reach the backend." });
    }
  };

  const update = async () => {
    setStatus({ state: "updating" });
    try {
      await applyUpdate();
      setStatus({ state: "restarting" });
      await waitForBackend();
    } catch {
      setStatus({ state: "error", message: "Could not start the update." });
    }
  };

  return (
    <div className="update-bar">
      {status.state === "idle" && (
        <button className="link-btn" onClick={check}>
          Check for updates
        </button>
      )}
      {status.state === "checking" && <span>Checking for updates…</span>}
      {status.state === "up-to-date" && <span>You're up to date.</span>}
      {status.state === "available" && (
        <span>
          Update available ({status.local} → {status.remote}){" "}
          <button className="link-btn" onClick={update}>
            Update now
          </button>
        </span>
      )}
      {status.state === "updating" && <span>Starting update…</span>}
      {status.state === "restarting" && (
        <span>Restarting with the update — this page will reload automatically…</span>
      )}
      {status.state === "error" && (
        <span>
          {status.message}{" "}
          <button className="link-btn" onClick={check}>
            Retry
          </button>
        </span>
      )}
    </div>
  );
}
