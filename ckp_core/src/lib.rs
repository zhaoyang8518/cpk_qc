use calamine::{open_workbook_auto, Data, Reader};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IndicatorSummary {
    pub name: String,
    pub average: Option<f64>,
    pub max: Option<f64>,
    pub min: Option<f64>,
    pub stdev: Option<f64>,
    pub ca: Option<f64>,
    pub cp: Option<f64>,
    pub cpk: Option<f64>,
    pub usl: Option<f64>,
    pub lsl: Option<f64>,
    pub values: Vec<f64>,
    pub value_asns: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SheetData {
    pub sheet_name: String,
    pub pcbasn_list: Vec<String>,
    pub indicators: Vec<IndicatorSummary>,
}

fn get_float(cell: &Data) -> Option<f64> {
    match cell {
        Data::Float(f) => Some(*f),
        Data::Int(i) => Some(*i as f64),
        Data::String(s) => s.trim().parse::<f64>().ok(),
        _ => None,
    }
}

fn get_string(cell: &Data) -> Option<String> {
    match cell {
        Data::String(s) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Data::Float(f) => Some(f.to_string()),
        Data::Int(i) => Some(i.to_string()),
        _ => None,
    }
}

fn find_cell_text(row: &[Data], text: &str) -> Option<usize> {
    row.iter().position(|cell| {
        get_string(cell)
            .map(|value| value.eq_ignore_ascii_case(text))
            .unwrap_or(false)
    })
}

fn find_param_key(row: &[Data]) -> Option<String> {
    row.iter().take(4).find_map(|cell| {
        let key = get_string(cell)?.to_uppercase();
        if ["AVERAGE", "MAX", "MIN", "STDEV", "CA", "CP", "CPK", "USL", "LSL"].contains(&key.as_str()) {
            Some(key)
        } else {
            None
        }
    })
}

fn summarize_values(values: &[f64]) -> (Option<f64>, Option<f64>, Option<f64>, Option<f64>) {
    if values.is_empty() {
        return (None, None, None, None);
    }

    let count = values.len() as f64;
    let sum: f64 = values.iter().sum();
    let average = sum / count;
    let min = values.iter().copied().fold(f64::INFINITY, f64::min);
    let max = values.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    let stdev = if values.len() > 1 {
        let variance = values
            .iter()
            .map(|value| (value - average).powi(2))
            .sum::<f64>()
            / (count - 1.0);
        Some(variance.sqrt())
    } else {
        Some(0.0)
    };

    (Some(average), Some(max), Some(min), stdev)
}

pub fn parse_excel_file(path: &str) -> Result<Vec<SheetData>, String> {
    let mut workbook = open_workbook_auto(path).map_err(|e| format!("Failed to open Excel file: {}", e))?;
    let sheet_names = workbook.sheet_names().to_vec();
    let mut sheets = Vec::new();

    for sheet_name in sheet_names {
        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            let rows = range.rows();

            // We need at least 10 rows to have parameter headers + column headers
            if range.get_size().0 < 10 {
                continue;
            }

            // Map to store parameter rows by keyword (e.g., "AVERAGE" -> Row slice)
            let mut param_rows: HashMap<String, Vec<Data>> = HashMap::new();
            let mut header_row: Option<Vec<Data>> = None;
            let mut pcbasn_col_idx: Option<usize> = None;
            let mut data_start_idx = 0;

            // Scan the first 20 rows to flexibly identify parameter rows and the header row
            for (idx, row) in rows.clone().enumerate() {
                if idx >= 20 {
                    break;
                }
                if row.len() < 3 {
                    continue;
                }

                if let Some(col_idx) = find_cell_text(row, "PCBASN") {
                    header_row = Some(row.to_vec());
                    pcbasn_col_idx = Some(col_idx);
                    data_start_idx = idx + 1;
                    break;
                }

                if let Some(key) = find_param_key(row) {
                    param_rows.insert(key, row.to_vec());
                }
            }

            // If we couldn't find the PCBASN header row, skip sheet
            let header_row = match header_row {
                Some(h) => h,
                None => continue,
            };
            let pcbasn_col_idx = match pcbasn_col_idx {
                Some(idx) => idx,
                None => continue,
            };

            // Extract indicator names from every column after PCBASN.
            let mut indicators: Vec<IndicatorSummary> = Vec::new();
            let mut indicator_columns: Vec<usize> = Vec::new();
            for col_idx in (pcbasn_col_idx + 1)..header_row.len() {
                if let Some(name) = get_string(&header_row[col_idx]) {
                    let average = param_rows.get("AVERAGE").and_then(|r| r.get(col_idx)).and_then(get_float);
                    let max = param_rows.get("MAX").and_then(|r| r.get(col_idx)).and_then(get_float);
                    let min = param_rows.get("MIN").and_then(|r| r.get(col_idx)).and_then(get_float);
                    let stdev = param_rows.get("STDEV").and_then(|r| r.get(col_idx)).and_then(get_float);
                    let ca = param_rows.get("CA").and_then(|r| r.get(col_idx)).and_then(get_float);
                    let cp = param_rows.get("CP").and_then(|r| r.get(col_idx)).and_then(get_float);
                    let cpk = param_rows.get("CPK").and_then(|r| r.get(col_idx)).and_then(get_float);
                    let usl = param_rows.get("USL").and_then(|r| r.get(col_idx)).and_then(get_float);
                    let lsl = param_rows.get("LSL").and_then(|r| r.get(col_idx)).and_then(get_float);

                    indicators.push(IndicatorSummary {
                        name,
                        average,
                        max,
                        min,
                        stdev,
                        ca,
                        cp,
                        cpk,
                        usl,
                        lsl,
                        values: Vec::new(),
                        value_asns: Vec::new(),
                    });
                    indicator_columns.push(col_idx);
                } else {
                    // Stop if we hit an empty column header
                    break;
                }
            }

            let mut pcbasn_list = Vec::new();

            // Now iterate through the remaining rows for single board data
            let mut data_rows = range.rows().skip(data_start_idx);
            while let Some(row) = data_rows.next() {
                if row.len() <= pcbasn_col_idx {
                    continue;
                }

                if let Some(asn) = get_string(&row[pcbasn_col_idx]) {
                    pcbasn_list.push(asn.clone());

                    for (ind_idx, ind) in indicators.iter_mut().enumerate() {
                        let col_idx = indicator_columns[ind_idx];
                        if col_idx < row.len() {
                            if let Some(val) = get_float(&row[col_idx]) {
                                ind.values.push(val);
                                ind.value_asns.push(asn.clone());
                            }
                        }
                    }
                }
            }

            for indicator in indicators.iter_mut() {
                let (average, max, min, stdev) = summarize_values(&indicator.values);
                indicator.average = indicator.average.or(average);
                indicator.max = indicator.max.or(max);
                indicator.min = indicator.min.or(min);
                indicator.stdev = indicator.stdev.or(stdev);

                if let (Some(avg), Some(std)) = (indicator.average, indicator.stdev) {
                    if std > 1e-9 {
                        if let (Some(usl), Some(lsl)) = (indicator.usl, indicator.lsl) {
                            indicator.cp = indicator.cp.or(Some((usl - lsl) / (6.0 * std)));
                            let cpu = (usl - avg) / (3.0 * std);
                            let cpl = (avg - lsl) / (3.0 * std);
                            indicator.cpk = indicator.cpk.or(Some(cpu.min(cpl)));
                        } else if let Some(usl) = indicator.usl {
                            indicator.cpk = indicator.cpk.or(Some((usl - avg) / (3.0 * std)));
                        } else if let Some(lsl) = indicator.lsl {
                            indicator.cpk = indicator.cpk.or(Some((avg - lsl) / (3.0 * std)));
                        }
                    }
                }
            }

            // Only add sheet if it contains valid indicators
            if !indicators.is_empty() {
                sheets.push(SheetData {
                    sheet_name,
                    pcbasn_list,
                    indicators,
                });
            }
        }
    }

    Ok(sheets)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_parse_demo_excel() {
        let demo_path = "/Users/zhaoyang/Downloads/AP-735 AKTS new filter RF CPK data_20260318_demo.xlsx";
        if Path::new(demo_path).exists() {
            let sheets = parse_excel_file(demo_path).expect("Failed to parse demo excel");
            assert!(!sheets.is_empty(), "Sheets should not be empty");

            let first_sheet = &sheets[0];
            println!("Sheet Name: {}", first_sheet.sheet_name);
            println!("PCBASN Count: {}", first_sheet.pcbasn_list.len());
            println!("Indicators Count: {}", first_sheet.indicators.len());

            assert!(!first_sheet.pcbasn_list.is_empty(), "PCBASN list should not be empty");
            assert!(!first_sheet.indicators.is_empty(), "Indicators should not be empty");

            let first_ind = &first_sheet.indicators[0];
            println!("First Indicator: {:?}", first_ind.name);
            println!("USL: {:?}, LSL: {:?}", first_ind.usl, first_ind.lsl);
            println!("Average: {:?}, Stdev: {:?}", first_ind.average, first_ind.stdev);
            println!("Values Count: {}", first_ind.values.len());

            assert!(first_ind.usl.is_some(), "USL should be parsed");
            assert!(first_ind.lsl.is_some(), "LSL should be parsed");
            assert!(!first_ind.values.is_empty(), "Values should not be empty");
        } else {
            println!("Demo file not found at {}, skipping live test.", demo_path);
        }
    }
}
