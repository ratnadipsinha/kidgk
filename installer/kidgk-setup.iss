; KidGK one-click installer.
; Bundles Git for Windows and Python installers so the target PC needs
; nothing pre-installed (Node.js is NOT needed - the frontend is a
; pre-built static bundle served by the Python backend), copies the app,
; wires up backend\.env with a baked-in Groq key, installs dependencies,
; and adds a launch-on-demand shortcut.
;
; SECURITY NOTE: GroqApiKey below is embedded in the compiled .exe in plain
; text and is trivially extractable (strings/hex dump). Only distribute this
; installer to machines you personally control.

#define MyAppName "KidGK"
#define MyAppVersion "1.0"
#define MyGroqApiKey "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"

[Setup]
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
OutputDir=output
OutputBaseFilename=KidGK-Setup
Compression=lzma2
SolidCompression=yes
DisableProgramGroupPage=yes
WizardStyle=modern

[Files]
Source: "vendor\git-installer.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "vendor\python-installer.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "post-install.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "..\*"; DestDir: "{app}"; Excludes: "installer\*,.git\*,backend\.venv\*,backend\.env,backend\__pycache__\*,backend\services\__pycache__\*,frontend\node_modules\*,.run\*,*.tsbuildinfo"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\scripts\launch.ps1"""; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\scripts\launch.ps1"""; WorkingDir: "{app}"

[Run]
Filename: "{tmp}\git-installer.exe"; Parameters: "/VERYSILENT /NORESTART /NOCANCEL /SP- /SUPPRESSMSGBOXES"; StatusMsg: "Installing Git for Windows..."; Check: NeedsGit; Flags: waituntilterminated
Filename: "{tmp}\python-installer.exe"; Parameters: "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0"; StatusMsg: "Installing Python..."; Check: NeedsPython; Flags: waituntilterminated
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\installer\post-install.ps1"" -InstallDir ""{app}"" -GroqApiKey ""{#MyGroqApiKey}"""; StatusMsg: "Setting up KidGK (this can take a few minutes)..."; Flags: waituntilterminated

[Code]
function IsOnPath(const Exe: string): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('cmd.exe', '/C where ' + Exe + ' >nul 2>nul', '', SW_HIDE,
    ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function IsGitInstalled(): Boolean;
begin
  Result := IsOnPath('git') or FileExists(ExpandConstant('{pf}\Git\cmd\git.exe'));
end;

function IsPythonInstalled(): Boolean;
begin
  Result := IsOnPath('python') or FileExists(ExpandConstant('{pf}\Python312\python.exe'));
end;

function NeedsGit(): Boolean;
begin
  Result := not IsGitInstalled();
end;

function NeedsPython(): Boolean;
begin
  Result := not IsPythonInstalled();
end;
