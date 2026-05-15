param(
  [Parameter(Mandatory = $true)]
  [string]$CloudPath
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")

if (-not (Test-Path -LiteralPath $CloudPath)) {
  Write-Error "Cloud source folder does not exist: $CloudPath"
  exit 1
}

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

robocopy $CloudPath $ProjectRoot.Path /E /XD $ExcludeDirectories /XF $ExcludeFiles /R:2 /W:2

$ExitCode = $LASTEXITCODE

if ($ExitCode -le 7) {
  Write-Host "Synced source files from cloud folder: $CloudPath"
  exit 0
}

Write-Error "robocopy failed with exit code $ExitCode"
exit $ExitCode
