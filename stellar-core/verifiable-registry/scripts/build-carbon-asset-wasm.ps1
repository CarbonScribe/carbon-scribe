$ErrorActionPreference = "Stop"

$assetWorkspace = Join-Path $PSScriptRoot "..\..\carbon-asset-factory"
Push-Location $assetWorkspace
try {
    cargo build --release --target wasm32-unknown-unknown -p carbon_asset
}
finally {
    Pop-Location
}

$artifact = Join-Path $assetWorkspace "target\wasm32-unknown-unknown\release\carbon_asset.wasm"
if (-not (Test-Path $artifact)) {
    throw "CarbonAsset WASM was not generated at $artifact"
}

Write-Output $artifact