<#
.SYNOPSIS
    One-command installer for RiftTask on Windows (PowerShell 5.1+ / PowerShell Core).
    Authenticated via official GitHub CLI (gh).

.DESCRIPTION
    Checks prerequisites (gh, git, node, npm), verifies authentication,
    clones or uses local repository, compiles native dependencies (node-pty),
    packages RiftTask and installs it to %LOCALAPPDATA%\Programs\RiftTask,
    creating Start Menu and Desktop shortcuts.

.PARAMETER Check
    Inspects environment and prerequisites without installing.

.PARAMETER DryRun
    Alias for -Check.

.PARAMETER Source
    Forces building from source.

.PARAMETER Dest
    Custom installation directory (default: %LOCALAPPDATA%\Programs\RiftTask).

.PARAMETER Help
    Displays usage and help.
#>
[CmdletBinding()]
param(
    [switch]$Check,
    [switch]$DryRun,
    [switch]$Source,
    [string]$Dest,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'

if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}

$Repo = "wisedev-pstach/RiftTask"
$AppName = "RiftTask"
$CheckOnly = $Check.IsPresent -or $DryRun.IsPresent

Write-Host "Checking environment for RiftTask installation..." -ForegroundColor Cyan

# Check architecture
$Arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "ia32" }
Write-Host "  OS: Windows ($([System.Environment]::OSVersion.VersionString))"
Write-Host "  Arch: $Arch"

$Errors = 0

# Check GitHub CLI
$GhCmd = Get-Command gh -ErrorAction SilentlyContinue
if ($GhCmd) {
    $GhVer = (gh --version | Select-Object -First 1)
    Write-Host "  GitHub CLI (gh): OK ($GhVer)" -ForegroundColor Green
} else {
    Write-Warning "  GitHub CLI (gh): NOT FOUND in PATH."
    Write-Host "    Install gh from https://cli.github.com/ or 'winget install --id GitHub.cli' and run 'gh auth login'." -ForegroundColor Yellow
    $Errors++
}

# Check Git
$GitCmd = Get-Command git -ErrorAction SilentlyContinue
if ($GitCmd) {
    $GitVer = (git --version)
    Write-Host "  Git: OK ($GitVer)" -ForegroundColor Green
} else {
    Write-Warning "  Git: NOT FOUND in PATH."
    Write-Host "    Install git from https://git-scm.com/ or 'winget install --id Git.Git'." -ForegroundColor Yellow
    $Errors++
}

# Check Node and npm
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
$NpmCmd = Get-Command npm -ErrorAction SilentlyContinue
if ($NodeCmd -and $NpmCmd) {
    $NodeVer = (node --version)
    $NpmVer = (npm --version)
    Write-Host "  Node.js: OK ($NodeVer, npm $NpmVer)" -ForegroundColor Green
} else {
    Write-Warning "  Node.js / npm: NOT FOUND in PATH."
    Write-Host "    Install Node.js v20+ from https://nodejs.org/ or 'winget install --id OpenJS.NodeJS'." -ForegroundColor Yellow
    $Errors++
}

if ($Errors -gt 0) {
    Write-Error "Installation aborted due to missing prerequisites."
    exit 1
}

# Check GitHub Authentication
& gh auth status *>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  GitHub Authentication: OK" -ForegroundColor Green
} else {
    Write-Warning "  GitHub Authentication: NOT AUTHENTICATED"
    Write-Host "    Please run 'gh auth login' to authenticate with your GitHub account." -ForegroundColor Yellow
    if (-not $CheckOnly) {
        exit 1
    }
}

if ($CheckOnly) {
    Write-Host "`nPrerequisite check completed successfully. Ready to install RiftTask." -ForegroundColor Green
    exit 0
}

# Determine build directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ParentDir = Split-Path -Parent $ScriptDir
$TempBuildDir = $null

if ((Test-Path "$ParentDir\package.json") -and (Select-String -Path "$ParentDir\package.json" -Pattern '"name":\s*"rifttask"')) {
    $BuildDir = $ParentDir
    Write-Host "Using existing repository directory: $BuildDir" -ForegroundColor Cyan
} else {
    $TempBuildDir = Join-Path $env:TEMP ("rifttask-build-" + [System.Guid]::NewGuid().ToString("N"))
    Write-Host "Cloning RiftTask into temporary directory: $TempBuildDir..." -ForegroundColor Cyan
    gh repo clone $Repo $TempBuildDir -- --depth=1
    $BuildDir = $TempBuildDir
}

$PushedLocation = $false
try {
    Push-Location $BuildDir
    $PushedLocation = $true

    Write-Host "Building RiftTask from source..." -ForegroundColor Cyan
    npm ci --no-audit --no-fund
    npm run native:rebuild
    npm run build

    Write-Host "Packaging Windows application..." -ForegroundColor Cyan
    npx electron-builder --win --$Arch --dir

    $WinBundle = Join-Path $BuildDir "release\win-unpacked"
    if (-not (Test-Path $WinBundle)) {
        Write-Error "Windows unpacked directory was not found after packaging."
        exit 1
    }

    $TargetDir = if ($Dest) { $Dest } else { Join-Path $env:LOCALAPPDATA "Programs\$AppName" }
    Write-Host "Installing to $TargetDir..." -ForegroundColor Cyan

    if (Test-Path $TargetDir) {
        Remove-Item -Recurse -Force $TargetDir
    }
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
    Copy-Item -Recurse -Force (Join-Path $WinBundle "*") $TargetDir

    $ExePath = Join-Path $TargetDir "$AppName.exe"

    # Create Shortcuts via WScript.Shell COM object
    try {
        $WshShell = New-Object -ComObject WScript.Shell

        # Start Menu Shortcut
        $StartMenuDir = [Environment]::GetFolderPath("Programs")
        $StartShortcut = $WshShell.CreateShortcut((Join-Path $StartMenuDir "$AppName.lnk"))
        $StartShortcut.TargetPath = $ExePath
        $StartShortcut.WorkingDirectory = $TargetDir
        $StartShortcut.Save()

        # Desktop Shortcut
        $DesktopDir = [Environment]::GetFolderPath("Desktop")
        $DesktopShortcut = $WshShell.CreateShortcut((Join-Path $DesktopDir "$AppName.lnk"))
        $DesktopShortcut.TargetPath = $ExePath
        $DesktopShortcut.WorkingDirectory = $TargetDir
        $DesktopShortcut.Save()

        Write-Host "Created Start Menu and Desktop shortcuts." -ForegroundColor Green
    } catch {
        Write-Warning "Could not create desktop shortcut: $_"
    }

    Write-Host "`n=== RiftTask installation complete! ===" -ForegroundColor Green
    Write-Host "Installed at: $TargetDir"
    Write-Host "Launch with:"
    Write-Host "  & `"$ExePath`"" -ForegroundColor Yellow
}
finally {
    if ($PushedLocation) {
        Pop-Location
    }
    if ($TempBuildDir -and (Test-Path $TempBuildDir)) {
        Remove-Item -Recurse -Force $TempBuildDir -ErrorAction SilentlyContinue
    }
}
