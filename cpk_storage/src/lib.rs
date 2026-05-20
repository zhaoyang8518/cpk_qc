use chrono::{DateTime, NaiveDate, Utc};
use cpk_core::SheetData;
use sqlx::{PgPool, Row, postgres::PgPoolOptions};

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
        let legacy_schema_row = sqlx::query(
            r#"
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'sheets'
            ) OR EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'indicators' AND column_name = 'sheet_id'
            ) OR NOT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'suppliers'
            ) OR NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'imports' AND column_name = 'supplier_id'
            ) OR NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'imports' AND column_name = 'test_day'
            ) OR EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'imports' AND column_name = 'sheet_count'
            ) AS has_legacy_schema
            "#,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to inspect storage schema: {}", e))?;

        let has_legacy_schema: bool = legacy_schema_row
            .try_get("has_legacy_schema")
            .map_err(|e| e.to_string())?;

        if has_legacy_schema {
            self.drop_storage_tables().await?;
        }

        let partial_schema_row = sqlx::query(
            r#"
            SELECT
                COUNT(*) FILTER (
                    WHERE table_name IN ('suppliers', 'imports', 'test_metrics', 'indicators', 'measurements')
                ) AS table_count
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('suppliers', 'imports', 'test_metrics', 'indicators', 'measurements')
            "#,
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| format!("Failed to inspect storage schema completeness: {}", e))?;

        let table_count: i64 = partial_schema_row
            .try_get("table_count")
            .map_err(|e| e.to_string())?;

        if table_count > 0 && table_count < 5 {
            self.drop_storage_tables().await?;
        }

        let queries = vec![
            r#"
            CREATE TABLE IF NOT EXISTS suppliers (
                id SERIAL PRIMARY KEY,
                supplier_key VARCHAR(128) UNIQUE NOT NULL,
                supplier_name VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
            "#,
            r#"
            CREATE TABLE IF NOT EXISTS imports (
                id SERIAL PRIMARY KEY,
                supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
                file_name VARCHAR(255) NOT NULL,
                file_hash VARCHAR(64) NOT NULL,
                test_date TIMESTAMPTZ NOT NULL,
                test_day DATE NOT NULL,
                imported_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                pcba_count INTEGER,
                test_metric_count INTEGER,
                UNIQUE (supplier_id, test_day)
            )
            "#,
            r#"
            CREATE TABLE IF NOT EXISTS test_metrics (
                id SERIAL PRIMARY KEY,
                import_id INTEGER NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
                source_name VARCHAR(255) NOT NULL,
                test_metric_key VARCHAR(255) NOT NULL,
                display_name VARCHAR(255) NOT NULL,
                UNIQUE (import_id, test_metric_key)
            )
            "#,
            r#"
            CREATE TABLE IF NOT EXISTS indicators (
                id SERIAL PRIMARY KEY,
                test_metric_id INTEGER NOT NULL REFERENCES test_metrics(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                usl DOUBLE PRECISION,
                lsl DOUBLE PRECISION,
                UNIQUE (test_metric_id, name)
            )
            "#,
            r#"
            CREATE TABLE IF NOT EXISTS measurements (
                id SERIAL PRIMARY KEY,
                indicator_id INTEGER NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
                pcba_sn VARCHAR(255) NOT NULL,
                value DOUBLE PRECISION NOT NULL
            )
            "#,
        ];

        for query in queries {
            sqlx::query(query)
                .execute(&self.pool)
                .await
                .map_err(|e| format!("Failed to execute init query: {}", e))?;
        }

        Ok(())
    }

    async fn drop_storage_tables(&self) -> Result<(), String> {
        let drop_queries = vec![
            "DROP TABLE IF EXISTS measurements CASCADE",
            "DROP TABLE IF EXISTS indicators CASCADE",
            "DROP TABLE IF EXISTS test_metrics CASCADE",
            "DROP TABLE IF EXISTS sheets CASCADE",
            "DROP TABLE IF EXISTS imports CASCADE",
            "DROP TABLE IF EXISTS suppliers CASCADE",
        ];

        for query in drop_queries {
            sqlx::query(query)
                .execute(&self.pool)
                .await
                .map_err(|e| format!("Failed to drop storage table: {}", e))?;
        }

        Ok(())
    }

    pub async fn check_supplier_day_exists(
        &self,
        supplier_key: &str,
        test_day: NaiveDate,
    ) -> Result<bool, String> {
        let row = sqlx::query(
            r#"
            SELECT 1
            FROM imports i
            JOIN suppliers s ON s.id = i.supplier_id
            WHERE s.supplier_key = $1 AND i.test_day = $2
            "#,
        )
        .bind(supplier_key)
        .bind(test_day)
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
        test_day: NaiveDate,
        supplier_key: &str,
        supplier_name: &str,
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

        let supplier_row = sqlx::query(
            r#"
            INSERT INTO suppliers (supplier_key, supplier_name)
            VALUES ($1, $2)
            ON CONFLICT (supplier_key) DO UPDATE SET supplier_name = EXCLUDED.supplier_name
            RETURNING id
            "#,
        )
        .bind(supplier_key)
        .bind(supplier_name)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| format!("Failed to upsert supplier {}: {}", supplier_key, e))?;

        let supplier_id: i32 = supplier_row.try_get("id").map_err(|e| e.to_string())?;

        // If force_overwrite is requested, clean up the supplier's existing import on the same day.
        if force_overwrite {
            if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                return Err("IMPORT_CANCELLED".to_string());
            }
            progress(5.0, "检测到覆盖选项，正在删除老数据...");
            sqlx::query("DELETE FROM imports WHERE supplier_id = $1 AND test_day = $2")
                .bind(supplier_id)
                .bind(test_day)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    format!(
                        "Failed to delete existing import for supplier {} on {}: {}",
                        supplier_key, test_day, e
                    )
                })?;
        }

        // 1. Insert into imports
        let mut total_pcba_count = 0;
        let test_metric_count = sheets.len() as i32;

        for sheet in sheets {
            total_pcba_count += sheet.pcbasn_list.len();
        }

        if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
            return Err("IMPORT_CANCELLED".to_string());
        }
        progress(10.0, "正在创建导入批次记录...");

        let import_result = sqlx::query(
            r#"
            INSERT INTO imports (supplier_id, file_name, file_hash, test_date, test_day, pcba_count, test_metric_count)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
            "#,
        )
        .bind(supplier_id)
        .bind(file_name)
        .bind(file_hash)
        .bind(test_date)
        .bind(test_day)
        .bind(total_pcba_count as i32)
        .bind(test_metric_count)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| {
            format!(
                "Failed to insert import (check if file was already imported): {}",
                e
            )
        })?;

        let import_id: i32 = import_result.try_get("id").map_err(|e| e.to_string())?;

        let total_indicators: usize = sheets.iter().map(|s| s.indicators.len()).sum();
        let mut inserted_indicators = 0;

        // 2. Process test metrics
        for sheet in sheets {
            if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                return Err("IMPORT_CANCELLED".to_string());
            }

            let test_metric_row = sqlx::query(
                r#"
                INSERT INTO test_metrics (import_id, source_name, test_metric_key, display_name)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (import_id, test_metric_key) DO UPDATE SET
                    source_name = EXCLUDED.source_name,
                    display_name = EXCLUDED.display_name
                RETURNING id
                "#,
            )
            .bind(import_id)
            .bind(&sheet.raw_sheet_name)
            .bind(&sheet.test_metric_key)
            .bind(&sheet.display_name)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| {
                format!(
                    "Failed to insert test metric {}: {}",
                    sheet.test_metric_key, e
                )
            })?;

            let test_metric_id: i32 = test_metric_row.try_get("id").map_err(|e| e.to_string())?;

            // 3. Process indicators
            for indicator in &sheet.indicators {
                if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
                    return Err("IMPORT_CANCELLED".to_string());
                }

                let indicator_row = sqlx::query(
                    r#"
                    INSERT INTO indicators (test_metric_id, name, usl, lsl)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (test_metric_id, name) DO UPDATE SET
                        usl = EXCLUDED.usl,
                        lsl = EXCLUDED.lsl
                    RETURNING id
                    "#,
                )
                .bind(test_metric_id)
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
                        "#,
                    )
                    .bind(indicator_id)
                    .bind(asns)
                    .bind(values)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| {
                        format!(
                            "Failed to insert measurements for {}: {}",
                            indicator.name, e
                        )
                    })?;
                }

                inserted_indicators += 1;
                let percent = 10.0 + (inserted_indicators as f64 / total_indicators as f64) * 85.0;
                progress(
                    percent,
                    &format!(
                        "正在写入指标: {}/{} ({})",
                        inserted_indicators, total_indicators, indicator.name
                    ),
                );
            }
        }

        progress(96.0, "写入完毕，正在提交数据库事务...");
        if cancel_flag.load(std::sync::atomic::Ordering::SeqCst) {
            return Err("IMPORT_CANCELLED".to_string());
        }
        tx.commit()
            .await
            .map_err(|e| format!("Failed to commit transaction: {}", e))?;

        progress(100.0, "数据库导入成功！");
        Ok(import_id)
    }
}
