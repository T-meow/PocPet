$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
& node (Join-Path $root 'scripts/check-release.mjs') --dist (Join-Path $root 'dist')
if ($LASTEXITCODE -ne 0) { throw 'Web release metadata validation failed.' }
$packageJson = Join-Path $root 'package.json'
if (-not (Test-Path -LiteralPath $packageJson)) {
  throw "package.json not found: $packageJson"
}

$project = Get-Content -LiteralPath $packageJson -Raw | ConvertFrom-Json
$version = [string]$project.version
if ([string]::IsNullOrWhiteSpace($version)) {
  throw 'Project version not found in package.json.'
}

$distDir = Join-Path $root 'dist'
$distIndex = Join-Path $distDir 'index.html'
$releaseDir = Join-Path $root 'release'
$target = Join-Path $releaseDir "pocket$version-web.zip"

if (-not (Test-Path -LiteralPath $distIndex)) {
  throw "Vite index.html not found: $distIndex"
}

$distItems = Get-ChildItem -LiteralPath $distDir -Force
if ($distItems.Count -eq 0) {
  throw "No files found in Vite dist directory: $distDir"
}

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }

Compress-Archive -LiteralPath $distItems.FullName -DestinationPath $target -Force
if (-not (Test-Path -LiteralPath $target)) {
  throw "Web deployment package was not created: $target"
}

Write-Host 'Web deployment package:'
Write-Host $target
