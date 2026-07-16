import logging
import subprocess
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
    """Launches update.ps1 as a background process. update.ps1 stops the
    running backend as its first step, but that doesn't kill this child:
    Windows' TerminateProcess (what Stop-Process -Force uses) never cascades
    to children, so no special detachment flags are needed here - and
    DETACHED_PROCESS was actually found to make powershell.exe exit
    immediately without running the script at all, so don't add it back."""
    log_path = REPO_ROOT / "installer" / "update-trigger.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_file = open(log_path, "a")

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
        stdin=subprocess.DEVNULL,
        stdout=log_file,
        stderr=log_file,
    )
