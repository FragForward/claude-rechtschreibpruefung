# Laesst die Firefox-Erweiterung von Mozilla signieren (Kanal "nicht gelistet", wird nicht veroeffentlicht).
# Die signierte .xpi landet in dist\signiert. Jede Version kann nur einmal signiert werden.
# Schluessel erzeugen: https://addons.mozilla.org/developers/addon/api/key/
# Ablage: %USERPROFILE%\.schluessel\mozilla-amo.xml, mit Windows-DPAPI an den Benutzer gebunden verschluesselt
# (nur dieser Windows-Benutzer auf diesem PC kann sie lesen). Ohne Datei wird gefragt und das Speichern angeboten.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$ablage = Join-Path $env:USERPROFILE '.schluessel\mozilla-amo.xml'

& (Join-Path $root 'bauen.ps1') | Out-Null
$version = (Get-Content (Join-Path $root 'extension\manifest.firefox.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
Write-Host "Signiere Version $version ..."

if (Test-Path $ablage) {
  $zugang = Import-Clixml $ablage
} else {
  $aussteller = Read-Host 'JWT-Aussteller (beginnt mit user:)'
  $geheim = Read-Host 'JWT-Geheimnis' -AsSecureString
  $zugang = New-Object System.Management.Automation.PSCredential($aussteller, $geheim)
  if ((Read-Host "Verschluesselt unter $ablage speichern, damit kuenftig ohne Eingabe signiert werden kann? (j/n)") -eq 'j') {
    New-Item -ItemType Directory -Force (Split-Path $ablage) | Out-Null
    $zugang | Export-Clixml $ablage
    Write-Host 'Gespeichert.'
  }
}

# web-ext liest die Schluessel aus der Umgebung; so stehen sie nicht in der Befehlszeile.
$env:WEB_EXT_API_KEY = $zugang.UserName
$env:WEB_EXT_API_SECRET = $zugang.GetNetworkCredential().Password

$ziel = Join-Path $root 'dist\signiert'
npx --yes web-ext@8 sign --channel unlisted --source-dir (Join-Path $root 'dist\firefox') --artifacts-dir $ziel
$code = $LASTEXITCODE
Remove-Item Env:WEB_EXT_API_SECRET, Env:WEB_EXT_API_KEY
if ($code -ne 0) { throw "Signieren fehlgeschlagen (Code $code)" }

Write-Host ''
Write-Host "Fertig. Signierte Datei in $ziel"
Write-Host 'In Firefox: about:addons > Zahnrad > Add-on aus Datei installieren > die .xpi aus diesem Ordner.'
