import "@fontsource/cinzel/400.css";
import "./styles.css";

import { CHINESE_DEFAULT, ENGLISH_DEFAULT, clonePreset, createDefaultConfig } from "./config";
import { loadLocalFont, removeLocalFont, waitForBundledFonts } from "./font";
import { canvasToBlob, renderTitle } from "./render";
import type {
  ActiveLanguage,
  ChineseFontState,
  ExportFormat,
  ExportScale,
  LanguagePreset,
  StyleMode,
} from "./types";
import { resolveLanguage, sanitizeFileName } from "./utils";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("页面初始化失败。 ");

app.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#top" aria-label="回到页面顶部">
      <span class="brand-mark" aria-hidden="true">ⅩⅣ</span>
      <span>
        <strong>FFXIV 副本标题制作器</strong>
        <small>Duty Title Maker</small>
      </span>
    </a>
    <span class="privacy-pill"><i></i> 纯前端 · 本地生成</span>
  </header>

  <main id="top" class="page-shell">
    <section class="intro" aria-labelledby="page-title">
      <p class="eyebrow">CREATE YOUR DUTY TITLE</p>
      <h1 id="page-title">让你的标题，像副本初见那一刻。</h1>
      <p>输入区域与副本名称，实时生成金色浮雕标题。无需上传，透明素材直接保存。</p>
    </section>

    <section class="workspace" aria-label="标题制作工作区">
      <form id="controls" class="control-card" novalidate>
        <div class="section-heading">
          <span>01</span>
          <div><h2>标题内容</h2><p>输入后右侧将实时更新</p></div>
        </div>

        <label class="field">
          <span>区域名称</span>
          <input id="areaText" type="text" maxlength="80" autocomplete="off" />
        </label>
        <label class="field">
          <span>副本名称</span>
          <input id="dutyText" type="text" maxlength="120" autocomplete="off" />
        </label>

        <fieldset class="mode-fieldset">
          <legend>样式模式</legend>
          <div class="segmented" role="radiogroup" aria-label="样式模式">
            <label><input type="radio" name="styleMode" value="auto" checked /><span>自动</span></label>
            <label><input type="radio" name="styleMode" value="zh" /><span>中文</span></label>
            <label><input type="radio" name="styleMode" value="en" /><span>English</span></label>
          </div>
          <p id="activeStyle" class="field-hint">当前：中文样式</p>
        </fieldset>

        <div class="two-column">
          <label class="field compact">
            <span>区域名字号</span>
            <div class="number-field"><input id="areaFontSize" type="number" min="16" max="160" step="1" /><em>px</em></div>
          </label>
          <label class="field compact">
            <span>副本名字号</span>
            <div class="number-field"><input id="dutyFontSize" type="number" min="24" max="240" step="1" /><em>px</em></div>
          </label>
        </div>

        <div class="font-panel">
          <div class="font-panel-title"><span>中文字体</span><strong id="fontState">思源黑体</strong></div>
          <p>由于字体版权限制，本站默认使用开源思源黑体。若你合法持有 Adobe 黑体 Std，可选择本地字体文件以获得更高还原度。字体只在当前浏览器中处理，不会上传或保存。</p>
          <div class="font-actions">
            <label class="button secondary file-button">
              <input id="fontFile" type="file" accept=".otf,.ttf,.woff,.woff2,font/otf,font/ttf,font/woff,font/woff2" />
              <span>选择本地字体</span>
            </label>
            <button id="removeFont" type="button" class="text-button" hidden>移除并恢复思源黑体</button>
          </div>
          <p id="fontMessage" class="inline-message" aria-live="polite"></p>
        </div>

        <details class="advanced">
          <summary><span>更多设置</span><small>布局与光效</small></summary>
          <div class="advanced-content">
            <div class="two-column">
              <label class="field compact"><span>区域名字距</span><div class="number-field"><input id="areaLetterSpacing" type="number" min="-0.3" max="0.8" step="0.01" /><em>em</em></div></label>
              <label class="field compact"><span>副本名字距</span><div class="number-field"><input id="dutyLetterSpacing" type="number" min="-0.3" max="0.5" step="0.01" /><em>em</em></div></label>
              <label class="field compact"><span>区域名到横线</span><div class="number-field"><input id="areaLineGap" type="number" min="0" max="40" step="1" /><em>px</em></div></label>
              <label class="field compact"><span>横线到主标题</span><div class="number-field"><input id="lineDutyGap" type="number" min="0" max="60" step="1" /><em>px</em></div></label>
              <label class="field compact"><span>横线粗细</span><div class="number-field"><input id="lineThickness" type="number" min="1" max="12" step="1" /><em>px</em></div></label>
              <label class="field compact"><span>基础金色</span><input id="baseColor" class="color-input" type="color" /></label>
            </div>
            <label class="range-field">
              <span>外发光强度 <output id="glowOutput">50%</output></span>
              <input id="glowStrength" type="range" min="0" max="100" step="1" />
            </label>
            <button id="resetPreset" type="button" class="text-button">恢复当前语言预设</button>
          </div>
        </details>

        <div class="export-section">
          <div class="section-heading small">
            <span>02</span><div><h2>导出设置</h2><p>选择格式与清晰度</p></div>
          </div>
          <div class="export-grid">
            <fieldset>
              <legend>文件格式</legend>
              <div class="check-row">
                <label class="check"><input id="formatPng" type="checkbox" checked /><span>PNG <small>透明底</small></span></label>
                <label class="check"><input id="formatJpg" type="checkbox" /><span>JPG <small>白底</small></span></label>
              </div>
            </fieldset>
            <fieldset>
              <legend>导出清晰度</legend>
              <div class="segmented scale-control" role="radiogroup" aria-label="导出清晰度">
                <label><input type="radio" name="exportScale" value="1" /><span>1×</span></label>
                <label><input type="radio" name="exportScale" value="2" checked /><span>2×</span></label>
                <label><input type="radio" name="exportScale" value="4" /><span>4×</span></label>
              </div>
            </fieldset>
          </div>
          <button id="exportButton" type="submit" class="button primary"><span>生成并下载</span><b aria-hidden="true">↓</b></button>
          <p id="exportMessage" class="inline-message export-message" aria-live="polite"></p>
          <div id="downloadFallback" class="download-fallback" hidden></div>
        </div>
      </form>

      <section class="preview-card" aria-labelledby="preview-title">
        <div class="preview-header">
          <div><p>LIVE PREVIEW</p><h2 id="preview-title">实时预览</h2></div>
          <span id="dimensions">— × — px</span>
        </div>
        <div class="preview-stage">
          <div id="previewLoader" class="preview-loader">正在载入字体…</div>
          <canvas id="previewCanvas" aria-label="副本标题预览"></canvas>
        </div>
        <div class="preview-footer">
          <span><i class="transparent-dot"></i> 透明画布</span>
          <span id="previewFont">中文 · 思源黑体</span>
        </div>
      </section>
    </section>

    <section class="how-it-works" aria-label="使用说明">
      <article><span>1</span><div><h3>填写标题</h3><p>输入区域名与副本名，自动匹配中英文样式。</p></div></article>
      <article><span>2</span><div><h3>微调效果</h3><p>调整字号、字距、间距与光效，预览实时同步。</p></div></article>
      <article><span>3</span><div><h3>保存素材</h3><p>导出透明 PNG 或白底 JPG，直接用于视频与图片。</p></div></article>
    </section>
  </main>

  <footer>
    <p>非官方粉丝工具，与 Square Enix 无关联。FINAL FANTASY XIV 为其权利人的商标。</p>
    <p>所有文字与字体文件均在你的浏览器中处理。</p>
  </footer>
`;

function query<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`缺少页面元素：${selector}`);
  return element;
}

const form = query<HTMLFormElement>("#controls");
const areaText = query<HTMLInputElement>("#areaText");
const dutyText = query<HTMLInputElement>("#dutyText");
const areaFontSize = query<HTMLInputElement>("#areaFontSize");
const dutyFontSize = query<HTMLInputElement>("#dutyFontSize");
const areaLetterSpacing = query<HTMLInputElement>("#areaLetterSpacing");
const dutyLetterSpacing = query<HTMLInputElement>("#dutyLetterSpacing");
const areaLineGap = query<HTMLInputElement>("#areaLineGap");
const lineDutyGap = query<HTMLInputElement>("#lineDutyGap");
const lineThickness = query<HTMLInputElement>("#lineThickness");
const baseColor = query<HTMLInputElement>("#baseColor");
const glowStrength = query<HTMLInputElement>("#glowStrength");
const glowOutput = query<HTMLOutputElement>("#glowOutput");
const formatPng = query<HTMLInputElement>("#formatPng");
const formatJpg = query<HTMLInputElement>("#formatJpg");
const fontFile = query<HTMLInputElement>("#fontFile");
const removeFontButton = query<HTMLButtonElement>("#removeFont");
const resetPresetButton = query<HTMLButtonElement>("#resetPreset");
const fontStateLabel = query<HTMLElement>("#fontState");
const fontMessage = query<HTMLElement>("#fontMessage");
const exportMessage = query<HTMLElement>("#exportMessage");
const activeStyleLabel = query<HTMLElement>("#activeStyle");
const previewFont = query<HTMLElement>("#previewFont");
const dimensions = query<HTMLElement>("#dimensions");
const previewCanvas = query<HTMLCanvasElement>("#previewCanvas");
const previewLoader = query<HTMLElement>("#previewLoader");
const downloadFallback = query<HTMLElement>("#downloadFallback");

const config = createDefaultConfig();
let chineseFont: ChineseFontState = { source: "fallback" };
let renderSequence = 0;
let renderTimer: number | undefined;
let downloadUrls: string[] = [];

function activeLanguage(): ActiveLanguage {
  return resolveLanguage(config.styleMode, config.areaText, config.dutyText);
}

function activePreset(): LanguagePreset {
  return config.presets[activeLanguage()];
}

function numericValue(input: HTMLInputElement, fallback: number): number {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function syncInputsFromPreset(): void {
  const language = activeLanguage();
  const preset = config.presets[language];
  areaFontSize.value = String(preset.areaFontSize);
  dutyFontSize.value = String(preset.dutyFontSize);
  areaLetterSpacing.value = String(preset.areaLetterSpacing);
  dutyLetterSpacing.value = String(preset.dutyLetterSpacing);
  areaLineGap.value = String(preset.areaLineGap);
  lineDutyGap.value = String(preset.lineDutyGap);
  lineThickness.value = String(preset.lineThickness);
  baseColor.value = preset.baseColor;
  glowStrength.value = String(preset.glowStrength);
  glowOutput.value = `${preset.glowStrength}%`;
  activeStyleLabel.textContent = `当前：${language === "zh" ? "中文样式" : "English Style"}`;
}

function updatePresetFromInputs(): void {
  const preset = activePreset();
  preset.areaFontSize = numericValue(areaFontSize, preset.areaFontSize);
  preset.dutyFontSize = numericValue(dutyFontSize, preset.dutyFontSize);
  preset.areaLetterSpacing = numericValue(areaLetterSpacing, preset.areaLetterSpacing);
  preset.dutyLetterSpacing = numericValue(dutyLetterSpacing, preset.dutyLetterSpacing);
  preset.areaLineGap = numericValue(areaLineGap, preset.areaLineGap);
  preset.lineDutyGap = numericValue(lineDutyGap, preset.lineDutyGap);
  preset.lineThickness = numericValue(lineThickness, preset.lineThickness);
  preset.baseColor = baseColor.value;
  preset.glowStrength = numericValue(glowStrength, preset.glowStrength);
  glowOutput.value = `${preset.glowStrength}%`;
}

function currentMode(): StyleMode {
  return query<HTMLInputElement>('input[name="styleMode"]:checked').value as StyleMode;
}

function currentScale(): ExportScale {
  return Number(query<HTMLInputElement>('input[name="exportScale"]:checked').value) as ExportScale;
}

function updateConfigFromForm(): void {
  config.areaText = areaText.value;
  config.dutyText = dutyText.value;
  config.styleMode = currentMode();
  config.exportScale = currentScale();
  config.formats.png = formatPng.checked;
  config.formats.jpg = formatJpg.checked;
  config.hasLocalChineseFont = chineseFont.source === "local";
}

function updateFontLabels(language: ActiveLanguage): void {
  const chineseLabel = chineseFont.source === "local"
    ? `Adobe 本地字体 · ${chineseFont.fileName ?? "已载入"}`
    : "思源黑体";
  fontStateLabel.textContent = chineseLabel;
  previewFont.textContent = language === "zh"
    ? `中文 · ${chineseFont.source === "local" ? "本地 Adobe 字体" : "思源黑体"}`
    : "English · Cinzel";
  removeFontButton.hidden = chineseFont.source !== "local";
}

async function refreshPreview(): Promise<void> {
  const sequence = ++renderSequence;
  updateConfigFromForm();
  previewLoader.hidden = false;
  previewLoader.textContent = "正在生成预览…";
  try {
    await waitForBundledFonts(config.hasLocalChineseFont);
    const result = await renderTitle(config);
    if (sequence !== renderSequence) return;
    previewCanvas.width = result.width;
    previewCanvas.height = result.height;
    previewCanvas.getContext("2d")?.drawImage(result.canvas, 0, 0);
    dimensions.textContent = `${result.width} × ${result.height} px`;
    updateFontLabels(result.language);
    previewLoader.hidden = true;
    exportMessage.textContent = "";
  } catch (error) {
    if (sequence !== renderSequence) return;
    previewLoader.hidden = false;
    previewLoader.textContent = error instanceof Error ? error.message : "预览生成失败。";
    dimensions.textContent = "— × — px";
  }
}

function schedulePreview(syncPreset = false): void {
  updateConfigFromForm();
  if (syncPreset) syncInputsFromPreset();
  if (renderTimer) window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => void refreshPreview(), 80);
}

function revokeDownloadUrls(): void {
  for (const url of downloadUrls) URL.revokeObjectURL(url);
  downloadUrls = [];
  downloadFallback.innerHTML = "";
  downloadFallback.hidden = true;
}

function createDownloadLink(blob: Blob, fileName: string, label: string): HTMLAnchorElement {
  const url = URL.createObjectURL(blob);
  downloadUrls.push(url);
  const link = document.createElement("a");
  link.className = "button secondary download-link";
  link.href = url;
  link.download = fileName;
  link.textContent = label;
  return link;
}

areaText.value = config.areaText;
dutyText.value = config.dutyText;
syncInputsFromPreset();

for (const input of [areaText, dutyText]) {
  input.addEventListener("input", () => schedulePreview(true));
}

for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="styleMode"]')) {
  radio.addEventListener("change", () => schedulePreview(true));
}

for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="exportScale"]')) {
  radio.addEventListener("change", () => schedulePreview());
}

for (const input of [
  areaFontSize,
  dutyFontSize,
  areaLetterSpacing,
  dutyLetterSpacing,
  areaLineGap,
  lineDutyGap,
  lineThickness,
  baseColor,
  glowStrength,
]) {
  input.addEventListener("input", () => {
    updatePresetFromInputs();
    schedulePreview();
  });
}

resetPresetButton.addEventListener("click", () => {
  const language = activeLanguage();
  config.presets[language] = clonePreset(language === "zh" ? CHINESE_DEFAULT : ENGLISH_DEFAULT);
  syncInputsFromPreset();
  schedulePreview();
});

fontFile.addEventListener("change", async () => {
  const file = fontFile.files?.[0];
  fontFile.value = "";
  if (!file) return;
  fontMessage.className = "inline-message";
  fontMessage.textContent = "正在验证并载入字体…";
  try {
    chineseFont = await loadLocalFont(file);
    config.hasLocalChineseFont = true;
    fontMessage.className = "inline-message success";
    fontMessage.textContent = `已在本地载入：${file.name}`;
    schedulePreview();
  } catch (error) {
    chineseFont = { source: "fallback" };
    config.hasLocalChineseFont = false;
    fontMessage.className = "inline-message error";
    fontMessage.textContent = error instanceof Error ? error.message : "字体载入失败。";
    updateFontLabels(activeLanguage());
  }
});

removeFontButton.addEventListener("click", () => {
  chineseFont = removeLocalFont();
  config.hasLocalChineseFont = false;
  fontMessage.className = "inline-message success";
  fontMessage.textContent = "已恢复默认思源黑体。";
  schedulePreview();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateConfigFromForm();
  revokeDownloadUrls();

  const formats = (Object.entries(config.formats) as [ExportFormat, boolean][])
    .filter(([, selected]) => selected)
    .map(([format]) => format);
  if (formats.length === 0) {
    exportMessage.className = "inline-message export-message error";
    exportMessage.textContent = "请至少选择一种导出格式。";
    return;
  }

  const submitButton = query<HTMLButtonElement>("#exportButton");
  submitButton.disabled = true;
  exportMessage.className = "inline-message export-message";
  exportMessage.textContent = "正在生成高清文件…";
  try {
    await waitForBundledFonts(config.hasLocalChineseFont);
    const result = await renderTitle(config);
    const safeName = sanitizeFileName(`${config.areaText}_${config.dutyText}`);
    const links: HTMLAnchorElement[] = [];

    for (const format of formats) {
      const blob = await canvasToBlob(result.canvas, format);
      const link = createDownloadLink(
        blob,
        `${safeName}.${format === "jpg" ? "jpg" : "png"}`,
        `保存 ${format.toUpperCase()}`,
      );
      links.push(link);
      downloadFallback.append(link);
    }

    downloadFallback.hidden = false;
    links.forEach((link, index) => window.setTimeout(() => link.click(), index * 180));
    exportMessage.className = "inline-message export-message success";
    exportMessage.textContent = `已生成 ${result.width} × ${result.height}px 文件。若未自动下载，请使用下方按钮保存。`;
  } catch (error) {
    exportMessage.className = "inline-message export-message error";
    exportMessage.textContent = error instanceof Error ? error.message : "导出失败，请重试。";
  } finally {
    submitButton.disabled = false;
  }
});

window.addEventListener("beforeunload", revokeDownloadUrls);
void refreshPreview();
