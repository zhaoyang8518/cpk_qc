// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use ckp_core::{parse_excel_file, SheetData};

#[tauri::command]
async fn parse_excel(path: String) -> Result<Vec<SheetData>, String> {
    // 调用 ckp_core 的高性能异步解析引擎
    parse_excel_file(&path)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init()) // 必须显式注册 dialog 插件，否则前端 open() 无反应
        .plugin(tauri_plugin_fs::init())     // 显式注册 fs 插件
        .invoke_handler(tauri::generate_handler![parse_excel])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
