# KidGK one-click installer

Builds `KidGK-Setup.exe` — a self-contained Windows installer that bundles
Git, Python, and Node.js (so the target PC needs nothing pre-installed),
copies the app, writes `backend\.env` with a baked-in Groq key, installs
all dependencies, and registers the `KidGK-AutoUpdate` scheduled task.

**Security note:** the Groq API key is embedded in `kidgk-setup.iss` as
plain text and ends up extractable from the compiled `.exe` (strings/hex
dump). Only hand this installer to machines you personally control — never
share it publicly or with anyone else. If it ever leaves your control,
rotate the key immediately at console.groq.com.

## Building it

1. Install [Inno Setup 6](https://jrsoftware.org/isinfo.php) (or via
   `winget install --id JRSoftware.InnoSetup -e`).
2. Download the three prerequisite installers into `installer/vendor/`
   (gitignored — not committed, and too large for GitHub anyway):
   - `git-installer.exe` — latest 64-bit Git for Windows
     (`https://github.com/git-for-windows/git/releases/latest`)
   - `python-installer.exe` — Python 3.12 64-bit
     (`https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe`)
   - `node-installer.msi` — Node.js LTS 64-bit MSI
     (`https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi`)
3. Compile:
   ```
   & "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" installer\kidgk-setup.iss
   ```
4. Output: `installer\output\KidGK-Setup.exe` (~120MB).

## What it does on the target PC

Requires admin (UAC prompt on launch — needed to install to Program Files
and register scheduled tasks):

1. Skips any of git/Python/Node that are already present; silently installs
   the missing ones.
2. Copies the app to `%ProgramFiles%\KidGK`.
3. Runs `post-install.ps1`, which:
   - `git init` + points the copy at `origin/main` so future auto-updates work
   - creates the backend virtualenv, installs Python deps
   - writes `backend\.env` with the baked-in `GROQ_API_KEY`
   - installs frontend deps
   - registers `KidGK-AutoUpdate` (pulls + restarts every 15 min)
   - registers `KidGK-RunAtLogon` (restarts the app after a reboot)
   - starts the app immediately (http://localhost:5173)
4. Adds a Start Menu / Desktop shortcut that opens the app in a browser.

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

All verified by actually running `post-install.ps1` against a throwaway
copy of the app and confirming `backend\.env` was byte-correct and a live
`/api/round` call returned `"source":"groq"`.
