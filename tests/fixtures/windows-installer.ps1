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
    if ($args[0] -eq 'clone') {
        [IO.Directory]::CreateDirectory((Join-Path $args[-1] 'scripts')) | Out-Null
        [IO.File]::Copy((Join-Path $env:RIFT_ROOT 'scripts/install-deploy.cjs'), (Join-Path $args[-1] 'scripts/install-deploy.cjs'))
        Microsoft.PowerShell.Management\New-Item -ItemType SymbolicLink -Path (Join-Path $args[-1] 'node_modules') -Target (Join-Path $env:RIFT_ROOT 'node_modules') | Out-Null
        return
    }
    throw "Unexpected git invocation: $args"
}
function node {
    if ($args[0] -eq '--version') { $global:LASTEXITCODE = 0; return 'v24.15.0' }
    & $env:RIFT_NODE @args
    $global:LASTEXITCODE = $LASTEXITCODE
}
function npm {
    $global:LASTEXITCODE = 0
    if ($args[0] -eq '--version') { return '11.0.0' }
    if ($env:RIFT_FAIL -and $args -contains $env:RIFT_FAIL) { $global:LASTEXITCODE = 9 }
}
function npx {
    $global:LASTEXITCODE = 0
    $Bundle = Join-Path (Get-Location).Path 'release/win-unpacked'
    [IO.Directory]::CreateDirectory($Bundle) | Out-Null
    if ($env:RIFT_COPY_SKIP -ne '1') { [IO.File]::WriteAllText((Join-Path $Bundle 'RiftTask.exe'), 'packaged-fixture-not-executable') }
    $InputDir = Join-Path (Get-Location).Path 'asar-input'
    [IO.Directory]::CreateDirectory($InputDir) | Out-Null
    [IO.File]::WriteAllText((Join-Path $InputDir 'package.json'), '{"name":"rifttask","main":"desktop/main.cjs","build":{"appId":"dev.wisedev.rifttask"}}')
    [IO.Directory]::CreateDirectory((Join-Path $Bundle 'resources')) | Out-Null
    & $env:RIFT_NODE --input-type=module -e 'import {createPackage} from "@electron/asar"; await createPackage(process.argv[1],process.argv[2]);' $InputDir (Join-Path $Bundle 'resources/app.asar')
    if ($env:RIFT_COPY_FAIL -eq '1') {
        $Blocked = Join-Path $Bundle 'unreadable-resource'
        [IO.File]::WriteAllText($Blocked, 'copy must fail')
        [IO.File]::SetUnixFileMode($Blocked, [IO.UnixFileMode]::None)
    }
    $global:LASTEXITCODE = $LASTEXITCODE
}
function Get-Process {
    param([string]$Name, [string]$ErrorAction)
    if ($Name -ne 'RiftTask') { throw 'Unexpected process query' }
    if ($env:RIFT_RUNNING -eq '1') { return [pscustomobject]@{ProcessName='RiftTask'} }
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
