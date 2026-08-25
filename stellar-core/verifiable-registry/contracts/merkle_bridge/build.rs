use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    let manifest_dir = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").unwrap());
    let asset_workspace = manifest_dir.join("../../../carbon-asset-factory");
    let asset_manifest = asset_workspace.join("Cargo.toml");
    let artifact = asset_workspace.join(
        "target/wasm32-unknown-unknown/release/carbon_asset.wasm",
    );

    println!("cargo:rerun-if-changed={}", asset_manifest.display());
    println!(
        "cargo:rerun-if-changed={}",
        asset_workspace.join("contracts/carbon_asset/src").display()
    );

    if !artifact.exists() {
        let status = Command::new("cargo")
            .args([
                "build",
                "--manifest-path",
                asset_manifest.to_str().unwrap(),
                "--package",
                "carbon_asset",
                "--target",
                "wasm32-unknown-unknown",
                "--release",
            ])
            .status()
            .expect("failed to start CarbonAsset WASM build");

        if !status.success() {
            panic!("CarbonAsset WASM build failed with status {status}");
        }
    }

    if !artifact.exists() {
        panic!("CarbonAsset WASM was not generated at {}", artifact.display());
    }
}