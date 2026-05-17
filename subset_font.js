import fs from "fs";
import path from "path";
import Fontmin from "fontmin";

// 递归遍历目录读取所有 ts/tsx 文件的文本内容
function getAllText(dir) {
  let text = "";
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      text += getAllText(fullPath);
    } else if (/\.(tsx?|jsx?|html)$/.test(file)) {
      text += fs.readFileSync(fullPath, "utf-8");
    }
  }
  return text;
}

// 提取中文字符及常用字符
const srcText = getAllText(path.resolve("./src"));
const extraChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;':\",./<>?~` 均值标准差单板世界级良好勉强不合格质量控制分析报告源文件工作表导出成功失败初始化排版生成提取异常专项基本信息执行摘要精益六西格玛潜在精密度实际制程能力短期公差保护机制缺陷率接近零满足主流处于边缘极易超差超出规格界限存在大量次品风险停机整改快速索引快速明细暂无数据请先导入";

const allChars = srcText + extraChars;
const uniqueChars = Array.from(new Set(allChars.split(""))).sort().join("");

console.log(`[Fontmin] Extracted ${uniqueChars.length} unique characters for subsetting.`);

const fontmin = new Fontmin()
  .src("public/fonts/SimHei.ttf")
  .use(Fontmin.glyph({ text: uniqueChars, hinting: false }))
  .dest("public/fonts");

fontmin.run((err, files) => {
  if (err) {
    console.error("[Fontmin] Subsetting failed:", err);
    process.exit(1);
  }
  
  // 重命名为 SimHei_subset.ttf 并删除原大文件
  const origPath = path.resolve("public/fonts/SimHei.ttf");
  const subsetPath = path.resolve("public/fonts/SimHei_subset.ttf");
  
  if (fs.existsSync(origPath)) {
    fs.renameSync(origPath, subsetPath);
  }

  const stat = fs.statSync(subsetPath);
  console.log(`[Fontmin] Subsetting complete! New font size: ${(stat.size / 1024).toFixed(2)} KB`);
});
