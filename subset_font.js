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

// 提取组件源码及 i18n 字典中的所有文本字符
const srcText = getAllText(path.resolve("./src"));
const i18nText = fs.existsSync(path.resolve("./src/i18n.ts")) 
  ? fs.readFileSync(path.resolve("./src/i18n.ts"), "utf-8") 
  : "";

// 保留 ASCII 基础字符表与源码所有字符，杜绝脱节
const baseAscii = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;':\",./<>?~` ";
const allChars = srcText + i18nText + baseAscii;
const uniqueChars = Array.from(new Set(allChars.split(""))).sort().join("");

console.log(`[Fontmin] Extracted ${uniqueChars.length} unique characters (including i18n.ts & src text).`);

const fontmin = new Fontmin()
  .src(fs.existsSync("public/fonts/SimHei.ttf") ? "public/fonts/SimHei.ttf" : "public/fonts/SimHei_subset.ttf")
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
