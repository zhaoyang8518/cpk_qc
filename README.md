# CPK Quality Control Statistical Analysis Software (cpk_qc)

![Tauri](https://img.shields.io/badge/Tauri-2.0-241b35?style=for-the-badge&logo=tauri)
![React](https://img.shields.io/badge/React-18.2-61dafb?style=for-the-badge&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38b2ac?style=for-the-badge&logo=tailwind-css)
![Rust](https://img.shields.io/badge/Rust-2021-dea584?style=for-the-badge&logo=rust)
![ECharts](https://img.shields.io/badge/Apache_ECharts-5.5-e43961?style=for-the-badge&logo=apache-echarts)
![CI](https://img.shields.io/github/actions/workflow/status/zhaoyang8518/cpk_qc/build.yml?style=for-the-badge&label=Build)

**cpk_qc** is a cross-platform desktop statistical analysis software designed specifically for the industrial manufacturing and Quality Control (QC) sectors. Built with a modern technology stack consisting of **Tauri 2.0 + React 18 + Rust**, it focuses on ultra-fast parsing of large (8MB+) multi-sheet PCBA test data files, histogram binning calculations, normal distribution curve fitting, and bidirectional single-board barcode traceability.

🌐 **Languages Available**: [English](README.md) | [简体中文](README_zh.md)

---

## 🌟 Core Features

### ⚡ 1. Blazing Fast Multi-Sheet Async Parsing (`Rust calamine`)
* **Zero-Copy File Reading**: Utilizing Rust's `calamine` memory mapping mechanism, complete parsing of 8MB+ ATE test sheets with hundreds of thousands of cells takes **only 0.14 seconds**.
* **Intelligent Process Parameter Extraction**: Automatically scans the first 20 rows of the sheet headers to precisely extract official statistical parameters such as `USL`, `LSL`, `Average`, `Stdev`, and `Cpk`, automatically mapping them to the board testing stream.

### 📊 2. Industrial-Grade SPC Algorithm Engine (`spc.ts`)
* **Sturges Binning Strategy**: Dynamically calculates the number of bins based on the Sturges formula:
  $$K = \lceil 1 + 3.322 \log_{10} N \rceil$$
  This ensures perfectly spaced histograms across various sample sizes.
* **Magnitude-Aligned Normal Distribution Curve Fitting**: Employs an advanced theoretical frequency formula:
  $$y(x) = N \cdot \Delta x \cdot \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{1}{2}\left(\frac{x-\mu}{\sigma}\right)^2}$$
  to solve the common issue where raw probability density function (PDF) curves do not align with the height of the histogram bars.
* **Robust CPK Calculations**: Fully supports adaptive double-sided and single-sided specification limit calculations, with built-in protection against division-by-zero errors when $\sigma \to 0$.

### 🔄 3. Seamless Interactions & Panoramic Bidirectional Traceability (`React + ECharts`)
* **Zero-Dependency Virtual Scrolling List**: The left test item list leverages a high-performance virtual scrolling engine, keeping interactions at a smooth **60 FPS** even with tens of thousands of items, integrated with a sticky fuzzy search bar.
* **Responsive Chart Matrix Grid**: Supports instant layout toggling between 1, 2, or 3 columns, seamlessly blending Histograms (Bar), Normal Distribution Fit Lines (Line), and Specification Limits (MarkLine).
* **Bidirectional Traceability**:
  * **Test Item to Bin**: Selecting any test item on the left highlights the corresponding histogram bin on the right with a bright warning yellow (`#f59e0b`) glow.
  * **Bin to Board**: Hovering over a histogram bin tooltip immediately lists the top 5 board barcodes within that interval, significantly boosting root-cause analysis efficiency.

### 🎨 4. Additional Capabilities
* **Six Sigma Level Evaluation**: Automatically rates performance (Fail / Marginally Acceptable / Good / World Class) based on Cpk, alongside root-cause diagnostics and recommendations.
* **Multi-Sheet Navigation**: Horizontal scrolling tab bar to seamlessly switch between worksheets.
* **Global Configurations**: Customizing themes with 5 distinct histogram color schemes and adjusting normal curve line widths.
* **JSON Report Export**: Instantly download a comprehensive JSON report containing all processed analysis data.
* **PDF Report Generation**: Planned (Dependencies integrated).

---

## 🏗️ Architecture & Directory Structure

The project is structured as a **Cargo Workspace** for strict modular decoupling:

```text
cpk_qc/
├── Cargo.toml               # Workspace root configuration
├── package.json             # Frontend script and dependency configuration
├── cpk_core/                # [Rust Crate] Core Excel parsing and data modeling engine
│   ├── Cargo.toml
│   └── src/lib.rs           # calamine multi-sheet async parsing logic & DTO definitions
├── src-tauri/               # [Rust Crate] Tauri desktop application main process
│   ├── Cargo.toml
│   ├── tauri.conf.json      # Tauri application packaging & permission settings
│   └── src/main.rs          # Desktop IPC command interfaces
├── src/                     # [React Frontend] Render process source code
│   ├── components/          # Modular UI components (Header, SheetNav, PcbaList, ChartGrid, CpkChart, SettingsModal)
│   ├── utils/spc.ts         # Core SPC statistical algorithms and binning logic
│   ├── types/index.ts       # Global TypeScript interface definitions
│   └── App.tsx              # Top-level application controller
└── .github/workflows/       # CI/CD automatic build pipelines
    └── build.yml            # Verification and artifact building for Windows + macOS
```

---

## 🖥️ Platform Support

| Platform | Development & Debugging | Build Package | Delivery Method |
|------|:--------:|:----------:|----------|
| **macOS** (x86_64 / aarch64) | ✅ | ✅ `.dmg` | Local Build / [GitHub Actions Releases](https://github.com/zhaoyang8518/cpk_qc/releases) |
| **Windows** (x86_64) | — | ✅ `.msi` | [GitHub Actions Releases](https://github.com/zhaoyang8518/cpk_qc/releases) |
| **Linux** | ✅ | To be supported | Local `pnpm tauri dev` |

> **Automated Build Pipelines**: Every push to the `main` branch triggers a workflow to compile artifacts. Successful tag releases automatically publish binaries on the [GitHub Releases](https://github.com/zhaoyang8518/cpk_qc/releases) page.

---

## 🚀 Quick Start & Building

### Requirements
* **Node.js**: `v22` (NVM is recommended)
* **Package Manager**: `pnpm` (`v10+`)
* **Rust**: `edition 2021` (via `rustup`)

**macOS Dependencies**:
```bash
xcode-select --install
```

**Linux Dependencies** (Ubuntu/Debian):
```bash
sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

### Local Development
```bash
# 1. Clone the repository
git clone https://github.com/zhaoyang8518/cpk_qc.git
cd cpk_qc

# 2. Install dependencies
pnpm install

# 3. Start development server (with hot reload and Tauri browser frame)
pnpm dev
```

### Building Installation Packages
```bash
# Compile and build the release installers
pnpm tauri build
```

Once built, installers can be found at:
* **macOS DMG**: `target/release/bundle/dmg/cpk_qc_0.1.2_aarch64.dmg`
* **Windows MSI**: `target/release/bundle/msi/cpk_qc_0.1.2_x64.msi`

### Frontend Only Development (No Tauri wrapper)
```bash
pnpm dev    # Vite dev server will run at http://localhost:5173
```

---

## 🤖 CI/CD Automations

The project is configured with a GitHub Actions workflow pipeline:
* **Triggers**: `git push` to `main` branch, tag push (`v*`), or manual execution (`workflow_dispatch`).
* **Build Platforms**: `windows-latest` & `macos-latest`.
* **Output**: Windows `.msi` and macOS `.dmg`.

Download Path: [GitHub Releases](https://github.com/zhaoyang8518/cpk_qc/releases)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
