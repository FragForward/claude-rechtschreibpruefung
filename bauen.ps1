# Baut das Thunderbird-Add-on nach dist\: content.js aus den Teilen in Ladereihenfolge, dazu die .xpi.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$quelle = Join-Path $root 'extension'
$ziel = Join-Path $root 'dist\thunderbird'
$xpi = Join-Path $root 'dist\rechtschreibpruefung.xpi'

if (Test-Path $ziel) { Remove-Item -Recurse -Force $ziel }
New-Item -ItemType Directory -Force $ziel | Out-Null

Copy-Item (Join-Path $quelle '*') $ziel -Recurse
$teile = Get-ChildItem (Join-Path $quelle 'content') -Filter '*.js' | Sort-Object Name
$utf8 = New-Object System.Text.UTF8Encoding($false)
$gesamt = ($teile | ForEach-Object { [IO.File]::ReadAllText($_.FullName, $utf8) }) -join "`n"
[IO.File]::WriteAllText((Join-Path $ziel 'content.js'), $gesamt, $utf8)

# Zip mit Schraegstrichen in den Pfaden; Compress-Archive in PS 5.1 schreibt Backslashes, die Thunderbird nicht liest.
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
if (Test-Path $xpi) { Remove-Item -Force $xpi }
$zip = [IO.Compression.ZipFile]::Open($xpi, 'Create')
try {
  Get-ChildItem $ziel -Recurse -File | ForEach-Object {
    $name = $_.FullName.Substring($ziel.Length + 1).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $name) | Out-Null
  }
} finally { $zip.Dispose() }

Write-Host "Gebaut: $xpi"
