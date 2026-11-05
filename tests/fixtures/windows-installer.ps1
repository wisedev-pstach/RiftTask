# Linux-only PowerShell harness: real installer/files, simulated Windows COM.
param([string]$Installer, [string]$Dest)
$ErrorActionPreference = 'Stop'
if (-not $IsLinux) { throw 'This simulated-COM harness must never access a native Windows Start Menu.' }
function Get-Command {
    if ($env:RIFT_MODE -notin @('Install','Check')) { throw 'Build tool lookup forbidden during RegisterOnly' }
    return [pscustomobject]@{Name=$args[0]}
}
function git {
    $global:LASTEXITCODE = 0
    if ($args[0] -eq '--version') { return 'git fixture' }
    if ($args[0] -eq 'clone') { [IO.Directory]::CreateDirectory($args[-1]) | Out-Null; return }
    throw "Unexpected git invocation: $args"
}
function node { $global:LASTEXITCODE = 0; return 'v24.15.0' }
function npm { $global:LASTEXITCODE = 0; if ($args[0] -eq '--version') { return '11.0.0' } }
function npx {
    $global:LASTEXITCODE = 0
    $Bundle = Join-Path (Get-Location).Path 'release/win-unpacked'
    [IO.Directory]::CreateDirectory($Bundle) | Out-Null
    [IO.File]::WriteAllText((Join-Path $Bundle 'RiftTask.exe'), 'packaged-fixture-not-executable')
}
function Copy-Item {
    param([string]$LiteralPath, [string]$Destination, [switch]$Recurse, [string]$ErrorAction)
    if ($env:RIFT_COPY_SKIP -ne '1') { Microsoft.PowerShell.Management\Copy-Item -LiteralPath $LiteralPath -Destination $Destination -Recurse -ErrorAction Stop }
}
function New-Object {
    param([string]$ComObject)
    if ($ComObject -ne 'WScript.Shell') { throw "Unexpected COM object: $ComObject" }
    if ($env:RIFT_COM_FAIL -eq '1') { throw 'Simulated COM unavailable' }
    $Shell = [pscustomobject]@{}
    $Shell | Add-Member ScriptMethod CreateShortcut {
        param($LinkPath)
        if (Test-Path -LiteralPath $LinkPath) {
            $Link = Get-Content -LiteralPath $LinkPath -Raw | ConvertFrom-Json
        } else {
            $Link = [pscustomobject]@{TargetPath='';Arguments='';WorkingDirectory='';IconLocation='';Description=''}
        }
        $Link | Add-Member -Force NoteProperty FixtureLinkPath $LinkPath
        $Link | Add-Member ScriptMethod Save {
            if ($env:RIFT_SAVE_SKIP -eq '1') { return }
            $this | ConvertTo-Json | Set-Content -LiteralPath $this.FixtureLinkPath
        }
        return $Link
    }
    return $Shell
}
# Same parameter binding as the documented downloaded-script repair command.
$Flags = @{ Dest = $Dest }
switch ($env:RIFT_MODE) {
    'Install' { }
    'Check' { $Flags.Check = $true }
    default { $Flags.RegisterOnly = $true }
}
if ($env:RIFT_DEFAULT_DEST -eq '1') { $Flags.Remove('Dest') }
if ($env:RIFT_EXTRA_CHECK -eq '1') { $Flags.Check = $true }
if ($env:RIFT_DOC_RECIPE) {
    function Invoke-RestMethod {
        param([string]$Uri)
        if ($Uri -cne 'https://raw.githubusercontent.com/wisedev-pstach/RiftTask/main/scripts/install.ps1') { throw 'Unexpected documentation URL' }
        Get-Content -LiteralPath $Installer -Raw
    }
    & ([scriptblock]::Create($env:RIFT_DOC_RECIPE))
} else {
    & ([scriptblock]::Create((Get-Content -LiteralPath $Installer -Raw))) @Flags
}
if (Test-Path -LiteralPath Function:Invoke-Native) { throw 'Installer helper leaked' }
