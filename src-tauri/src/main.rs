// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::{DateTime, NaiveDate, NaiveDateTime, Utc};
use cpk_core::{parse_excel_file, SheetData};
use cpk_storage::Storage;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Read;
use std::path::PathBuf;
use tauri::Emitter;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

struct DbImportState {
    cancel_flag: Arc<AtomicBool>,
}

const API_KEY_FILE: &str = ".cpk_qc_api_key.enc";

#[derive(Clone, Serialize)]
struct ProgressPayload {
    percent: f64,
    text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ModelSettings {
    enabled: bool,
    provider: String,
    #[serde(rename = "baseUrl")]
    base_url: String,
    model: String,
    #[serde(rename = "apiKey")]
    api_key: String,
    #[serde(rename = "isManual", default)]
    is_manual: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
struct ModelConnectionResult {
    ok: bool,
    source: String,
    models: Vec<String>,
    message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AiChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AiChatRequest {
    messages: Vec<AiChatMessage>,
    #[serde(rename = "maxTokens")]
    max_tokens: Option<u32>,
    temperature: Option<f32>,
}

#[derive(Debug, Clone, Serialize)]
struct AiChatResponse {
    content: String,
}

fn get_api_key_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".config")
        .join("cpk_qc")
        .join(API_KEY_FILE)
}

#[tauri::command]
fn save_secure_api_key(api_key: String) -> Result<(), String> {
    let path = get_api_key_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create config dir: {}", e))?;
    }

    if api_key.is_empty() {
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("Failed to remove API key: {}", e))?;
        }
        return Ok(());
    }

    let encoded = BASE64.encode(api_key.as_bytes());
    fs::write(&path, encoded).map_err(|e| format!("Failed to save API key: {}", e))
}

#[tauri::command]
fn get_secure_api_key() -> Result<String, String> {
    let path = get_api_key_path();
    if !path.exists() {
        return Ok(String::new());
    }

    let encoded = fs::read_to_string(&path).map_err(|e| format!("Failed to read API key: {}", e))?;
    let decoded = BASE64
        .decode(&encoded)
        .map_err(|e| format!("Failed to decode API key: {}", e))?;
    String::from_utf8(decoded).map_err(|e| format!("Invalid API key encoding: {}", e))
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
async fn test_model_connection(settings: ModelSettings) -> Result<ModelConnectionResult, String> {
    match settings.provider.as_str() {
        "ollama" => test_ollama_connection(&settings).await,
        "openai" | "custom" => test_openai_compatible_connection(&settings).await,
        _ => Ok(ModelConnectionResult {
            ok: false,
            source: "unknown".to_string(),
            models: vec![],
            message: format!("Unknown provider: {}", settings.provider),
        }),
    }
}

#[tauri::command]
async fn ai_chat_completion(
    settings: ModelSettings,
    request: AiChatRequest,
) -> Result<AiChatResponse, String> {
    if !settings.enabled {
        return Err("AI model is not enabled.".to_string());
    }
    if settings.model.trim().is_empty() {
        return Err("AI model is empty.".to_string());
    }
    if request.messages.is_empty() {
        return Err("AI request messages are empty.".to_string());
    }

    match settings.provider.as_str() {
        "ollama" => ollama_chat_completion(settings, request).await,
        "openai" | "custom" => openai_compatible_chat_completion(settings, request).await,
        _ => Err(format!("Unknown provider: {}", settings.provider)),
    }
}

async fn ollama_chat_completion(
    settings: ModelSettings,
    request: AiChatRequest,
) -> Result<AiChatResponse, String> {
    let base_url = if settings.base_url.is_empty() {
        "http://127.0.0.1:11434".to_string()
    } else {
        settings.base_url.trim_end_matches('/').to_string()
    };

    let messages = request
        .messages
        .into_iter()
        .map(|message| {
            serde_json::json!({
                "role": message.role,
                "content": message.content,
            })
        })
        .collect::<Vec<_>>();

    let payload = serde_json::json!({
        "model": settings.model,
        "messages": messages,
        "stream": false,
        "options": {
            "temperature": request.temperature.unwrap_or(0.2),
            "num_predict": request.max_tokens.unwrap_or(2048),
        }
    });

    let response = reqwest::Client::new()
        .post(format!("{}/api/chat", base_url))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to call Ollama: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama returned {}: {}", status, body));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama chat response: {}", e))?;
    let content = body["message"]["content"]
        .as_str()
        .ok_or_else(|| "Ollama response did not include message.content".to_string())?
        .to_string();

    Ok(AiChatResponse { content })
}

async fn openai_compatible_chat_completion(
    settings: ModelSettings,
    request: AiChatRequest,
) -> Result<AiChatResponse, String> {
    let base_url = if settings.base_url.is_empty() {
        "https://api.openai.com/v1".to_string()
    } else {
        settings.base_url.trim_end_matches('/').to_string()
    };

    let messages = request
        .messages
        .into_iter()
        .map(|message| {
            serde_json::json!({
                "role": message.role,
                "content": message.content,
            })
        })
        .collect::<Vec<_>>();

    let payload = serde_json::json!({
        "model": settings.model,
        "messages": messages,
        "temperature": request.temperature.unwrap_or(0.2),
        "max_tokens": request.max_tokens.unwrap_or(2048),
    });

    let mut http_request = reqwest::Client::new()
        .post(format!("{}/chat/completions", base_url))
        .json(&payload);
    if !settings.api_key.is_empty() {
        http_request = http_request.header("Authorization", format!("Bearer {}", settings.api_key));
    }

    let response = http_request
        .send()
        .await
        .map_err(|e| format!("Failed to call AI provider: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("AI provider returned {}: {}", status, body));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse AI provider response: {}", e))?;
    let content = body["choices"]
        .as_array()
        .and_then(|choices| choices.first())
        .and_then(|choice| choice["message"]["content"].as_str())
        .ok_or_else(|| "AI provider response did not include choices[0].message.content".to_string())?
        .to_string();

    Ok(AiChatResponse { content })
}

async fn test_ollama_connection(settings: &ModelSettings) -> Result<ModelConnectionResult, String> {
    let base_url = if settings.base_url.is_empty() {
        "http://127.0.0.1:11434".to_string()
    } else {
        settings.base_url.trim_end_matches('/').to_string()
    };

    let response = reqwest::Client::new()
        .get(format!("{}/api/tags", base_url))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

    if !response.status().is_success() {
        return Ok(ModelConnectionResult {
            ok: false,
            source: "provider".to_string(),
            models: vec![],
            message: format!("Ollama returned {}", response.status()),
        });
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let models = body["models"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|model| model["name"].as_str().map(String::from))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let message = if models.is_empty() {
        format!("Connected to Ollama at {}, but no models installed.", base_url)
    } else {
        format!(
            "Connected to Ollama at {}. Found {} model(s): {}",
            base_url,
            models.len(),
            models.join(", ")
        )
    };

    Ok(ModelConnectionResult {
        ok: true,
        source: "provider".to_string(),
        models,
        message,
    })
}

async fn test_openai_compatible_connection(
    settings: &ModelSettings,
) -> Result<ModelConnectionResult, String> {
    let base_url = if settings.base_url.is_empty() {
        "https://api.openai.com/v1".to_string()
    } else {
        settings.base_url.trim_end_matches('/').to_string()
    };

    let mut request = reqwest::Client::new().get(format!("{}/models", base_url));
    if !settings.api_key.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", settings.api_key));
    }

    let response = request.send().await;
    if let Err(e) = response {
        return Ok(ModelConnectionResult {
            ok: false,
            source: "provider".to_string(),
            models: vec![],
            message: format!("Failed to connect: {}", e),
        });
    }

    let response = response.unwrap();
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Ok(ModelConnectionResult {
            ok: false,
            source: "provider".to_string(),
            models: vec![],
            message: format!("API returned {}: {}", status, body),
        });
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let models = body["data"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|model| model["id"].as_str().map(String::from))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(ModelConnectionResult {
        ok: true,
        source: "provider".to_string(),
        message: format!("Connected successfully. Found {} model(s).", models.len()),
        models,
    })
}

#[tauri::command]
async fn get_excel_metadata(path: String) -> Result<String, String> {
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;

    // Try to get creation time, fallback to modified time
    let time = metadata
        .created()
        .or_else(|_| metadata.modified())
        .map_err(|e| e.to_string())?;

    let datetime: chrono::DateTime<chrono::Local> = time.into();
    // Return full ISO 8601 date-time string so we don't lose time precision
    Ok(datetime.to_rfc3339())
}

fn calculate_file_hash(path: &str) -> Result<String, String> {
    let mut file =
        File::open(path).map_err(|e| format!("Failed to open file for hashing: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 1024 * 1024]; // 1MB buffer
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|e| format!("Failed to read file: {}", e))?;
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
    supplier_key: String,
    supplier_name: String,
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
    let test_day = parsed_date.date_naive();

    // Uniqueness is based on supplier + calendar day, not the raw Excel file bytes.
    if !force_overwrite
        && storage
            .check_supplier_day_exists(&supplier_key, test_day)
            .await?
    {
        return Err("SUPPLIER_DAY_ALREADY_IMPORTED".to_string());
    }

    let window_clone = window.clone();
    let progress_callback = move |percent: f64, text: &str| {
        let _ = window_clone.emit(
            "db-import-progress",
            ProgressPayload {
                percent,
                text: text.to_string(),
            },
        );
    };

    storage
        .save_import(
            file_name,
            &file_hash,
            parsed_date,
            test_day,
            &supplier_key,
            &supplier_name,
            &sheets,
            force_overwrite,
            cancel_flag,
            progress_callback,
        )
        .await
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
            cancel_db_import,
            test_model_connection,
            ai_chat_completion,
            save_secure_api_key,
            get_secure_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
