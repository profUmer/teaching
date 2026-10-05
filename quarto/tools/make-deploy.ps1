<#
    Builds a clean public bundle of the decks in _deploy\, and _deploy.zip
    alongside it.

    The zip is what itch.io wants: index.html sits at its root, which is the
    file itch looks for. It is also handy for uploading to an LMS or any plain
    web host.

    If you publish with `quarto publish gh-pages` you do not need this at all.

    Usage (from the quarto folder):
        pwsh -File tools\make-deploy.ps1
#>

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root '_deploy'
$zip = Join-Path $root '_deploy.zip'

# Rendered decks and everything they load at runtime. Sources, docs and the
# dev-only pages are deliberately left out.
$items = @(
    'index.html',
    'matrices.html',
    'vectors.html',
    'motion.html',
    'matrices_files',
    'vectors_files',
    'motion_files',
    'assets',
    'figs'
)

foreach ($i in $items) {
    if (-not (Test-Path (Join-Path $root $i))) {
        throw "missing $i - run 'quarto render' first"
    }
}

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

foreach ($i in $items) {
    Copy-Item (Join-Path $root $i) -Destination $out -Recurse
}

# Source maps are a third of the payload and are no use to a viewer.
Get-ChildItem $out -Recurse -Filter *.map | Remove-Item -Force

if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip

$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
$files = (Get-ChildItem $out -Recurse -File).Count

Write-Host ""
Write-Host "  _deploy\      $files files"
Write-Host "  _deploy.zip   $mb MB   <- upload this to itch.io"
Write-Host ""
Write-Host "  itch.io: set the project to 'HTML', tick 'This file will be played"
Write-Host "  in the browser', and set the viewport to 1280 x 720."
Write-Host ""
