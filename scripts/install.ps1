<#
.SYNOPSIS
    Source-build preview for RiftTask on Windows (PowerShell 5.1+ / PowerShell Core).
    Authenticated via official GitHub CLI (gh).

.DESCRIPTION
    Checks prerequisites (gh, git, node, npm), verifies authentication,
    clones fresh feat/cloud-persistence, compiles native dependencies (node-pty),
    packages RiftTask and installs it to %LOCALAPPDATA%\Programs\RiftTask,
    refusing all existing destinations. No shared shortcuts or upgrades.
    Requires Node 24.15+ (24.x) or 26+, Python 3 and MSVC C++ build tools.
    Native Windows execution is not yet verified.

.PARAMETER Check
    Inspects environment and prerequisites without installing.

.PARAMETER DryRun
    Alias for -Check.

.PARAMETER Source
    Compatibility flag; this preview always builds from fresh source.

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

# Native failures do not reliably throw in Windows PowerShell 5.1.
function Invoke-Native {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed (exit $LASTEXITCODE). Installation stopped."
    }
}

if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}

$Repo = "wisedev-pstach/RiftTask"
$AppName = "RiftTask"
$CheckOnly = $Check.IsPresent -or $DryRun.IsPresent

Write-Host "Checking environment for RiftTask installation..." -ForegroundColor Cyan

# Check architecture
$RawArch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
$Arch = switch ($RawArch.ToUpperInvariant()) {
    'ARM64' { 'arm64' }
    'AMD64' { 'x64' }
    default { throw "Unsupported Windows architecture: $RawArch" }
}
Write-Host "  OS: Windows ($([System.Environment]::OSVersion.VersionString))"
Write-Host "  Arch: $Arch"

$Errors = 0

# Check GitHub CLI
$GhCmd = Get-Command gh -ErrorAction SilentlyContinue
if ($GhCmd) {
    $GhVer = (Invoke-Native gh @('--version'))
    Write-Host "  GitHub CLI (gh): OK ($GhVer)" -ForegroundColor Green
} else {
    Write-Warning "  GitHub CLI (gh): NOT FOUND in PATH."
    Write-Host "    Install gh from https://cli.github.com/ or 'winget install --id GitHub.cli' and run 'gh auth login'." -ForegroundColor Yellow
    $Errors++
}

# Check Git
$GitCmd = Get-Command git -ErrorAction SilentlyContinue
if ($GitCmd) {
    $GitVer = (Invoke-Native git @('--version'))
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
    $NodeVer = (Invoke-Native node @('--version'))
    $NodeVersion = [version]($NodeVer.Trim().TrimStart('v'))
    if (-not (($NodeVersion.Major -eq 24 -and $NodeVersion -ge [version]'24.15.0') -or $NodeVersion.Major -ge 26)) {
        throw 'Unsupported Node.js: use Node 24.15+ (24.x) or 26+.'
    }
    $NpmVer = (Invoke-Native npm @('--version'))
    Write-Host "  Node.js: OK ($NodeVer, npm $NpmVer)" -ForegroundColor Green
} else {
    Write-Warning "  Node.js / npm: NOT FOUND in PATH."
    Write-Host "    Install Node.js 24.15+ (24.x) or 26+ from https://nodejs.org/." -ForegroundColor Yellow
    $Errors++
}

if ($Errors -gt 0) {
    Write-Error "Installation aborted due to missing prerequisites."
    exit 1
}

# Check GitHub Authentication
try {
    Invoke-Native gh @('auth', 'status') *>$null
    Write-Host "  GitHub Authentication: OK" -ForegroundColor Green
} catch {
    Write-Warning "GitHub authentication failed. Run gh auth login on your own computer."
    exit 1
}

$TargetDir = if ($Dest) { $Dest } else { Join-Path $env:LOCALAPPDATA "Programs\$AppName" }
$TargetDir = [System.IO.Path]::GetFullPath($TargetDir)
# Get-Item -Force also detects reparse points; use literal paths throughout.
if (Get-Item -LiteralPath $TargetDir -Force -ErrorAction SilentlyContinue) {
    throw "Error: refusing existing destination: $TargetDir (no upgrades in this preview)."
}

if ($CheckOnly) {
    Write-Host "Tools/authentication/destination check passed. Compilation and native launch remain unverified." -ForegroundColor Green
    exit 0
}

# Always clone an explicit feature ref; never build in the user's checkout.
$SourceRef = 'feat/cloud-persistence'
$TempBuildDir = Join-Path ([System.IO.Path]::GetTempPath()) ("rifttask-build-" + [System.Guid]::NewGuid().ToString('N'))
$BuildDir = Join-Path $TempBuildDir 'source'
$OwnedTemp = $false
$PushedLocation = $false
try {
    New-Item -ItemType Directory -Path $TempBuildDir -ErrorAction Stop | Out-Null
    $OwnedTemp = $true
    Invoke-Native gh @('repo', 'clone', $Repo, $BuildDir, '--', '--depth=1', '--branch', $SourceRef)
    Push-Location -LiteralPath $BuildDir
    $PushedLocation = $true

    Write-Host "Building RiftTask from source..." -ForegroundColor Cyan
    Invoke-Native npm @('ci', '--no-audit', '--no-fund')
    Invoke-Native npm @('run', 'native:rebuild')
    Invoke-Native npm @('run', 'build')

    Write-Host "Packaging Windows application..." -ForegroundColor Cyan
    Invoke-Native npx @('--no-install', 'electron-builder', '--win', "--$Arch", '--dir', '--publish', 'never')

    $BundlePath = if ($Arch -eq 'arm64') { 'release\win-arm64-unpacked' } else { 'release\win-unpacked' }
    $WinBundle = Join-Path $BuildDir $BundlePath
    if (-not (Test-Path -LiteralPath (Join-Path $WinBundle "$AppName.exe") -PathType Leaf)) {
        Write-Error "Windows unpacked directory was not found after packaging."
        exit 1
    }

    Write-Host "Installing to $TargetDir..." -ForegroundColor Cyan

    # No -Force: exclusive reservation refuses even an empty existing directory.
    New-Item -ItemType Directory -Path $TargetDir -ErrorAction Stop | Out-Null
    foreach ($Child in Get-ChildItem -LiteralPath $WinBundle -Force) {
        Copy-Item -LiteralPath $Child.FullName -Destination $TargetDir -Recurse -ErrorAction Stop
    }

    $ExePath = Join-Path $TargetDir "$AppName.exe"

    # Source preview deliberately creates no shared Desktop/Start Menu shortcuts.

    Write-Host "`n=== RiftTask installation complete! ===" -ForegroundColor Green
    Write-Host "Installed at: $TargetDir"
    Write-Host "Application executable: $ExePath"
    Write-Host "Open the application at the path above using your file manager."
}
finally {
    if ($PushedLocation) {
        Pop-Location
    }
    if ($OwnedTemp) {
        Remove-Item -LiteralPath $TempBuildDir -Recurse -Force -ErrorAction Continue
    }
}
