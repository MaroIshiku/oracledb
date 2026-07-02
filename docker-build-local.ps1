$ErrorActionPreference = "Stop"

$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $env:TEMP "oracle-db-web2-docker-build"

if (Test-Path $target) {
  Remove-Item -Recurse -Force $target
}

Copy-Item -Recurse -Force $source $target
docker build -t oracle-db-static:latest $target

Write-Host "Built oracle-db-static:latest from temporary local context: $target"
