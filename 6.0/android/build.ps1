[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$actualProjectRoot = (Resolve-Path $PSScriptRoot).Path
$actualWorkspaceRoot = (Resolve-Path (Join-Path $actualProjectRoot '..\..')).Path
$script:buildDrive = $null

# aapt2 on Windows cannot reliably open directories whose path contains
# Chinese characters. Build through a temporary drive letter while keeping all
# downloaded tools and outputs in this workspace.
if ($actualProjectRoot -match '[^\x00-\x7F]') {
    foreach ($letter in @('Z','Y','X','W','V','U','T','S','R','Q','P','O','N','M','L','K','J','I','H','G','F','E','D')) {
        if (-not (Test-Path -LiteralPath "${letter}:\")) {
            & subst.exe "${letter}:" $actualWorkspaceRoot
            if ($LASTEXITCODE -ne 0) { throw 'Could not create a temporary ASCII build path.' }
            $script:buildDrive = $letter
            break
        }
    }
    if (-not $script:buildDrive) { throw 'No free drive letter for the ASCII build path.' }
    $workspaceRoot = "${script:buildDrive}:\"
    $projectRoot = Join-Path $workspaceRoot '6.0\android'
} else {
    $projectRoot = $actualProjectRoot
    $workspaceRoot = $actualWorkspaceRoot
}

trap {
    Remove-Item Env:LINGUIST_STORE_PASS -ErrorAction SilentlyContinue
    Remove-Item Env:LINGUIST_KEY_PASS -ErrorAction SilentlyContinue
    if ($script:buildDrive) {
        & subst.exe "${script:buildDrive}:" /D | Out-Null
        $script:buildDrive = $null
    }
    throw
}

$toolsRoot = Join-Path $projectRoot 'toolchain'
$sdkRoot = Join-Path $toolsRoot 'sdk'
$jdkRoot = Join-Path $toolsRoot 'jdk17\jdk-17.0.2'
$sourceHtml = Join-Path $workspaceRoot '6.0\dist\linguist_6.5.0.html'
$buildRoot = Join-Path $projectRoot 'build'
$distRoot = Join-Path $projectRoot 'dist'
$sourceRoot = Join-Path $projectRoot 'app\src\main'
$javaRoot = Join-Path $sourceRoot 'java'
$resRoot = Join-Path $sourceRoot 'res'
$manifest = Join-Path $sourceRoot 'AndroidManifest.xml'
$androidJar = Join-Path $sdkRoot 'platforms\android-35\android.jar'
$buildTools = Join-Path $sdkRoot 'build-tools\35.0.0'
$keystoreDir = Join-Path $projectRoot 'keystore'
$keystore = Join-Path $keystoreDir 'linguist-release.jks'
$signingFile = Join-Path $keystoreDir 'signing.properties'
$outputApk = Join-Path $distRoot 'Linguist-6.5.0.apk'

$required = @(
    $sourceHtml,
    $androidJar,
    (Join-Path $jdkRoot 'bin\java.exe'),
    (Join-Path $buildTools 'aapt2.exe'),
    (Join-Path $buildTools 'd8.bat'),
    (Join-Path $buildTools 'zipalign.exe'),
    (Join-Path $buildTools 'apksigner.bat')
)
foreach ($path in $required) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required file is missing: $path"
    }
}

function Assert-ChildPath([string]$Path, [string]$Parent) {
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $fullParent = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($fullParent, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify a path outside the Android project: $fullPath"
    }
    return $fullPath
}

$buildRoot = Assert-ChildPath $buildRoot $projectRoot
$distRoot = Assert-ChildPath $distRoot $projectRoot

if (Test-Path -LiteralPath $buildRoot) {
    Remove-Item -LiteralPath $buildRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path `
    (Join-Path $buildRoot 'assets'), `
    (Join-Path $buildRoot 'classes'), `
    (Join-Path $buildRoot 'dex'), `
    (Join-Path $buildRoot 'gen'), `
    $distRoot, `
    $keystoreDir | Out-Null

$env:JAVA_HOME = $jdkRoot
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot

if (-not (Test-Path -LiteralPath $keystore) -or
    -not (Test-Path -LiteralPath $signingFile)) {
    $password = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    $keytool = Join-Path $jdkRoot 'bin\keytool.exe'
    & $keytool -genkeypair -v `
        -keystore $keystore `
        -storepass $password `
        -keypass $password `
        -alias linguist `
        -keyalg RSA `
        -keysize 3072 `
        -validity 10000 `
        -dname 'CN=Linguist, OU=Android, O=Linguist, L=Shanghai, ST=Shanghai, C=CN'
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the Android signing key.' }

    @(
        "storePassword=$password",
        "keyPassword=$password",
        'keyAlias=linguist'
    ) | Set-Content -LiteralPath $signingFile -Encoding ascii
    Write-Host 'Created a private APK signing key under 6.0/android/keystore.'
} else {
    Write-Host 'Using the existing APK signing key.'
}

$properties = @{}
Get-Content -LiteralPath $signingFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $properties[$matches[1].Trim()] = $matches[2]
    }
}
$storePassword = $properties['storePassword']
$keyPassword = $properties['keyPassword']
$keyAlias = $properties['keyAlias']
# A partial properties file from the first draft used the same password for
# both entries. Keep that key usable without printing or storing the secret in
# source control.
if (-not $keyPassword -and $storePassword) {
    $keyPassword = $storePassword
}
if (-not $storePassword -or -not $keyPassword -or -not $keyAlias) {
    throw 'The signing.properties file is incomplete.'
}

$assetsRoot = Join-Path $buildRoot 'assets'
Copy-Item -LiteralPath $sourceHtml -Destination (Join-Path $assetsRoot 'linguist.html')

$aapt2 = Join-Path $buildTools 'aapt2.exe'
$compiledResources = Join-Path $buildRoot 'resources.zip'
& $aapt2 compile --dir $resRoot -o $compiledResources
if ($LASTEXITCODE -ne 0) { throw 'Resource compilation failed.' }

$unsignedApk = Join-Path $buildRoot 'Linguist-6.5.0-unsigned.apk'
$genRoot = Join-Path $buildRoot 'gen'
& $aapt2 link `
    -o $unsignedApk `
    -I $androidJar `
    --manifest $manifest `
    -R $compiledResources `
    -A $assetsRoot `
    --java $genRoot `
    --auto-add-overlay
if ($LASTEXITCODE -ne 0) { throw 'APK resource linking failed.' }

$javaSources = @(
    (Join-Path $javaRoot 'app\linguist\dictionary\MainActivity.java'),
    (Join-Path $genRoot 'app\linguist\dictionary\R.java')
)
$javac = Join-Path $jdkRoot 'bin\javac.exe'
$classesRoot = Join-Path $buildRoot 'classes'
& $javac -encoding UTF-8 -source 8 -target 8 -classpath $androidJar -d $classesRoot $javaSources
if ($LASTEXITCODE -ne 0) { throw 'Java compilation failed.' }

$classFiles = Get-ChildItem -LiteralPath $classesRoot -Recurse -Filter '*.class' |
    ForEach-Object { $_.FullName }
$dexRoot = Join-Path $buildRoot 'dex'
$d8 = Join-Path $buildTools 'd8.bat'
& $d8 --release --min-api 23 --lib $androidJar --output $dexRoot $classFiles
if ($LASTEXITCODE -ne 0) { throw 'DEX compilation failed.' }

$jar = Join-Path $jdkRoot 'bin\jar.exe'
& $jar uf $unsignedApk -C $dexRoot classes.dex
if ($LASTEXITCODE -ne 0) { throw 'Could not add classes.dex to the APK.' }

$alignedApk = Join-Path $buildRoot 'Linguist-6.5.0-aligned.apk'
$zipalign = Join-Path $buildTools 'zipalign.exe'
& $zipalign -f -p 4 $unsignedApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed.' }

$env:LINGUIST_STORE_PASS = $storePassword
$env:LINGUIST_KEY_PASS = $keyPassword
$apksigner = Join-Path $buildTools 'apksigner.bat'
& $apksigner sign `
    --ks $keystore `
    --ks-key-alias $keyAlias `
    --ks-pass 'env:LINGUIST_STORE_PASS' `
    --key-pass 'env:LINGUIST_KEY_PASS' `
    --out $outputApk `
    $alignedApk
if ($LASTEXITCODE -ne 0) { throw 'APK signing failed.' }

& $apksigner verify --verbose --print-certs $outputApk
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }

$hash = (Get-FileHash -LiteralPath $outputApk -Algorithm SHA256).Hash.ToLowerInvariant()
@(
    "File: Linguist-6.5.0.apk",
    "SHA256: $hash",
    "Built: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss K'))",
    "Source: 6.0/dist/linguist_6.5.0.html"
) | Set-Content -LiteralPath (Join-Path $distRoot 'SHA256.txt') -Encoding utf8

Remove-Item Env:LINGUIST_STORE_PASS -ErrorAction SilentlyContinue
Remove-Item Env:LINGUIST_KEY_PASS -ErrorAction SilentlyContinue

if ($script:buildDrive) {
    & subst.exe "${script:buildDrive}:" /D | Out-Null
    $script:buildDrive = $null
}

Write-Host "APK: $(Join-Path $actualProjectRoot 'dist\Linguist-6.5.0.apk')"
Write-Host "SHA256: $hash"
