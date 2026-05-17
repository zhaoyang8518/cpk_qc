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

pub fn parse_excel_file(path: &str) -> Result<Vec<SheetData>, String> {
    let mut workbook = open_workbook_auto(path).map_err(|e| format!("Failed to open Excel file: {}", e))?;
    let sheet_names = workbook.sheet_names().to_vec();
    let mut sheets = Vec::new();

    for sheet_name in sheet_names {
        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            let mut rows = range.rows();

            // We need at least 10 rows to have parameter headers + column headers
            if range.get_size().0 < 10 {
                continue;
            }

            // Map to store parameter rows by keyword (e.g., "AVERAGE" -> Row slice)
            let mut param_rows: HashMap<String, Vec<Data>> = HashMap::new();
            let mut header_row: Option<Vec<Data>> = None;
            let mut data_start_idx = 0;

            // Scan the first 20 rows to flexibly identify parameter rows and the header row
            for (idx, row) in rows.clone().enumerate() {
                if idx >= 20 {
                    break;
                }
                if row.len() < 3 {
                    continue;
                }

                // Check second column (index 1) for keywords
                if let Some(key) = get_string(&row[1]) {
                    let key_upper = key.to_uppercase();
                    if ["AVERAGE", "MAX", "MIN", "STDEV", "CA", "CP", "CPK", "USL", "LSL"].contains(&key_upper.as_str()) {
                        param_rows.insert(key_upper, row.to_vec());
                    } else if key_upper == "PCBASN" {
                        header_row = Some(row.to_vec());
                        data_start_idx = idx + 1;
                        break;
                    }
                }
            }

            // If we couldn't find the PCBASN header row, skip sheet
            let header_row = match header_row {
                Some(h) => h,
                None => continue,
            };

            // Extract indicator names starting from column index 2 (3rd column)
            let mut indicators: Vec<IndicatorSummary> = Vec::new();
            for col_idx in 2..header_row.len() {
                if let Some(name) = get_string(&header_row[col_idx]) {
                    // Extract corresponding parameters from param_rows map
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
                    });
                } else {
                    // Stop if we hit an empty column header
                    break;
                }
            }

            let mut pcbasn_list = Vec::new();

            // Now iterate through the remaining rows for single board data
            let mut data_rows = range.rows().skip(data_start_idx);
            while let Some(row) = data_rows.next() {
                if row.len() < 2 {
                    continue;
                }

                // Check PCBASN in column index 1
                if let Some(asn) = get_string(&row[1]) {
                    pcbasn_list.push(asn);

                    // Extract values for each indicator
                    for (ind_idx, ind) in indicators.iter_mut().enumerate() {
                        let col_idx = ind_idx + 2;
                        if col_idx < row.len() {
                            if let Some(val) = get_float(&row[col_idx]) {
                                ind.values.push(val);
                            }
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
