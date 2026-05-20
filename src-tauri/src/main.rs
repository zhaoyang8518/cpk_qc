// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use cpk_core::{parse_excel_file, SheetData};
use cpk_storage::Storage;
use chrono::{DateTime, Utc, NaiveDate, NaiveDateTime};
use std::fs::{self, File};
use std::io::Read;
use sha2::{Sha256, Digest};
use tauri::Emitter;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

struct DbImportState {
    cancel_flag: Arc<AtomicBool>,
}

#[derive(Clone, serde::Serialize)]
struct ProgressPayload {
    percent: f64,
    text: String,
}

#[tauri::command]
async fn cancel_db_import(state: tauri::State<'_, DbImportState>) -> Result<(), String> {
    state.cancel_flag.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
async fn parse_excel(path: String) -> Result<Vec<SheetData>, String> {
    parse_excel_file(&path)
}

#[tauri::command]
async fn test_db_connection(postgres_uri: String) -> Result<String, String> {
    let storage = Storage::connect(&postgres_uri).await?;
    storage.init_db().await?;
    Ok("Connected successfully".to_string())
}

#[tauri::command]
async fn get_excel_metadata(path: String) -> Result<String, String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    
    // Try to get creation time, fallback to modified time
    let time = metadata.created().or_else(|_| metadata.modified()).map_err(|e| e.to_string())?;
    
    let datetime: chrono::DateTime<chrono::Local> = time.into();
    // Return full ISO 8601 date-time string so we don't lose time precision
    Ok(datetime.to_rfc3339())
}

fn calculate_file_hash(path: &str) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| format!("Failed to open file for hashing: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 1024 * 1024]; // 1MB buffer
    loop {
        let count = file.read(&mut buffer).map_err(|e| format!("Failed to read file: {}", e))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    let result = hasher.finalize();
    Ok(format!("{:x}", result))
}

fn parse_date_string(date_str: &str) -> Result<DateTime<Utc>, String> {
    // 1. Try RFC 3339 / ISO 8601
    if let Ok(dt) = DateTime::parse_from_rfc3339(date_str) {
        return Ok(dt.with_timezone(&Utc));
    }
    // 2. Try YYYY-MM-DDTHH:MM:SS or YYYY-MM-DDTHH:MM
    let clean_str = date_str.replace('T', " ");
    if let Ok(ndt) = NaiveDateTime::parse_from_str(&clean_str, "%Y-%m-%d %H:%M:%S") {
        return Ok(ndt.and_utc());
    }
    if let Ok(ndt) = NaiveDateTime::parse_from_str(&clean_str, "%Y-%m-%d %H:%M") {
        return Ok(ndt.and_utc());
    }
    // 3. Try YYYY-MM-DD
    if let Ok(nd) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        if let Some(ndt) = nd.and_hms_opt(0, 0, 0) {
            return Ok(ndt.and_utc());
        }
    }
    Err(format!("Could not parse date string: '{}'", date_str))
}

#[tauri::command]
async fn save_to_db(
    window: tauri::Window,
    state: tauri::State<'_, DbImportState>,
    file_path: String,
    test_date: String,
    sheets: Vec<SheetData>,
    postgres_uri: String,
    force_overwrite: bool,
) -> Result<i32, String> {
    state.cancel_flag.store(false, Ordering::SeqCst);
    let cancel_flag = state.cancel_flag.clone();
    let storage = Storage::connect(&postgres_uri).await?;
    
    // Initialize schema if not exists
    storage.init_db().await?;

    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Invalid file path".to_string())?;

    let file_hash = calculate_file_hash(&file_path)?;
    let parsed_date = parse_date_string(&test_date)?;

    // If force_overwrite is false, check if hash already exists
    if !force_overwrite && storage.check_hash_exists(&file_hash).await? {
        return Err("FILE_ALREADY_IMPORTED".to_string());
    }

    let window_clone = window.clone();
    let progress_callback = move |percent: f64, text: &str| {
        let _ = window_clone.emit("db-import-progress", ProgressPayload {
            percent,
            text: text.to_string(),
        });
    };

    storage.save_import(file_name, &file_hash, parsed_date, &sheets, force_overwrite, cancel_flag, progress_callback).await
}

fn main() {
    tauri::Builder::default()
        .manage(DbImportState {
            cancel_flag: Arc::new(AtomicBool::new(false)),
        })
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            parse_excel,
            get_excel_metadata,
            save_to_db,
            test_db_connection,
            cancel_db_import
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
