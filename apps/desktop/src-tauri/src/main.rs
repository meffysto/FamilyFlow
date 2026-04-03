#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct VaultFile {
    path: String,
    name: String,
    relative_path: String,
    is_directory: bool,
}

#[tauri::command]
fn list_vault_files(vault_path: String) -> Result<Vec<VaultFile>, String> {
    let base = PathBuf::from(&vault_path);
    if !base.exists() {
        return Err(format!("Le chemin du vault n'existe pas: {}", vault_path));
    }

    let mut files = Vec::new();
    collect_files(&base, &base, &mut files).map_err(|e| e.to_string())?;
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(files)
}

fn collect_files(
    base: &Path,
    dir: &Path,
    files: &mut Vec<VaultFile>,
) -> std::io::Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            if name.starts_with('.') {
                continue;
            }
        }

        if path.is_dir() {
            collect_files(base, &path, files)?;
        } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if matches!(ext, "md" | "cook" | "jpg" | "jpeg" | "png" | "heic" | "gif" | "webp") {
                let relative = path.strip_prefix(base).unwrap_or(&path);
                files.push(VaultFile {
                    path: path.to_string_lossy().into_owned(),
                    name: path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .into_owned(),
                    relative_path: relative.to_string_lossy().into_owned(),
                    is_directory: false,
                });
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn read_vault_file(path: String) -> Result<String, String> {
    if path.contains("..") {
        return Err("Chemin invalide: traversal interdit".into());
    }
    fs::read_to_string(&path).map_err(|e| format!("Impossible de lire {}: {}", path, e))
}

#[tauri::command]
fn write_vault_file(path: String, content: String) -> Result<(), String> {
    if path.contains("..") {
        return Err("Chemin invalide: traversal interdit".into());
    }
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Impossible de creer les repertoires: {}", e))?;
    }
    fs::write(&path, content).map_err(|e| format!("Impossible d'ecrire {}: {}", path, e))
}

#[tauri::command]
fn delete_vault_file(path: String) -> Result<(), String> {
    if path.contains("..") {
        return Err("Chemin invalide: traversal interdit".into());
    }
    fs::remove_file(&path).map_err(|e| format!("Impossible de supprimer {}: {}", path, e))
}

#[tauri::command]
fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// Read a binary file and return it as a base64 data URI.
#[tauri::command]
fn read_image_base64(path: String) -> Result<String, String> {
    use std::io::Read;
    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "heic" | "heif" => "image/heic",
        _ => "image/jpeg",
    };
    let mut file = fs::File::open(&path)
        .map_err(|e| format!("Cannot open {}: {}", path, e))?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf)
        .map_err(|e| format!("Cannot read {}: {}", path, e))?;
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
    Ok(format!("data:{};base64,{}", mime, b64))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            list_vault_files,
            read_vault_file,
            write_vault_file,
            delete_vault_file,
            file_exists,
            read_image_base64,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du demarrage de l'application Tauri");
}
