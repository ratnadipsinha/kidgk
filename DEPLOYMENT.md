# KidGK — Deployment & Update Mechanism

How code gets from this dev machine ("source") onto a target PC, how the
one-click installer works, and how updates flow afterward.

---

## 1. The three machines involved

| Machine | Role |
|---|---|
| **Source PC** | This dev machine. Code is written and tested here, then pushed to GitHub. |
| **GitHub** (`<your-repo-url>`) | The single source of truth. Holds all source code. Does nothing on its own — no CI, no notifications, purely passive storage. |
| **Target PC** | Wherever the app actually runs day-to-day (a kid's PC). Gets set up once via the installer, then stays in sync by pulling from GitHub on demand. |

Nothing pushes *to* a target PC. It's one-way: **source → GitHub → target pulls when asked.**

---

## 2. Building the installer (on the source PC)

`installer/kidgk-setup.iss` is an [Inno Setup](https://jrsoftware.org/isinfo.php)
script. Compiling it (`ISCC.exe installer\kidgk-setup.iss`) produces
`installer/output/KidGK-Setup.exe` — a single ~120MB file that bundles:

- The full app source (`backend/`, `frontend/`, `scripts/`) — a snapshot of
  whatever was committed at build time
- Three prerequisite installers: Git for Windows, Python 3.12, Node.js LTS
  (downloaded once into `installer/vendor/`, gitignored — too large for
  GitHub and not needed in version control)
- `post-install.ps1` — the script that wires everything up after files are
  copied

The Groq API key is baked into the `.iss` file as a plain-text constant and
ends up embedded in the compiled `.exe` (extractable via a hex dump/strings
search). This is a deliberate tradeoff for a true one-click install — see
the security note in `installer/README.md`. **Only hand this `.exe` to
machines you personally control.**

Neither `installer/vendor/` nor `installer/output/` are committed to git —
both are gitignored, both are rebuilt locally whenever needed.

---

## 3. Running the installer (on a target PC)

Double-clicking `KidGK-Setup.exe` triggers a UAC prompt (it needs admin —
installing to `Program Files` and writing shortcuts requires it), then runs
unattended:

```
1. Check prerequisites, skip what's already there
   ├─ NeedsGit()    → git on PATH or at C:\Program Files\Git\cmd\git.exe?
   ├─ NeedsPython() → python on PATH or at C:\Program Files\Python312\?
   └─ NeedsNode()   → node on PATH or at C:\Program Files\nodejs\?
   Only the missing ones get silently installed.

2. Copy the bundled app snapshot to %ProgramFiles%\KidGK

3. Run post-install.ps1, which:
   a. git init (if needed) + git remote add origin <repo URL>
   b. git fetch + git checkout -B main origin/main
      → aligns the installed copy with the CURRENT state of GitHub,
        not just the snapshot baked into the .exe at build time
        (falls back to the bundled snapshot if there's no internet yet)
   c. Creates backend\.venv, installs Python dependencies
   d. Writes backend\.env with the baked-in GROQ_API_KEY
   e. Installs frontend dependencies (npm install)

4. Inno Setup's [Icons] section creates a Desktop + Start Menu shortcut
   named "KidGK", pointing at scripts\launch.ps1
```

Nothing is started automatically at the end of setup, and nothing is
registered to auto-start at login. The app only runs when launched.

---

## 4. Playing it (launch-on-demand)

The "KidGK" shortcut runs `scripts\launch.ps1`:

```
launch.ps1
  ├─ start-app.ps1
  │    ├─ starts backend:  .venv\Scripts\python.exe -m uvicorn main:app --port 8000
  │    ├─ starts frontend: node frontend\node_modules\vite\bin\vite.js --port 5173
  │    └─ writes each PID to .run\backend.pid / .run\frontend.pid
  ├─ waits for the backend to answer on :8000 (raw TCP check)
  ├─ opens the app in a dedicated Edge/Chrome window
  │    (--app mode: no tabs, no address bar, isolated browser profile)
  ├─ blocks until that window's process exits
  └─ on exit: stop-app.ps1 (kills both PIDs from the .run\ files)
```

**Closing the app window is the entire "stop" mechanism.** There's no
tray icon, no auto-start-at-login task, nothing running silently between
sessions. If the PC is shut down or restarted instead, Windows kills the
processes anyway — same end state either way.

Two things had to be fixed to make this actually work (see
`installer/README.md` for the full list of bugs found while testing):
`npm run dev`/`vite.cmd` are batch wrappers that don't forward kill
signals on Windows (fixed by launching `node vite.js` directly), and
`Invoke-WebRequest` can hang against a perfectly reachable `localhost`
endpoint under Windows PowerShell 5.1 (fixed with a raw socket check
instead).

---

## 5. Updating (on-demand, not automatic polling)

There is **no scheduled task, no 15-minute polling loop**. Updates are
pulled only when asked for, via the "Check for updates" control in the
app's footer:

```
Frontend                    Backend                         Behind the scenes
─────────                   ───────                         ─────────────────
"Check for updates"  →  GET /api/update/check
                             ├─ git fetch origin
                             └─ compare local HEAD vs origin/main
                         ←  { update_available, local, remote }

"Update now"          →  POST /api/update/apply
                             └─ spawns scripts\update.ps1 as a
                                background process, returns
                                immediately ("status": "started")

                         scripts\update.ps1 (running independently):
                             ├─ stop-app.ps1        (kills this very
                             │                        backend process —
                             │                        already responded,
                             │                        so that's fine)
                             ├─ git pull origin main
                             ├─ reinstall changed deps (pip / npm)
                             └─ start-app.ps1        (restarts with the
                                                       new code)

Frontend polls /api/health every 2s until it answers again, then
reloads the page automatically.
```

The update-check is also how the initial installer wiring in step 3b
matters: without a properly linked git remote, `git fetch` in
`update.ps1` would have nothing to compare against.

**Why not a background process that outlives the request?** The first
version of `POST /api/update/apply` launched `update.ps1` with
`DETACHED_PROCESS`, intending for it to survive its own backend process
being killed. That flag turned out to make `powershell.exe` exit
immediately without running anything — the button appeared to work but
silently did nothing. The fix: no special flags at all. `Stop-Process
-Force` (what `stop-app.ps1` uses) never cascades to child processes on
Windows, so a plain background process already survives its parent being
killed.

---

## 6. Content fallback chain (separate from the update mechanism)

Not related to app *updates*, but worth noting since it's a similar
"try live, fall back gracefully" pattern: every quiz round tries three
tiers in order — **Groq** (fresh AI-generated questions, cached per
category+grade) → **Wikipedia** (simple fact-matching questions built
from curated article summaries, used if Groq is down or rate-limited) →
**static offline bank** (5 hand-written questions per category, last
resort, always available with zero network dependency).

---

## 7. Quick reference

| Task | Command |
|---|---|
| Build the installer | `ISCC.exe installer\kidgk-setup.iss` |
| Manual setup (no installer, e.g. for dev) | `scripts\setup.ps1` |
| Start without the browser window | `scripts\start-app.ps1` |
| Stop | `scripts\stop-app.ps1` |
| Play (recommended) | `scripts\launch.ps1`, or the "KidGK" shortcut |
| Manual update check | `scripts\update.ps1` |
