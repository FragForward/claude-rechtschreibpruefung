# Baut Thunderbird- und Chrome-Erweiterung nach dist\thunderbird und dist\chrome, dazu die .xpi fuer Thunderbird.
# content.js und background.js entstehen durch Zusammenfuegen der Teile in Ladereihenfolge; die Teile werden mitgeliefert.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$quelle = Join-Path $root 'extension'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$version = (Get-Content (Join-Path $quelle 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
$stand = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fff'

function Zusammenfuegen($dateien, $ziel) {
  $text = ($dateien | ForEach-Object { [IO.File]::ReadAllText($_, $utf8) }) -join "`n"
  [IO.File]::WriteAllText($ziel, $text, $utf8)
}

# Je Ziel: Manifest und Plattformteil des Hintergrunds. Chrome und Firefox teilen sich den Webteil.
$ziele = [ordered]@{
  thunderbird = @('manifest.json', '20_thunderbird.js')
  chrome      = @('manifest.chrome.json', '20_web.js')
  firefox     = @('manifest.firefox.json', '20_web.js')
}
foreach ($plattform in $ziele.Keys) {
  $ziel = Join-Path $root "dist\$plattform"
  # Ordner nicht loeschen: die Browser laden die Erweiterung direkt von hier.
  New-Item -ItemType Directory -Force $ziel | Out-Null
  foreach ($teil in 'plattform.js', 'popup.html', 'popup.js', 'assistent.html', 'assistent.js', 'optionen.html', 'optionen.js', 'icon.svg', 'icons', 'content') {
    Copy-Item (Join-Path $quelle $teil) $ziel -Recurse -Force
  }
  # Vom Hintergrund nur die Teile dieses Ziels mitliefern (Mozilla bemaengelt fremde APIs).
  $hgZiel = Join-Path $ziel 'hintergrund'
  if (Test-Path $hgZiel) { Remove-Item -Recurse -Force $hgZiel }
  New-Item -ItemType Directory -Force $hgZiel | Out-Null
  foreach ($teil in '10_gemeinsam.js', $ziele[$plattform][1]) { Copy-Item (Join-Path $quelle "hintergrund\$teil") $hgZiel -Force }
  Copy-Item (Join-Path $quelle $ziele[$plattform][0]) (Join-Path $ziel 'manifest.json') -Force

  $inhalt = @(Join-Path $quelle 'plattform.js') + @(Get-ChildItem (Join-Path $quelle 'content') -Filter '*.js' | Sort-Object Name | ForEach-Object FullName)
  Zusammenfuegen $inhalt (Join-Path $ziel 'content.js')
  $hintergrund = @((Join-Path $quelle 'plattform.js'), (Join-Path $quelle 'hintergrund\10_gemeinsam.js'), (Join-Path $quelle "hintergrund\$($ziele[$plattform][1])"))
  Zusammenfuegen $hintergrund (Join-Path $ziel 'background.js')

  # Baustand zuletzt schreiben: die Erweiterung laedt sich neu, sobald er sich aendert.
  [IO.File]::WriteAllText((Join-Path $ziel 'bau.json'), "{""stand"":""$stand"",""version"":""$version""}", $utf8)
  Write-Host "Gebaut: $ziel"
}

# Pakete: Zip mit Schraegstrichen; Compress-Archive in PS 5.1 schreibt Backslashes, die Mozilla nicht liest.
# Version im Namen: Thunderbird haelt die zuletzt installierte Datei manchmal gesperrt.
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
function Packen($ordner, $datei) {
  if (Test-Path $datei) { Remove-Item -Force $datei }
  $zip = [IO.Compression.ZipFile]::Open($datei, 'Create')
  try {
    Get-ChildItem $ordner -Recurse -File | ForEach-Object {
      $name = $_.FullName.Substring($ordner.Length + 1).Replace('\', '/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $name) | Out-Null
    }
  } finally { $zip.Dispose() }
  Write-Host "Gebaut: $datei"
}
Packen (Join-Path $root 'dist\thunderbird') (Join-Path $root "dist\rechtschreibpruefung-$version.xpi")
# Firefox-Paket zum Signieren bei Mozilla (normales Firefox installiert nur signierte Erweiterungen dauerhaft)
Packen (Join-Path $root 'dist\firefox') (Join-Path $root "dist\rechtschreibpruefung-firefox-$version.zip")
