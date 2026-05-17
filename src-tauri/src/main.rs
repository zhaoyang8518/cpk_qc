// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use ckp_core::{parse_excel_file, SheetData};

#[tauri::command]
fn parse_excel(path: String) -> Result<Vec<SheetData>, String> {
    parse_excel_file(&path)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![parse_excel])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
