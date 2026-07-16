; KidGK one-click installer.
; Bundles Git for Windows, Python, and Node.js installers so the target PC
; needs nothing pre-installed, copies the app, wires up backend\.env with a
; baked-in Groq key, installs dependencies, registers the KidGK-AutoUpdate
; and KidGK-RunAtLogon scheduled tasks, and starts the app.
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
Source: "vendor\node-installer.msi"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "post-install.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion
Source: "KidGK.url"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\*"; DestDir: "{app}"; Excludes: "installer\*,.git\*,backend\.venv\*,backend\.env,backend\__pycache__\*,backend\services\__pycache__\*,frontend\node_modules\*,.run\*,frontend\dist\*,*.tsbuildinfo"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\KidGK.url"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\KidGK.url"

[Run]
Filename: "{tmp}\git-installer.exe"; Parameters: "/VERYSILENT /NORESTART /NOCANCEL /SP- /SUPPRESSMSGBOXES"; StatusMsg: "Installing Git for Windows..."; Check: NeedsGit; Flags: waituntilterminated
Filename: "{tmp}\python-installer.exe"; Parameters: "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0"; StatusMsg: "Installing Python..."; Check: NeedsPython; Flags: waituntilterminated
Filename: "msiexec.exe"; Parameters: "/i ""{tmp}\node-installer.msi"" /quiet /norestart"; StatusMsg: "Installing Node.js..."; Check: NeedsNode; Flags: waituntilterminated
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

function IsNodeInstalled(): Boolean;
begin
  Result := IsOnPath('node') or FileExists(ExpandConstant('{pf}\nodejs\node.exe'));
end;

function NeedsGit(): Boolean;
begin
  Result := not IsGitInstalled();
end;

function NeedsPython(): Boolean;
begin
  Result := not IsPythonInstalled();
end;

function NeedsNode(): Boolean;
begin
  Result := not IsNodeInstalled();
end;
