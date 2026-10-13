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

# Veroeffentlichen: .xpi als GitHub-Release, updates.json im Zweig firefox-aktualisierung.
# Firefox fragt die update_url aus manifest.firefox.json etwa einmal am Tag ab (13.10.2026).
$ErrorActionPreference = 'Continue' # gh meldet "nicht gefunden" ueber stderr
$repo = 'FragForward/claude-rechtschreibpruefung'
$zweig = 'firefox-aktualisierung'
$signiert = Get-ChildItem $ziel -Filter "*-$version.xpi" | Sort-Object LastWriteTime | Select-Object -Last 1
if (-not $signiert) { throw "Signierte Datei fuer $version nicht gefunden" }
$name = "rechtschreibpruefung-firefox-$version.xpi"
$upload = Join-Path $env:TEMP $name
Copy-Item $signiert.FullName $upload -Force
gh release view "v$version" --repo $repo *> $null
if ($LASTEXITCODE -eq 0) { gh release upload "v$version" $upload --clobber --repo $repo }
else { gh release create "v$version" $upload --repo $repo --title "Version $version" --notes "Signierte Firefox-Erweiterung $version. Installierte Versionen ab 0.6.0 aktualisieren sich selbst." }
if ($LASTEXITCODE -ne 0) { throw 'GitHub-Release fehlgeschlagen' }
Remove-Item $upload

$updates = @{ addons = @{ 'rechtschreibpruefung@lokal' = @{ updates = @(@{
  version = $version
  update_link = "https://github.com/$repo/releases/download/v$version/$name"
}) } } } | ConvertTo-Json -Depth 6
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($updates))
gh api "repos/$repo/branches/$zweig" *> $null
if ($LASTEXITCODE -ne 0) {
  $basis = gh api "repos/$repo/git/ref/heads/master" --jq '.object.sha'
  gh api "repos/$repo/git/refs" -f "ref=refs/heads/$zweig" -f "sha=$basis" | Out-Null
}
$alt = gh api "repos/$repo/contents/updates.json?ref=$zweig" --jq '.sha' 2>$null
$felder = @('-X', 'PUT', "repos/$repo/contents/updates.json", '-f', "message=Firefox-Aktualisierung $version", '-f', "content=$b64", '-f', "branch=$zweig")
if ($LASTEXITCODE -eq 0 -and $alt) { $felder += @('-f', "sha=$alt") }
gh api @felder | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'updates.json konnte nicht geschrieben werden' }

Write-Host ''
Write-Host "Fertig. Signierte Datei in $ziel, veroeffentlicht als Release v$version."
Write-Host 'Firefox ab 0.6.0 holt die neue Version selbst (about:addons > Zahnrad > Nach Updates suchen beschleunigt es).'
