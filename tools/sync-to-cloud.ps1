param(
  [Parameter(Mandatory = $true)]
  [string]$CloudPath
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$CloudParent = Split-Path -Parent $CloudPath

New-Item -ItemType Directory -Force -Path $CloudParent | Out-Null
New-Item -ItemType Directory -Force -Path $CloudPath | Out-Null

$ExcludeDirectories = @(
  "node_modules",
  ".next",
  ".git"
)

$ExcludeFiles = @(
  ".env",
  ".env.local",
  ".env.production",
  ".env.development"
)

robocopy $ProjectRoot.Path $CloudPath /E /XD $ExcludeDirectories /XF $ExcludeFiles /R:2 /W:2

$ExitCode = $LASTEXITCODE

if ($ExitCode -le 7) {
  Write-Host "Synced source files to cloud folder: $CloudPath"
  exit 0
}

Write-Error "robocopy failed with exit code $ExitCode"
exit $ExitCode
