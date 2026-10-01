# Laesst die Firefox-Erweiterung von Mozilla signieren (Kanal "nicht gelistet", wird nicht veroeffentlicht).
# Die signierte .xpi landet in dist\signiert. Jede Version kann nur einmal signiert werden.
# Schluessel erzeugen: https://addons.mozilla.org/developers/addon/api/key/
# Sie werden nur fuer diesen Aufruf abgefragt und nicht gespeichert.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

& (Join-Path $root 'bauen.ps1') | Out-Null
$version = (Get-Content (Join-Path $root 'extension\manifest.firefox.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
Write-Host "Signiere Version $version ..."

if (-not $env:WEB_EXT_API_KEY) { $env:WEB_EXT_API_KEY = Read-Host 'JWT-Aussteller (beginnt mit user:)' }
if (-not $env:WEB_EXT_API_SECRET) {
  $geheim = Read-Host 'JWT-Geheimnis' -AsSecureString
  $env:WEB_EXT_API_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($geheim))
}

$ziel = Join-Path $root 'dist\signiert'
npx --yes web-ext@8 sign --channel unlisted --source-dir (Join-Path $root 'dist\firefox') --artifacts-dir $ziel
if ($LASTEXITCODE -ne 0) { throw "Signieren fehlgeschlagen (Code $LASTEXITCODE)" }

Write-Host ''
Write-Host "Fertig. Signierte Datei in $ziel"
Write-Host 'In Firefox: about:addons > Zahnrad > Add-on aus Datei installieren > die .xpi aus diesem Ordner.'
