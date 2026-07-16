import logging
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger("kidgk.updater")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
UPDATE_SCRIPT = REPO_ROOT / "scripts" / "update.ps1"


def _run_git(*args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=15,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "git command failed")
    return result.stdout.strip()


def check_for_update() -> dict:
    """Fetches origin and compares HEAD without pulling or touching the app."""
    try:
        _run_git("fetch", "origin", "--quiet")
        local = _run_git("rev-parse", "--short", "HEAD")
        remote = _run_git("rev-parse", "--short", "origin/main")
        return {
            "update_available": local != remote,
            "local": local,
            "remote": remote,
        }
    except Exception as exc:
        logger.warning("Update check failed: %s", exc)
        return {"update_available": False, "error": str(exc)}


def trigger_update() -> None:
    """Launches update.ps1 as a fully detached process so it survives this
    process being killed (update.ps1 stops the running backend as its first
    step, then pulls, reinstalls deps, and restarts everything)."""
    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

    subprocess.Popen(
        [
            "powershell.exe",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(UPDATE_SCRIPT),
        ],
        cwd=REPO_ROOT,
        creationflags=creationflags,
        close_fds=True,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
