# Meldet das Hilfsprogramm bei Thunderbird an (Native Messaging, nur fuer den aktuellen Benutzer) und baut das Add-on.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Daten immer im Haupt-Checkout, damit Gelerntes einen Worktree ueberlebt.
$haupt = $root
try {
  $common = (git -C $root rev-parse --path-format=absolute --git-common-dir 2>$null)
  if ($common) { $haupt = Split-Path -Parent ($common -replace '/', '\') }
} catch { }
$daten = Join-Path $haupt 'daten'
New-Item -ItemType Directory -Force $daten | Out-Null

$node = (Get-Command node -ErrorAction Stop).Source
$hostOrdner = Join-Path $root 'host'
$cmd = Join-Path $hostOrdner 'host.cmd'
$inhalt = "@echo off`r`nset ""RSP_DATEN=$daten""`r`n""$node"" ""%~dp0host.js"" %*`r`n"
[IO.File]::WriteAllText($cmd, $inhalt, [Text.Encoding]::ASCII)

$manifest = Join-Path $hostOrdner 'rechtschreibpruefung.json'
$json = [ordered]@{
  name               = 'rechtschreibpruefung'
  description        = 'Rechtschreibpruefung mit Claude'
  path               = $cmd
  type               = 'stdio'
  allowed_extensions = @('rechtschreibpruefung@lokal')
} | ConvertTo-Json
[IO.File]::WriteAllText($manifest, $json, $utf8)

foreach ($basis in 'HKCU:\Software\Mozilla\NativeMessagingHosts', 'HKCU:\Software\Thunderbird\NativeMessagingHosts') {
  $schluessel = Join-Path $basis 'rechtschreibpruefung'
  New-Item -Path $schluessel -Force | Out-Null
  Set-ItemProperty -Path $schluessel -Name '(default)' -Value $manifest
}

& (Join-Path $root 'bauen.ps1')

Write-Host ''
Write-Host "Hilfsprogramm angemeldet: $manifest"
Write-Host "Gelerntes liegt in:       $daten"
Write-Host ''
Write-Host 'Jetzt in Thunderbird: Add-ons und Themes > Zahnrad > Add-on aus Datei installieren >'
Write-Host "  $(Join-Path $root 'dist\rechtschreibpruefung.xpi')"
