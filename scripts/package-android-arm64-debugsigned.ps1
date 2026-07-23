param(
  [ValidateSet('aarch64', 'armv7')]
  [Alias('Target')]
  [string]$AndroidTarget = 'aarch64',
  [switch]$RebuildRust
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

$targetConfigs = @{
  aarch64 = @{
    Label = 'arm64'
    TauriTarget = 'aarch64'
    RustTarget = 'aarch64-linux-android'
    Abi = 'arm64-v8a'
    GradleVariant = 'Arm64'
    ApkDirName = 'arm64'
    OutputSuffix = ''
  }
  armv7 = @{
    Label = 'ARMv7'
    TauriTarget = 'armv7'
    RustTarget = 'armv7-linux-androideabi'
    Abi = 'armeabi-v7a'
    GradleVariant = 'Arm'
    ApkDirName = 'arm'
    OutputSuffix = '-32bit'
  }
}
$config = $targetConfigs[$AndroidTarget]
$label = [string]$config['Label']
$tauriTarget = [string]$config['TauriTarget']
$rustTarget = [string]$config['RustTarget']
$abi = [string]$config['Abi']
$gradleVariant = [string]$config['GradleVariant']
$apkDirName = [string]$config['ApkDirName']
$outputSuffix = [string]$config['OutputSuffix']

$androidDir = Join-Path $root 'src-tauri\gen\android'
$appDir = Join-Path $androidDir 'app'
$sourceSo = Join-Path $root "src-tauri\target\$rustTarget\release\libapp_lib.so"
$jniDir = Join-Path $appDir "src\main\jniLibs\$abi"
$jniSo = Join-Path $jniDir 'libapp_lib.so'
$releaseDir = Join-Path $root 'release'
$alignedApk = Join-Path $releaseDir "pocket$version$outputSuffix-aligned.apk"
$finalApk = Join-Path $releaseDir "pocket$version$outputSuffix.apk"

function Convert-VersionNameToCode([string]$versionName) {
  $core = ($versionName -split '[-+]')[0]
  $parts = $core -split '\.'
  $major = 0
  $minor = 0
  $patch = 0

  if ($parts.Count -ge 1 -and $parts[0] -match '^\d+$') { $major = [int]$parts[0] }
  if ($parts.Count -ge 2 -and $parts[1] -match '^\d+$') { $minor = [int]$parts[1] }
  if ($parts.Count -ge 3 -and $parts[2] -match '^\d+$') { $patch = [int]$parts[2] }

  $code = ($major * 10000) + ($minor * 100) + $patch
  if ($code -lt 1) { return 1 }
  return $code
}

function Resolve-AndroidSdk {
  $candidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

  foreach ($candidate in $candidates) {
    return (Resolve-Path -LiteralPath $candidate).Path
  }

  throw 'Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT, or install it under %LOCALAPPDATA%\Android\Sdk.'
}

function Resolve-BuildTool([string]$sdk, [string]$toolName) {
  $buildToolsDir = Join-Path $sdk 'build-tools'
  if (-not (Test-Path -LiteralPath $buildToolsDir)) {
    throw "Android SDK build-tools directory not found: $buildToolsDir"
  }

  $tool = Get-ChildItem -Directory -LiteralPath $buildToolsDir |
    Sort-Object -Property @{ Expression = { try { [version]$_.Name } catch { [version]'0.0.0' } } } -Descending |
    ForEach-Object {
      $candidate = Join-Path $_.FullName $toolName
      if (Test-Path -LiteralPath $candidate) { $candidate }
    } |
    Select-Object -First 1

  if (-not $tool) {
    throw "$toolName not found in Android SDK build-tools: $buildToolsDir"
  }

  return $tool
}

function Resolve-Keytool {
  $pathCommand = Get-Command keytool -ErrorAction SilentlyContinue
  if ($pathCommand) { return $pathCommand.Source }

  if ($env:JAVA_HOME) {
    $candidate = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }

  throw 'keytool not found. Install a JDK or set JAVA_HOME.'
}

function Ensure-DebugKeystore([string]$keytool) {
  $androidHome = Join-Path $env:USERPROFILE '.android'
  $keystore = Join-Path $androidHome 'debug.keystore'
  if (Test-Path -LiteralPath $keystore) { return $keystore }

  New-Item -ItemType Directory -Force -Path $androidHome | Out-Null
  & $keytool -genkeypair -v -keystore $keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Android Debug,O=Android,C=US'
  if ($LASTEXITCODE -ne 0) { throw 'Failed to create Android debug keystore.' }
  return $keystore
}

function Get-AndroidReleaseApk([string]$apkDirectoryName, [string]$apkLabel) {
  $apkRoot = Join-Path $appDir 'build\outputs\apk'
  if (-not (Test-Path -LiteralPath $apkRoot)) {
    throw "Gradle APK output directory not found: $apkRoot"
  }

  $escapedApkDirName = [regex]::Escape($apkDirectoryName)
  $apk = Get-ChildItem -Recurse -File -LiteralPath $apkRoot -Filter '*.apk' |
    Where-Object { $_.FullName -match "\\$escapedApkDirName\\release\\" -or $_.Name -match "-$escapedApkDirName-release" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $apk) {
    throw "$apkLabel release APK not found under: $apkRoot"
  }

  return $apk.FullName
}

$sdk = Resolve-AndroidSdk
$zipalign = Resolve-BuildTool $sdk 'zipalign.exe'
$apksigner = Resolve-BuildTool $sdk 'apksigner.bat'
$keytool = Resolve-Keytool
$debugKeystore = Ensure-DebugKeystore $keytool

if ($RebuildRust -or -not (Test-Path -LiteralPath $sourceSo)) {
  $previousSourceSoWriteTime = if (Test-Path -LiteralPath $sourceSo) { (Get-Item -LiteralPath $sourceSo).LastWriteTimeUtc } else { $null }
  Write-Host "Rebuilding $label Rust library and Tauri Android assets..."
  Push-Location $root
  try {
    & npm.cmd run tauri -- android build --target $tauriTarget --apk --ci
    if ($LASTEXITCODE -ne 0) {
      $rebuiltSourceSo = Test-Path -LiteralPath $sourceSo
      $currentSourceSoWriteTime = if ($rebuiltSourceSo) { (Get-Item -LiteralPath $sourceSo).LastWriteTimeUtc } else { $null }
      $sourceSoUpdated = $rebuiltSourceSo -and ($null -eq $previousSourceSoWriteTime -or $currentSourceSoWriteTime -gt $previousSourceSoWriteTime)
      if (-not $sourceSoUpdated) { throw "Tauri Android rebuild failed before refreshing the $label Rust library." }
      Write-Host "Tauri Android build returned a non-zero exit code after refreshing the $label Rust library; continuing with manual APK assembly."
    }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath $sourceSo)) {
  throw "Rust $label library not found: $sourceSo"
}
Write-Host "Using $label Rust library:"
Write-Host $sourceSo
Write-Host ("Rust library timestamp: " + (Get-Item -LiteralPath $sourceSo).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))

$androidVersionCode = Convert-VersionNameToCode $version
$tauriProperties = Join-Path $appDir 'tauri.properties'
@(
  "tauri.android.versionCode=$androidVersionCode"
  "tauri.android.versionName=$version"
) | Set-Content -LiteralPath $tauriProperties -Encoding ASCII
Write-Host "Android versionName: $version"
Write-Host "Android versionCode: $androidVersionCode"

New-Item -ItemType Directory -Force -Path $jniDir | Out-Null
$jniItem = Get-Item -LiteralPath $jniSo -Force -ErrorAction SilentlyContinue
$linkedSource = $null
if ($jniItem -and $jniItem.LinkType -eq 'SymbolicLink') {
  $linkTargets = @($jniItem.Target)
  if ($linkTargets.Count -gt 0) {
    $linkTarget = [string]$linkTargets[0]
    if (-not [System.IO.Path]::IsPathRooted($linkTarget)) {
      $linkTarget = Join-Path $jniDir $linkTarget
    }
    $linkedSource = [System.IO.Path]::GetFullPath($linkTarget)
  }
}

$sourceFullPath = [System.IO.Path]::GetFullPath($sourceSo)
if ($linkedSource -and $linkedSource.Equals($sourceFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
  Write-Host "$label library is already linked: $jniSo"
} else {
  Copy-Item -LiteralPath $sourceSo -Destination $jniSo -Force
  Write-Host "Copied $label library: $jniSo"
}

$assembleTask = "assemble${gradleVariant}Release"
$rustBuildTask = "rustBuild${gradleVariant}Release"
Push-Location $androidDir
try {
  & .\gradlew.bat $assembleTask -x $rustBuildTask
  if ($LASTEXITCODE -ne 0) { throw "Gradle $assembleTask failed." }
} finally {
  Pop-Location
}

$unsignedApk = Get-AndroidReleaseApk $apkDirName $label
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
if (Test-Path -LiteralPath $alignedApk) { Remove-Item -LiteralPath $alignedApk -Force }
if (Test-Path -LiteralPath $finalApk) { Remove-Item -LiteralPath $finalApk -Force }
if (Test-Path -LiteralPath "$finalApk.idsig") { Remove-Item -LiteralPath "$finalApk.idsig" -Force }

& $zipalign -p -f 4 $unsignedApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed.' }

& $apksigner sign --ks $debugKeystore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out $finalApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw 'apksigner sign failed.' }

& $apksigner verify --verbose $finalApk
if ($LASTEXITCODE -ne 0) { throw 'apksigner verify failed.' }

Remove-Item -LiteralPath $alignedApk -Force
if (Test-Path -LiteralPath "$finalApk.idsig") { Remove-Item -LiteralPath "$finalApk.idsig" -Force }
Write-Host "Android $label debug-signed APK:"
Write-Host $finalApk
