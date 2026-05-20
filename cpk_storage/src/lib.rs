use cpk_core::SheetData;
use chrono::{DateTime, Utc};
use sqlx::{postgres::PgPoolOptions, PgPool, Row};

const MEASUREMENT_BATCH_SIZE: usize = 10_000;

#[derive(Debug, Clone)]
pub struct Storage {
    pool: PgPool,
}

impl Storage {
    pub async fn connect(uri: &str) -> Result<Self, String> {
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(uri)
            .await
            .map_err(|e| format!("Failed to connect to database: {}", e))?;

        Ok(Self { pool })
    }

    pub async fn init_db(&self) -> Result<(), String> {
        // Safe migration: Check if table 'imports' exists and has 'file_hash' column.
        // If imports exists but has no file_hash (old schema), we drop old tables to rebuild.
        let check_old_schema = sqlx::query(
            "SELECT column_name FROM information_schema.columns WHERE table_name='imports' AND column_name='file_hash'"
        )
        .fetch_optional(&self.pool)
        .await;

        let need_drop = match check_old_schema {
            Ok(Some(_)) => false, // has file_hash, new schema, no drop needed
            Ok(None) => {
                // Table imports exists but has no file_hash. Need drop.
                true
            }
            Err(_) => {
                // Table might not exist at all, which is fine, no drop needed.
                false
            }
        };

        if need_drop {
            let drop_queries = vec![
                "DROP TABLE IF EXISTS measurements CASCADE",
                "DROP TABLE IF EXISTS indicators CASCADE",
                "DROP TABLE IF EXISTS sheets CASCADE",
                "DROP TABLE IF EXISTS imports CASCADE",
            ];
            for q in drop_queries {
                let _ = sqlx::query(q).execute(&self.pool).await;
            }
        }

        let queries = vec![
            r#"
            CREATE TABLE IF NOT EXISTS imports (
                id SERIAL PRIMARY KEY,
                file_name VARCHAR(255) NOT NULL,
                file_hash VARCHAR(64) UNIQUE NOT NULL,
                test_date TIMESTAMPTZ NOT NULL,
                imported_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                pcba_count INTEGER,
                sheet_count INTEGER
            )
            "#
            ,
            r#"
            CREATE TABLE IF NOT EXISTS sheets (
                id SERIAL PRIMARY KEY,
                import_id INTEGER REFERENCES imports(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                UNIQUE (import_id, name)
            )
            "#
            ,
            r#"
            CREATE TABLE IF NOT EXISTS indicators (
                id SERIAL PRIMARY KEY,
                sheet_id INTEGER REFERENCES sheets(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                usl DOUBLE PRECISION,
                lsl DOUBLE PRECISION,
                UNIQUE (sheet_id, name)
            )
            "#
            ,
            r#"
            CREATE TABLE IF NOT EXISTS measurements (
                id SERIAL PRIMARY KEY,
                indicator_id INTEGER REFERENCES indicators(id) ON DELETE CASCADE,
                pcba_sn VARCHAR(255) NOT NULL,
                value DOUBLE PRECISION NOT NULL
            )
            "#
            ,
        ];

        for query in queries {
            sqlx::query(query)
                .execute(&self.pool)
                .await
                .map_err(|e| format!("Failed to execute init query: {}", e))?;
        }

        Ok(())
    }

    pub async fn check_hash_exists(&self, file_hash: &str) -> Result<bool, String> {
        let row = sqlx::query("SELECT 1 FROM imports WHERE file_hash = $1")
            .bind(file_hash)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(row.is_some())
    }

    pub async fn save_import<F>(
        &self,
        file_name: &str,
        file_hash: &str,
        test_date: DateTime<Utc>,
        sheets: &[SheetData],
        force_overwrite: bool,
        cancel_flag: std::sync::Arc<std::sync::atomic::AtomicBool>,
        progress: F,
    ) -> Result<i32, String>
    where
        F: Fn(f64, &str) + Send + Sync,
    {
        // Start a transaction for consistency
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;

        progress(2.0, "正在准备写入...");

        // If force_overwrite is requested, clean up any conflicting file_hash record
        if force_overwrite {
            if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                return Err("IMPORT_CANCELLED".to_string());
            }
            progress(5.0, "检测到覆盖选项，正在删除老数据...");
            sqlx::query("DELETE FROM imports WHERE file_hash = $1")
                .bind(file_hash)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Failed to delete existing import with hash {}: {}", file_hash, e))?;
        }

        // 1. Insert into imports
        let mut total_pcba_count = 0;
        let sheet_count = sheets.len() as i32;
        
        for sheet in sheets {
            total_pcba_count += sheet.pcbasn_list.len();
        }

        if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
            return Err("IMPORT_CANCELLED".to_string());
        }
        progress(10.0, "正在创建导入批次记录...");

        let import_result = sqlx::query(
            r#"
            INSERT INTO imports (file_name, file_hash, test_date, pcba_count, sheet_count)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            "#
        )
        .bind(file_name)
        .bind(file_hash)
        .bind(test_date)
        .bind(total_pcba_count as i32)
        .bind(sheet_count)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Failed to insert import (check if file was already imported): {}", e))?;

        let import_id: i32 = import_result.try_get("id").map_err(|e| e.to_string())?;

        let total_indicators: usize = sheets.iter().map(|s| s.indicators.len()).sum();
        let mut inserted_indicators = 0;

        // 2. Process sheets
        for sheet in sheets {
            if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                return Err("IMPORT_CANCELLED".to_string());
            }
            
            let sheet_row = sqlx::query(
                r#"
                INSERT INTO sheets (import_id, name)
                VALUES ($1, $2)
                ON CONFLICT (import_id, name) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
                "#
            )
            .bind(import_id)
            .bind(&sheet.sheet_name)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| format!("Failed to insert sheet {}: {}", sheet.sheet_name, e))?;

            let sheet_id: i32 = sheet_row.try_get("id").map_err(|e| e.to_string())?;

            // 3. Process indicators
            for indicator in &sheet.indicators {
                if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                    return Err("IMPORT_CANCELLED".to_string());
                }

                let indicator_row = sqlx::query(
                    r#"
                    INSERT INTO indicators (sheet_id, name, usl, lsl)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (sheet_id, name) DO UPDATE SET
                        usl = EXCLUDED.usl,
                        lsl = EXCLUDED.lsl
                    RETURNING id
                    "#
                )
                .bind(sheet_id)
                .bind(&indicator.name)
                .bind(indicator.usl)
                .bind(indicator.lsl)
                .fetch_one(&mut *tx)
                .await
                .map_err(|e| format!("Failed to insert indicator {}: {}", indicator.name, e))?;
                
                let indicator_id: i32 = indicator_row.try_get("id").map_err(|e| e.to_string())?;

                // 4. Process measurements in batches. Row-by-row inserts are too slow over
                // PostgreSQL because every value pays a round trip through the SQL executor.
                let measurement_count = indicator.values.len().min(indicator.value_asns.len());
                for start in (0..measurement_count).step_by(MEASUREMENT_BATCH_SIZE) {
                    if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                        return Err("IMPORT_CANCELLED".to_string());
                    }

                    let end = (start + MEASUREMENT_BATCH_SIZE).min(measurement_count);
                    let asns = indicator.value_asns[start..end].to_vec();
                    let values = indicator.values[start..end].to_vec();

                    sqlx::query(
                        r#"
                        INSERT INTO measurements (indicator_id, pcba_sn, value)
                        SELECT $1, data.pcba_sn, data.value
                        FROM UNNEST($2::text[], $3::double precision[]) AS data(pcba_sn, value)
                        "#
                    )
                    .bind(indicator_id)
                    .bind(asns)
                    .bind(values)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| format!("Failed to insert measurements for {}: {}", indicator.name, e))?;
                }

                inserted_indicators += 1;
                let percent = 10.0 + (inserted_indicators as f64 / total_indicators as f64) * 85.0;
                progress(percent, &format!("正在写入指标: {}/{} ({})", inserted_indicators, total_indicators, indicator.name));
            }
        }

        progress(96.0, "写入完毕，正在提交数据库事务...");
        if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
            return Err("IMPORT_CANCELLED".to_string());
        }
        tx.commit().await.map_err(|e| format!("Failed to commit transaction: {}", e))?;

        progress(100.0, "数据库导入成功！");
        Ok(import_id)
    }
}
