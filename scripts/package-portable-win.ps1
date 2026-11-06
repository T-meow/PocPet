param(
  [ValidateSet('x64', 'x86')]
  [string]$Target = 'x64'
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$packageJson = Join-Path $root 'package.json'
if (-not (Test-Path -LiteralPath $packageJson)) {
  throw "package.json not found: $packageJson"
}

$project = Get-Content -LiteralPath $packageJson -Raw | ConvertFrom-Json
$version = [string]$project.version
if ([string]::IsNullOrWhiteSpace($version)) {
  throw 'Project version not found in package.json.'
}

$targetConfig = switch ($Target) {
  'x64' { @{ Source = 'src-tauri\target\release\app.exe'; Suffix = '' } }
  'x86' { @{ Source = 'src-tauri\target\i686-pc-windows-msvc\release\app.exe'; Suffix = '-win32' } }
}
$sourceRelative = [string]$targetConfig['Source']
$outputSuffix = [string]$targetConfig['Suffix']

$source = Join-Path $root $sourceRelative
& node (Join-Path $root 'scripts/check.mjs') --release --dist (Join-Path $root 'dist') --binary $source --arch $Target
if ($LASTEXITCODE -ne 0) { throw 'Portable executable metadata or embedded frontend validation failed.' }
$binaryVersion = (Get-Item -LiteralPath $source).VersionInfo.ProductVersion
if ($binaryVersion -ne $version) { throw "Executable version mismatch: $binaryVersion (expected $version)." }
$distIndex = Join-Path $root 'dist\index.html'
$releaseDir = Join-Path $root 'release'
$targetPath = Join-Path $releaseDir "pocket$version$outputSuffix.exe"

if (-not (Test-Path -LiteralPath $distIndex)) {
  throw "Vite index.html not found: $distIndex"
}

if (-not (Test-Path -LiteralPath $source)) {
  throw "Tauri executable not found: $source"
}

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Copy-Item -LiteralPath $source -Destination $targetPath -Force

# A workspace can carry an inherited Low mandatory integrity label. Executables
# built/copied there then start at Low integrity and cannot create their WebView2
# profile in AppData. Label only our executables; leave directory permissions alone.
$currentUserSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
foreach ($executable in @($source, $targetPath)) {
  # These are our build outputs. Changing their labels requires WRITE_OWNER,
  # which inherited Modify lacks. Use icacls without loading PowerShell modules.
  & icacls.exe $executable /grant "*$($currentUserSid.Value):(WO)"
  if ($LASTEXITCODE -ne 0) { throw "Could not prepare executable '$executable' for integrity labeling." }
  & icacls.exe $executable /setintegritylevel M
  if ($LASTEXITCODE -ne 0) {
    throw "Could not set Medium integrity on '$executable'; the app may be unable to open its user data directory."
  }
}

$indexContent = Get-Content -LiteralPath $distIndex -Raw
$expectedAssets = [regex]::Matches($indexContent, 'assets/[^"]+\.(js|css)') | ForEach-Object { $_.Value }
if ($expectedAssets.Count -eq 0) {
  throw "No JavaScript or CSS asset references found in: $distIndex"
}

$latin1 = [System.Text.Encoding]::GetEncoding(28591)
$exeText = $latin1.GetString([System.IO.File]::ReadAllBytes($targetPath))
foreach ($asset in $expectedAssets) {
  if (-not $exeText.Contains($asset)) {
    throw "Portable exe does not contain frontend asset reference '$asset'. The Tauri embedded assets are stale or missing."
  }
}

Write-Host "Portable Windows $Target executable:"
Write-Host $targetPath
