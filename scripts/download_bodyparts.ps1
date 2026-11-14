$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $projectRoot 'assets\models\source'
New-Item -ItemType Directory -Force $destination | Out-Null
# Windows certificate verification handles the archive's intermediate chain.
Invoke-WebRequest -Uri 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip' -OutFile (Join-Path $destination 'bodyparts3d-4.zip') -UseBasicParsing
Invoke-WebRequest -Uri 'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_element_parts.txt' -OutFile (Join-Path $destination 'isa_element_parts.txt') -UseBasicParsing
Write-Host 'BodyParts3D originals downloaded. Licence and attribution: assets/models/ATTRIBUTION.md'
