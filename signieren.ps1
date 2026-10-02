# Laesst die Firefox-Erweiterung von Mozilla signieren (Kanal "nicht gelistet", wird nicht veroeffentlicht).
# Die signierte .xpi landet in dist\signiert. Jede Version kann nur einmal signiert werden.
# Schluessel erzeugen: https://addons.mozilla.org/developers/addon/api/key/
# Ablage wie bei den anderen Projekten: %USERPROFILE%\.claude\secrets\mozilla-amo.env
# (WEB_EXT_API_KEY, WEB_EXT_API_SECRET). Fehlt die Datei, wird gefragt und das Anlegen angeboten.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$ablage = Join-Path $env:USERPROFILE '.claude\secrets\mozilla-amo.env'

& (Join-Path $root 'bauen.ps1') | Out-Null
$version = (Get-Content (Join-Path $root 'extension\manifest.firefox.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
Write-Host "Signiere Version $version ..."

$werte = @{}
if (Test-Path $ablage) {
  foreach ($zeile in Get-Content $ablage) {
    if ($zeile -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') { $werte[$Matches[1]] = $Matches[2].Trim('"') }
  }
}
if (-not $werte.WEB_EXT_API_KEY -or -not $werte.WEB_EXT_API_SECRET) {
  $werte.WEB_EXT_API_KEY = Read-Host 'JWT-Aussteller (beginnt mit user:)'
  $geheim = Read-Host 'JWT-Geheimnis' -AsSecureString
  $werte.WEB_EXT_API_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($geheim))
  if ((Read-Host "Unter $ablage ablegen, damit kuenftig ohne Eingabe signiert werden kann? (j/n)") -eq 'j') {
    New-Item -ItemType Directory -Force (Split-Path $ablage) | Out-Null
    $inhalt = "# addons.mozilla.org, fuer signieren.ps1 (Rechtschreibpruefung)`r`nWEB_EXT_API_KEY=$($werte.WEB_EXT_API_KEY)`r`nWEB_EXT_API_SECRET=$($werte.WEB_EXT_API_SECRET)`r`n"
    [IO.File]::WriteAllText($ablage, $inhalt, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host 'Abgelegt.'
  }
}

# web-ext liest die Schluessel aus der Umgebung; so stehen sie nicht in der Befehlszeile.
$env:WEB_EXT_API_KEY = $werte.WEB_EXT_API_KEY
$env:WEB_EXT_API_SECRET = $werte.WEB_EXT_API_SECRET

$ziel = Join-Path $root 'dist\signiert'
npx --yes web-ext@8 sign --channel unlisted --source-dir (Join-Path $root 'dist\firefox') --artifacts-dir $ziel
$code = $LASTEXITCODE
Remove-Item Env:WEB_EXT_API_SECRET, Env:WEB_EXT_API_KEY
if ($code -ne 0) { throw "Signieren fehlgeschlagen (Code $code)" }

Write-Host ''
Write-Host "Fertig. Signierte Datei in $ziel"
Write-Host 'In Firefox: about:addons > Zahnrad > Add-on aus Datei installieren > die .xpi aus diesem Ordner.'
