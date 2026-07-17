# KidGK one-click installer

Builds `KidGK-Setup.exe` — a self-contained Windows installer that bundles
Git and Python (so the target PC needs nothing pre-installed — Node.js is
NOT required, the frontend is a pre-built static bundle served by the
Python backend), copies the app, writes `backend\.env` with a baked-in
Groq key, installs Python dependencies, and adds a Desktop/Start Menu
shortcut that launches the app on demand and stops it when its window is
closed.

**Security note:** the Groq API key is embedded in `kidgk-setup.iss` as
plain text and ends up extractable from the compiled `.exe` (strings/hex
dump). Only hand this installer to machines you personally control — never
share it publicly or with anyone else. If it ever leaves your control,
rotate the key immediately at console.groq.com.

## Building it

1. Install [Inno Setup 6](https://jrsoftware.org/isinfo.php) (or via
   `winget install --id JRSoftware.InnoSetup -e`).
2. **Build the frontend first** (the installer bundles `frontend/dist`,
   not `frontend/src`):
   ```
   cd frontend && npm install && npm run build
   ```
3. Download the two prerequisite installers into `installer/vendor/`
   (gitignored — not committed, and too large for GitHub anyway):
   - `git-installer.exe` — latest 64-bit Git for Windows
     (`https://github.com/git-for-windows/git/releases/latest`)
   - `python-installer.exe` — Python 3.12 64-bit
     (`https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe`)
4. Compile:
   ```
   & "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" installer\kidgk-setup.iss
   ```
5. Output: `installer\output\KidGK-Setup.exe` (~93MB).

## What it does on the target PC

Requires admin (UAC prompt on launch — needed to install to Program Files
and register scheduled tasks):

1. Skips git/Python if already present; silently installs the missing
   ones. (No Node.js check or install — never needed on the target PC.)
2. Copies the app to `%ProgramFiles%\KidGK`, including the pre-built
   `frontend\dist`.
3. Runs `post-install.ps1`, which:
   - `git init` + points the copy at `origin/main` so the in-app "Check for
     updates" button works (this also refreshes `frontend\dist` if it's
     changed since the installer was built)
   - creates the backend virtualenv, installs Python deps
   - writes `backend\.env` with the baked-in `GROQ_API_KEY`
4. Adds a Desktop and Start Menu shortcut ("KidGK") that runs
   `scripts\launch.ps1` — starts the backend (which serves both the API
   and the static frontend on one port), opens the app in its own window
   (no tabs/address bar), and **stops the backend the moment that window
   is closed**. Nothing runs in the background between sessions; there's
   no auto-start-at-logon or auto-update-on-a-timer by design — updates
   are pulled on demand via the in-app button.

## Bugs found and fixed while testing this

- **UTF-8 BOM in `backend\.env`**: `Set-Content -Encoding utf8` in Windows
  PowerShell 5.1 writes a BOM, which corrupted the `GROQ_API_KEY` line for
  `python-dotenv` — every round silently fell back to the offline bank
  instead of using Groq. Fixed with `[System.IO.File]::WriteAllText` and an
  explicit no-BOM `UTF8Encoding`.
- **Em dashes in `Write-Host`/`Write-Warning` strings**: Windows PowerShell
  5.1 misreads UTF-8-without-BOM script files containing multi-byte
  characters, corrupting the tokenizer and producing unrelated "missing
  terminator" errors elsewhere in the file. Replaced with plain hyphens in
  every `.ps1` file.
- **`[TimeSpan]::MaxValue` as a scheduled task's `RepetitionDuration`**:
  produces a duration string outside what the Task Scheduler XML schema
  accepts (`Register-ScheduledTask` fails with "incorrectly formatted or
  out of range"). Fixed with a bounded 10-year duration instead.
- **`npm run dev` / `vite.cmd` as the tracked process for start/stop**: both
  are batch wrappers that exec `node.exe` as a child process on Windows —
  killing the wrapper's PID leaves the real server (and its port) running.
  Fixed by launching `node vite.js` directly.
- **`DETACHED_PROCESS` on the update-trigger subprocess** (`backend/services/updater.py`):
  made `powershell.exe` exit immediately with code 0 without running
  `update.ps1` at all — the "Check for updates" button appeared to work but
  silently did nothing. A plain `Popen` with no special creation flags works
  fine; `Stop-Process -Force` (what `update.ps1` uses to stop the backend)
  doesn't cascade to child processes on Windows, so no detachment was ever
  needed.
- **`${env:ProgramFiles(x86)}` vs `$env:ProgramFiles(x86)`** (`scripts/launch.ps1`):
  parentheses break bare `$env:` variable parsing in PowerShell — the braced
  form is required for env var names containing them.
- **`Invoke-WebRequest` hanging** (`scripts/launch.ps1`'s readiness check):
  Windows PowerShell 5.1's default engine can stall for its full timeout
  against a perfectly reachable `localhost` endpoint (a WinINET quirk).
  Replaced with a raw `System.Net.Sockets.TcpClient` connect check.

All verified by actually running `post-install.ps1` against a throwaway
copy of the app (confirming `backend\.env` was byte-correct and a live
`/api/round` call returned `"source":"groq"`), and by running
`scripts\launch.ps1`, confirming a real Edge app-window process appears,
then killing that process and confirming the backend and frontend both
stop and their ports free up.

## Architecture change: single process, no Node.js on the target PC

The frontend used to run as a second process (`node vite.js`, a Vite dev
server on its own port) on the target PC, which needed Node.js bundled and
installed there. It's now built once (`npm run build`) into plain
HTML/JS/CSS in `frontend/dist`, **committed to git**, and served directly
by the Python backend (`backend/main.py` mounts it with `StaticFiles`
after all `/api/*` routes, so it never shadows the API). One process, one
port, no Node.js anywhere on the target PC — and `git pull` (the existing
update mechanism) refreshes the frontend the same way it already refreshed
the backend, no extra step needed.

Verified live with the same marker-commit technique used for the backend
update flow: changed `frontend/index.html`'s `<title>`, rebuilt, pushed,
rolled a local checkout back one commit, started the app, confirmed the
old title via `curl`, hit the real `POST /api/update/apply` endpoint, and
confirmed the new title appeared with no `npm install` anywhere in the
process.
