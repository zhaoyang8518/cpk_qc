# ckp_qc (CPK 与质量控制统计分析软件)

![Tauri](https://img.shields.io/badge/Tauri-2.0-241b35?style=for-the-badge&logo=tauri)
![React](https://img.shields.io/badge/React-18.2-61dafb?style=for-the-badge&logo=react)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38b2ac?style=for-the-badge&logo=tailwind-css)
![Rust](https://img.shields.io/badge/Rust-2021-dea584?style=for-the-badge&logo=rust)
![ECharts](https://img.shields.io/badge/Apache_ECharts-5.5-e43961?style=for-the-badge&logo=apache-echarts)
![CI](https://img.shields.io/github/actions/workflow/status/zhaoyang8518/ckp_qc/build.yml?style=for-the-badge&label=Build)

**ckp_qc** 是一款专为工业制造与质量控制（QC）领域打造的跨平台桌面级统计分析软件。采用 **Tauri 2.0 + React 18 + Rust** 技术栈构建，专注于对大体积（8MB+）多 Sheet 工作表中的 PCBA 测试数据进行极速解析、直方图分箱计算、正态分布曲线拟合以及单板条码双向追溯。

---

## 🌟 核心功能特性

### ⚡ 1. 极速大表异步解析 (`Rust calamine`)
* **零拷贝大文件读取**：基于 Rust `calamine` 内存映射机制，实测针对 `8MB+`、包含数十万单元格的 ATE 测试表，完整解析耗时仅 **0.14 秒**。
* **智能制程参数捕获**：自动扫描表头前 20 行，精准识别并提取 `USL`、`LSL`、`Average`、`Stdev`、`Cpk` 等官方统计参数，并与单板测试流自动映射。

### 📊 2. 工业级 SPC 算法引擎 (`spc.ts`)
* **Sturges 智能分箱**：基于公式 \(K = \lceil 1 + 3.322 \log_{10} N \rceil\) 动态切分直方图组距，确保任意样本量下分布柱体疏密有致。
* **量级对齐正态拟合**：引入进阶理论频数公式 \(y(x) = N \cdot \Delta x \cdot \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{1}{2}\left(\frac{x-\mu}{\sigma}\right)^2}\)，解决纯概率密度 PDF 曲线无法与直方图柱体高度重合的行业痛点。
* **稳健 CPK 计算**：全面支持双边与单边规格自适应计算，内置 \(\sigma \to 0\) 的除零保护机制。

### 🔄 3. 丝滑交互与全景双向追溯 (`React + ECharts`)
* **零依赖虚拟滚动长列表**：左侧检测项列表采用高性能虚拟滚动引擎，面对数万行依然保持 `60fps` 满帧丝滑滚动，集成吸顶模糊搜索框。
* **复合图表矩阵**：支持一键切换 `单列` / `双列` / `三列` 响应式网格布局，完美融合直方图（Bar）、正态拟合红线（Line）与规格标记线（MarkLine）。
* **双向高亮追溯**：
  * **检测项查分箱**：左侧选中任意检测项，右侧图表矩阵对应分箱柱体立刻呈现警示黄色（`#f59e0b`）发光高亮。
  * **分箱查单板**：悬浮分箱 Tooltip，即刻列出落入该区间的前 5 片单板条码，极大提升现场品质排查效率。

### 🎨 4. 附加功能
* **六西格玛等级判定**：基于 Cpk 值自动分级（不合格 / 勉强合格 / 良好 / 世界级），并给出根因诊断与改进建议。
* **多 Sheet 支持**：底部 Tab 栏横向滚动切换工作表。
* **全局设置**：直方柱颜色主题切换（5 种方案）、正态曲线宽度调节。
* **JSON 报告导出**：一键导出包含完整分析数据的 JSON 报告。
* **PDF 报告导出**：即将支持（依赖已集成）。

---

## 🏗️ 工程架构与目录说明

项目采用 **Cargo Workspace** 结构进行严格的模块化解耦：

```text
ckp_qc/
├── Cargo.toml               # 顶层 Cargo 工作空间配置
├── package.json             # 前端项目与构建脚本配置
├── ckp_core/                # [Rust Crate] 核心 Excel 解析与数据建模引擎
│   ├── Cargo.toml
│   └── src/lib.rs           # calamine 多 Sheet 异步解析逻辑与 DTO 定义
├── src-tauri/               # [Rust Crate] Tauri 桌面应用主进程
│   ├── Cargo.toml
│   ├── tauri.conf.json      # Tauri 应用打包与权限配置
│   └── src/main.rs          # 桌面端 IPC 命令接口
├── src/                     # [React 前端] 渲染进程源码
│   ├── components/          # 模块化 UI 组件 (Header, SheetNav, PcbaList, ChartGrid, CpkChart, SettingsModal)
│   ├── utils/spc.ts         # 核心 SPC 统计算法与分箱逻辑
│   ├── types/index.ts       # 全局 TypeScript 接口定义
│   └── App.tsx              # 应用顶层控制器
└── .github/workflows/       # CI/CD 自动构建流水线
    └── build.yml            # Windows + macOS 双平台构建
```

---

## 🖥️ 平台支持

| 平台 | 开发调试 | 安装包构建 | 获取方式 |
|------|:--------:|:----------:|----------|
| **macOS** (x86_64 / aarch64) | ✅ | ✅ `.dmg` | 本地构建 / [GitHub Actions Artifacts](https://github.com/zhaoyang8518/ckp_qc/actions) |
| **Windows** (x86_64) | — | ✅ `.msi` | [GitHub Actions Artifacts](https://github.com/zhaoyang8518/ckp_qc/actions) |
| **Linux** | ✅ | 待支持 | 本地 `pnpm tauri dev` |

> **安装包自动构建**：每次向 `main` 分支推送代码，GitHub Actions 自动构建 Windows 和 macOS 安装包，可在 [Actions](https://github.com/zhaoyang8518/ckp_qc/actions) 页面下载最新 Artifact。

---

## 🚀 快速启动与构建调试

### 环境要求
* **Node.js**：`v22`（推荐使用 NVM 管理）
* **包管理器**：`pnpm`（`v10+`）
* **Rust**：`edition 2021`（通过 `rustup` 安装）

**macOS 额外依赖**：
```bash
xcode-select --install
```

**Linux 额外依赖**（以 Ubuntu/Debian 为例）：
```bash
sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

### 本地开发调试
```bash
# 1. 克隆仓库
git clone https://github.com/zhaoyang8518/ckp_qc.git
cd ckp_qc

# 2. 安装前端依赖
pnpm install

# 3. 启动开发服务器（带热重载与 Tauri 本地视窗）
pnpm dev
```

### 构建独立安装包
```bash
# 执行 release 编译与独立安装包打包
pnpm tauri build
```

构建完成后，安装包位于：
* **macOS DMG**：`target/release/bundle/dmg/ckp_qc_0.1.0_aarch64.dmg`
* **Windows MSI**：`target/release/bundle/msi/ckp_qc_0.1.0_x64.msi`

### 仅启动前端（不启动 Tauri）
```bash
pnpm dev    # Vite 开发服务器 http://localhost:5173
```

---

## 🤖 CI/CD 自动构建

本项目配置了 GitHub Actions 自动构建流水线，支持：

* **触发方式**：`git push` 到 `main` 分支 或 手动触发（`workflow_dispatch`）
* **构建平台**：`windows-latest` 和 `macos-latest`
* **产物**：Windows `.msi` + macOS `.dmg`

下载路径：[GitHub Actions → 最新 Run → Artifacts](https://github.com/zhaoyang8518/ckp_qc/actions)

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源许可证。
