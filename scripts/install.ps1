<#
.SYNOPSIS
    Source-build preview for RiftTask on Windows (PowerShell 5.1+ / PowerShell Core).
    Anonymous public HTTPS source download; app first use separately requires official gh.

.DESCRIPTION
    Checks build prerequisites (git, node, npm),
    clones public main over HTTPS into a fresh tree, uses shipped node-pty N-API prebuilds,
    packages RiftTask and installs it to %LOCALAPPDATA%\Programs\RiftTask,
    safely updating recognized existing RiftTask installations after closing the app.
    Keeps a previous-app backup; never modifies application data. Creates one
    current-user Start Menu shortcut, never an all-users/Desktop shortcut.
    -RegisterOnly repairs discovery for an existing installation without build tools.
    Requires Git and Node 24.15+ (24.x) or 26+ with npm/npx; no C++ toolchain.
    Native Windows execution is not yet verified.

.PARAMETER RegisterOnly
    Creates or safely refreshes the per-user Start Menu shortcut for an existing
    RiftTask.exe at the default installation or -Dest. Does not build or upgrade.

.PARAMETER Check
    Inspects environment and prerequisites without installing.

.PARAMETER DryRun
    Alias for -Check.

.PARAMETER Source
    Compatibility flag; this preview always builds from fresh source.

.PARAMETER Dest
    Custom installation directory (default: %LOCALAPPDATA%\Programs\RiftTask).

.PARAMETER Ref
    Optional full lowercase 40-character source commit SHA. Fetches and verifies it before building.

.PARAMETER Help
    Displays usage and help.
#>
[CmdletBinding()]
param(
    [switch]$RegisterOnly,
    [switch]$Check,
    [switch]$DryRun,
    [switch]$Source,
    [string]$Dest,
    [string]$Ref,
    [switch]$Help
)

# Keep preferences and helper functions local when evaluated via irm | iex.
& {
$ErrorActionPreference = 'Stop'
if ($Ref -and $Ref -cnotmatch '^[0-9a-f]{40}$') { throw '-Ref requires a full lowercase 40-character commit SHA.' }

# Native failures do not reliably throw in Windows PowerShell 5.1.
function Invoke-Native {
    param([string]$Command, [string[]]$Arguments)
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command failed (exit $LASTEXITCODE). Installation stopped."
    }
}

function Register-StartMenu {
    param([string]$InstallDir)
    $ExePath = Join-Path $InstallDir 'RiftTask.exe'
    if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) {
        throw "RiftTask.exe not found at: $ExePath. Registration stopped; no build was attempted."
    }
    $Programs = [Environment]::GetFolderPath('Programs')
    if (-not $Programs) {
        if (-not $env:APPDATA -or -not [IO.Path]::IsPathRooted($env:APPDATA)) {
            throw 'Cannot resolve the current-user Start Menu Programs folder.'
        }
        $Programs = Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs'
    }
    $Programs = [IO.Path]::GetFullPath($Programs)
    $LinkPath = Join-Path $Programs 'RiftTask.lnk'
    $Existing = Get-Item -LiteralPath $LinkPath -Force -ErrorAction SilentlyContinue
    if ($Existing -and ($Existing.PSIsContainer -or ($Existing.Attributes -band [IO.FileAttributes]::ReparsePoint))) {
        throw "Refusing non-regular Start Menu shortcut: $LinkPath"
    }
    $Shell = New-Object -ComObject WScript.Shell
    $Shortcut = $Shell.CreateShortcut($LinkPath)
    if ($Existing) {
        $Matches = $false
        try {
            $Matches = [IO.Path]::IsPathRooted($Shortcut.TargetPath) -and
                [string]::Equals([IO.Path]::GetFullPath($Shortcut.TargetPath), $ExePath, [StringComparison]::OrdinalIgnoreCase) -and
                [string]::IsNullOrEmpty($Shortcut.Arguments)
        } catch { $Matches = $false }
        if (-not $Matches) {
            throw "Refusing unrelated Start Menu shortcut: $LinkPath. Existing link was preserved; inspect it manually."
        }
    }
    [IO.Directory]::CreateDirectory($Programs) | Out-Null
    $Shortcut.TargetPath = $ExePath
    $Shortcut.Arguments = ''
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.IconLocation = "$ExePath,0"
    $Shortcut.Description = 'RiftTask - local-first project workspace'
    $Shortcut.Save()
    if (-not (Test-Path -LiteralPath $LinkPath -PathType Leaf)) { throw 'Start Menu shortcut was not saved.' }
    $Saved = $Shell.CreateShortcut($LinkPath)
    if (-not [string]::Equals($Saved.TargetPath, $ExePath, [StringComparison]::OrdinalIgnoreCase) -or
        -not [string]::IsNullOrEmpty($Saved.Arguments) -or
        -not [string]::Equals($Saved.WorkingDirectory, $InstallDir, [StringComparison]::OrdinalIgnoreCase) -or
        -not [string]::Equals($Saved.IconLocation, "$ExePath,0", [StringComparison]::OrdinalIgnoreCase) -or
        $Saved.Description -ne $Shortcut.Description) {
        throw 'Start Menu shortcut verification failed; inspect the installed shortcut.'
    }
    Write-Host "Start Menu shortcut: $LinkPath"
    Write-Host 'Open Start and search for RiftTask. Windows may take a moment to index the shortcut.'
}

if ($Help) {
    Write-Output 'Usage: install.ps1 [-Check] [-DryRun] [-Source] [-Dest <application directory>] [-Ref <full lowercase SHA>] [-Help]'
    Write-Output 'Repair discovery only: install.ps1 -RegisterOnly [-Dest <existing installation directory>]'
    return
}

$Repo = "https://github.com/wisedev-pstach/RiftTask.git"
$AppName = "RiftTask"
$CheckOnly = $Check.IsPresent -or $DryRun.IsPresent
$TargetDir = if ($Dest) { $Dest } else { Join-Path $env:LOCALAPPDATA "Programs\$AppName" }
$TargetDir = [System.IO.Path]::GetFullPath($TargetDir)
if ($RegisterOnly) {
    if ($CheckOnly -or $Source -or $Ref) { throw 'Do not combine -RegisterOnly with -Check, -DryRun, -Source or -Ref.' }
    Register-StartMenu $TargetDir
    return
}

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
    throw "Installation aborted due to missing prerequisites."
}

# Fast preflight must not interpret literal paths or require ASAR before npm ci.
$ExistingTarget = Get-Item -LiteralPath $TargetDir -Force -ErrorAction SilentlyContinue
if ($ExistingTarget -and (-not $ExistingTarget.PSIsContainer -or ($ExistingTarget.Attributes -band [IO.FileAttributes]::ReparsePoint))) {
    throw "Error: refusing existing destination file/reparse point: $TargetDir"
}
if ($TargetDir -eq [IO.Path]::GetPathRoot($TargetDir) -or $TargetDir -eq [IO.Path]::GetFullPath($HOME)) { throw 'Refusing root/home destination.' }
$Ancestor = $TargetDir
while ($Ancestor) {
    $Item = Get-Item -LiteralPath $Ancestor -Force -ErrorAction SilentlyContinue
    if ($Item -and ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Refusing reparse destination ancestor: $Ancestor" }
    $Parent = [IO.Path]::GetDirectoryName($Ancestor)
    if ($Parent -eq $Ancestor) { break }
    $Ancestor = $Parent
}
if ($ExistingTarget) { Write-Host 'Will update recognized RiftTask installation (identity verification after dependencies are ready).' }
else { Write-Host 'Will install RiftTask.' }
if (Get-Process -Name RiftTask -ErrorAction SilentlyContinue) { throw 'Please close RiftTask and retry; no processes were stopped.' }

if ($CheckOnly) {
    Write-Host "Tools/destination check passed. Dependency/runtime verification and native launch remain unverified." -ForegroundColor Green
    return
}

# Always clone an explicit main branch; never build in the user's checkout.
$SourceRef = 'main'
$TempBuildDir = Join-Path ([System.IO.Path]::GetTempPath()) ("rifttask-build-" + [System.Guid]::NewGuid().ToString('N'))
$BuildDir = Join-Path $TempBuildDir 'source'
$OwnedTemp = $false
$PushedLocation = $false
try {
    New-Item -ItemType Directory -Path $TempBuildDir -ErrorAction Stop | Out-Null
    $OwnedTemp = $true
    Invoke-Native git @('clone', '--depth=1', '--branch', $SourceRef, $Repo, $BuildDir)
    Push-Location -LiteralPath $BuildDir
    $PushedLocation = $true
    if ($Ref) {
        Invoke-Native git @('fetch', '--depth=1', 'origin', $Ref)
        Invoke-Native git @('checkout', '--detach', $Ref)
        $ActualCommit = (Invoke-Native git @('rev-parse', 'HEAD')).Trim()
        if ($ActualCommit -cne $Ref) { throw 'Source commit mismatch; stopped.' }
        Write-Host "Building exact source commit: $Ref"
    }

    Write-Host "Building RiftTask from source..." -ForegroundColor Cyan
    # Prevent all lifecycle compile fallbacks, including inherited build_from_source.
    Invoke-Native npm @('ci', '--ignore-scripts', '--no-audit', '--no-fund')
    $DeployHelper = Join-Path $BuildDir 'scripts/install-deploy.cjs'
    $PriorFingerprint = (Invoke-Native node @($DeployHelper, 'inspect', 'win', $TargetDir, $BuildDir, $HOME, [IO.Path]::GetTempPath(), $env:APPDATA)).Trim()
    Invoke-Native npm @('run', 'native:prepare', '--', $Arch)
    Invoke-Native npm @('run', 'build')

    Write-Host "Packaging Windows application..." -ForegroundColor Cyan
    Invoke-Native npx @('--no-install', 'electron-builder', '--win', "--$Arch", '--dir', '--publish', 'never', '--config.npmRebuild=false')

    $BundlePath = if ($Arch -eq 'arm64') { 'release\win-arm64-unpacked' } else { 'release\win-unpacked' }
    $WinBundle = Join-Path $BuildDir $BundlePath
    if (-not (Test-Path -LiteralPath (Join-Path $WinBundle "$AppName.exe") -PathType Leaf)) {
        throw "Windows unpacked directory was not found after packaging."
    }

    Write-Host "Installing to $TargetDir..." -ForegroundColor Cyan

    # Fresh package is validated and staged beside target before touching old app.
    if (Get-Process -Name RiftTask -ErrorAction SilentlyContinue) { throw 'Please close RiftTask and retry; no processes were stopped.' }
    Invoke-Native node @($DeployHelper, 'deploy', 'win', $TargetDir, $BuildDir, $HOME, [IO.Path]::GetTempPath(), $env:APPDATA, $PriorFingerprint, $WinBundle, $Ref)
    $ExePath = Join-Path $TargetDir "$AppName.exe"

    try {
        Register-StartMenu $TargetDir
    } catch {
        throw "Application installed at: $TargetDir; Start Menu registration failed. App files were kept. Retry with -RegisterOnly -Dest for this directory. $($_.Exception.Message)"
    }

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
} # End invocation scope; return/throw never exit the caller session.
