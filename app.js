const STORAGE_KEY = "family-kitchen-state-v1";

const starterRecipes = [
  {
    id: crypto.randomUUID(),
    title: "番茄炒蛋",
    source: "家庭常用",
    ingredients: [
      { name: "番茄", amount: "2个", role: "main" },
      { name: "鸡蛋", amount: "3个", role: "main" },
      { name: "盐", amount: "少许", role: "seasoning" },
      { name: "糖", amount: "少许", role: "seasoning" }
    ],
    steps: ["番茄切块，鸡蛋加少许盐打散。", "热锅下蛋液炒至凝固后盛出。", "下番茄炒软出汁，倒回鸡蛋翻匀调味。"],
    tips: "番茄不够甜时再加一点糖。",
    tags: ["快手菜", "晚餐", "少油"],
    notes: "家里口味偏淡，盐最后再放。"
  },
  {
    id: crypto.randomUUID(),
    title: "麻婆豆腐",
    source: "家庭常用",
    ingredients: [
      { name: "豆腐", amount: "1盒", role: "main" },
      { name: "肉末", amount: "100g", role: "main" },
      { name: "豆瓣酱", amount: "1勺", role: "seasoning" },
      { name: "蒜", amount: "2瓣", role: "seasoning" },
      { name: "花椒粉", amount: "少许", role: "seasoning" }
    ],
    steps: ["豆腐切块焯水。", "肉末炒散，加入蒜和豆瓣酱炒香。", "加水放豆腐，小火煮入味后勾薄芡。"],
    tips: "孩子吃可以减少豆瓣酱。",
    tags: ["下饭菜", "晚餐"],
    notes: "下次试试不放花椒。"
  },
  {
    id: crypto.randomUUID(),
    title: "青椒肉丝",
    source: "家庭常用",
    ingredients: [
      { name: "青椒", amount: "2个", role: "main" },
      { name: "猪肉", amount: "200g", role: "main" },
      { name: "生抽", amount: "1勺", role: "seasoning" },
      { name: "淀粉", amount: "1小勺", role: "seasoning" }
    ],
    steps: ["猪肉切丝，用生抽和淀粉抓匀。", "青椒切丝。", "先炒肉丝，再下青椒大火翻炒。"],
    tips: "青椒不要炒太久。",
    tags: ["快手菜", "便当"],
    notes: ""
  }
];

const sampleText = `葱油鸡腿

用料
鸡腿 2只
小葱 4根
姜 3片
生抽 2勺
盐 少许

步骤
1. 鸡腿冷水下锅，加入姜片煮熟。
2. 捞出放凉后撕成块。
3. 小葱切段，用热油炸香。
4. 加入生抽和少许盐拌匀，淋在鸡腿上。

小贴士
鸡腿煮好后可以过冰水，口感更紧实。`;

let state = loadState();
let activeView = "recipes";
let activeTag = "";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      recipes: starterRecipes,
      pantry: [],
      shopping: [],
      plan: {}
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { recipes: starterRecipes, pantry: [], shopping: [], plan: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateAfterDays(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function parseExpireDays(value) {
  const normalized = value.trim();
  if (!normalized) return 3;
  const match = normalized.match(/(\d+)/);
  if (!match) return 3;
  return Math.max(0, Number(match[1]));
}

function getPantryExpireDate() {
  return formatDate(getDateAfterDays(parseExpireDays($("#pantryExpireDays").value)));
}

function updatePantryExpirePreview() {
  const days = parseExpireDays($("#pantryExpireDays").value);
  const dateText = formatDate(getDateAfterDays(days));
  const relative = days === 0 ? "今天" : `${days}天后`;
  $("#pantryExpirePreview").textContent = `预计到期：${relative}（${dateText}）`;
}

function parseIngredientLine(line) {
  const trimmed = line.replace(/^[-*•\d.、\s]+/, "").trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.+?)(?:\s+|：|:)(.+)$/);
  const name = match ? match[1].trim() : trimmed;
  const amount = match ? match[2].trim() : "";
  const role = /盐|糖|油|酱|醋|料酒|胡椒|花椒|淀粉|生抽|老抽|蚝油|味精|鸡精/.test(name) ? "seasoning" : "main";
  return { name, amount, role };
}

function splitLines(value) {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseRecipeText(rawText, sourceUrl = "") {
  const lines = splitLines(rawText);
  const title = lines[0] || "未命名菜谱";
  const sections = { ingredients: [], steps: [], tips: [] };
  let current = "steps";

  for (const line of lines.slice(1)) {
    if (/^用料|^食材|^材料/.test(line)) {
      current = "ingredients";
      continue;
    }
    if (/^步骤|^做法|^烹饪步骤/.test(line)) {
      current = "steps";
      continue;
    }
    if (/^小贴士|^贴士|^提示/.test(line)) {
      current = "tips";
      continue;
    }
    sections[current].push(line);
  }

  return {
    id: "",
    title,
    source: sourceUrl,
    coverImage: "",
    ingredients: sections.ingredients.map(parseIngredientLine).filter(Boolean),
    steps: sections.steps.map((line) => line.replace(/^\d+[.、]\s*/, "")),
    tips: sections.tips.join("\n"),
    tags: [],
    notes: ""
  };
}

function recipeUrlToPlaceholder(url) {
  const match = url.match(/xiachufang\.com\/recipe\/(\d+)/);
  return {
    id: "",
    title: match ? `下厨房菜谱 ${match[1]}` : "待整理菜谱",
    source: url,
    coverImage: "",
    ingredients: [],
    steps: [],
    tips: "",
    tags: ["待整理"],
    notes: "已导入链接，待补全正文。"
  };
}

function normalizeRecipe(raw) {
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients.map((item) => {
        if (typeof item === "string") return parseIngredientLine(item);
        return {
          name: String(item.name || "").trim(),
          amount: String(item.amount || "").trim(),
          role: item.role || (String(item.role || "").includes("seasoning") ? "seasoning" : undefined)
        };
      }).filter((item) => item && item.name)
    : textToIngredients(String(raw.ingredients || ""));

  const source = String(raw.source?.url || raw.source || "").trim();
  const recipeId = source.match(/xiachufang\.com\/recipe\/(\d+)/)?.[1];
  const rawTitle = String(raw.title || "").trim();
  const title = (!rawTitle || rawTitle === "首页") && recipeId ? `下厨房菜谱 ${recipeId}` : rawTitle || "未命名菜谱";
  const steps = normalizeSteps(raw.steps, raw.stepImages || raw.step_images || []);

  return {
    id: raw.id || crypto.randomUUID(),
    title,
    source,
    coverImage: String(raw.coverImage || raw.cover_image || raw.image || "").trim(),
    ingredients,
    steps,
    tips: String(raw.tips || "").trim(),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).filter(Boolean) : String(raw.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    notes: String(raw.notes || raw.family_notes || "").trim()
  };
}

function normalizeSteps(rawSteps, fallbackImages = []) {
  const imageList = Array.isArray(fallbackImages) ? fallbackImages : splitLines(String(fallbackImages || ""));
  const sourceSteps = Array.isArray(rawSteps) ? rawSteps : splitLines(String(rawSteps || ""));
  const seen = new Set();
  const steps = [];

  sourceSteps.forEach((step, index) => {
    const textValue = typeof step === "string" ? step : step?.text;
    const imageValue = typeof step === "string" ? imageList[index] : step?.image || step?.imageUrl || step?.image_url || imageList[index];
    const text = String(textValue || "").trim();
    const image = String(imageValue || "").trim();
    if (!text && !image) return;
    const key = `${text}::${image}`;
    if (seen.has(key)) return;
    seen.add(key);
    steps.push(image ? { text, image } : text);
  });

  return steps;
}

function parseBatchInput(value) {
  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    const recipes = Array.isArray(parsed) ? parsed : parsed.recipes;
    if (Array.isArray(recipes)) return recipes.map(normalizeRecipe);
  } catch {
    // Fall through to text/link parsing.
  }

  const lines = splitLines(trimmed);
  const urls = lines.filter((line) => /^https?:\/\/.+xiachufang\.com\/recipe\/\d+/.test(line));
  if (urls.length === lines.length) return urls.map(recipeUrlToPlaceholder);

  return trimmed
    .split(/\n\s*-{3,}\s*\n/)
    .map((block) => parseRecipeText(block))
    .filter((recipe) => recipe.title && (recipe.ingredients.length || recipe.steps.length));
}

function upsertRecipes(recipes) {
  let added = 0;
  let updated = 0;

  for (const recipe of recipes) {
    const keySource = normalizeName(recipe.source || "");
    const existingIndex = state.recipes.findIndex((item) => {
      const sameSource = keySource && normalizeName(item.source || "") === keySource;
      const sameTitleWithoutSource = !keySource && normalizeName(item.title) === normalizeName(recipe.title);
      return sameSource || sameTitleWithoutSource;
    });

    if (existingIndex >= 0) {
      state.recipes[existingIndex] = { ...state.recipes[existingIndex], ...recipe, id: state.recipes[existingIndex].id };
      updated += 1;
    } else {
      state.recipes.unshift({ ...recipe, id: recipe.id || crypto.randomUUID() });
      added += 1;
    }
  }

  saveState();
  return { added, updated };
}

function downloadBackup() {
  const payload = JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `family-kitchen-${formatDate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function ingredientsToText(ingredients) {
  return ingredients.map((item) => `${item.name}${item.amount ? ` ${item.amount}` : ""}`).join("\n");
}

function textToIngredients(value) {
  return splitLines(value).map(parseIngredientLine).filter(Boolean);
}

function recipeFromForm() {
  const id = $("#recipeId").value || crypto.randomUUID();
  const stepTexts = splitLines($("#stepsInput").value).map((line) => line.replace(/^\d+[.、]\s*/, ""));
  const stepImages = splitLines($("#stepImagesInput").value);
  return {
    id,
    title: $("#titleInput").value.trim(),
    source: $("#recipeSourceInput").value.trim(),
    coverImage: $("#coverImageInput").value.trim(),
    ingredients: textToIngredients($("#ingredientsInput").value),
    steps: normalizeSteps(stepTexts, stepImages),
    tips: $("#tipsInput").value.trim(),
    tags: $("#tagsInput").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    notes: $("#notesInput").value.trim()
  };
}

function fillRecipeForm(recipe, status = "编辑中") {
  $("#recipeId").value = recipe.id || "";
  $("#titleInput").value = recipe.title || "";
  $("#recipeSourceInput").value = recipe.source || "";
  $("#coverImageInput").value = recipe.coverImage || "";
  $("#ingredientsInput").value = ingredientsToText(recipe.ingredients || []);
  const normalizedSteps = normalizeSteps(recipe.steps || []);
  $("#stepsInput").value = normalizedSteps.map((step, index) => `${index + 1}. ${typeof step === "string" ? step : step.text || ""}`).join("\n");
  $("#stepImagesInput").value = normalizedSteps.map((step) => typeof step === "string" ? "" : step.image || "").join("\n").trim();
  $("#tipsInput").value = recipe.tips || "";
  $("#tagsInput").value = (recipe.tags || []).join(", ");
  $("#notesInput").value = recipe.notes || "";
  $("#editingStatus").textContent = status;
  $("#editorTitle").textContent = recipe.id ? "编辑菜谱" : "新菜谱";
}

function switchView(view) {
  activeView = view;
  $$(".view").forEach((node) => {
    const isActive = node.id === `${view}View`;
    node.classList.toggle("active", isActive);
    node.toggleAttribute("hidden", !isActive);
  });
  $$(".nav-tab").forEach((node) => node.classList.toggle("active", node.dataset.view === view));
  render();
}

function render() {
  renderTags();
  renderRecipes();
  renderPantry();
  renderRecommendations();
  renderShopping();
  renderPlan();
}

function getFilteredRecipes() {
  const query = normalizeName($("#globalSearch").value || "");
  return state.recipes.filter((recipe) => {
    const haystack = normalizeName([
      recipe.title,
      recipe.source,
      recipe.tips,
      recipe.notes,
      ...(recipe.tags || []),
      ...(recipe.ingredients || []).map((item) => item.name)
    ].join(" "));
    const matchesSearch = !query || haystack.includes(query);
    const matchesTag = !activeTag || (recipe.tags || []).includes(activeTag);
    return matchesSearch && matchesTag;
  });
}

function renderTags() {
  const tags = [...new Set(state.recipes.flatMap((recipe) => recipe.tags || []))];
  $("#tagFilters").innerHTML = [
    `<button class="tag-chip ${activeTag === "" ? "active" : ""}" data-tag="" type="button">全部</button>`,
    ...tags.map((tag) => `<button class="tag-chip ${activeTag === tag ? "active" : ""}" data-tag="${escapeHtml(tag)}" type="button">${escapeHtml(tag)}</button>`)
  ].join("");
}

function renderRecipes() {
  const recipes = getFilteredRecipes();
  $("#recipeCount").textContent = `${recipes.length} 道菜`;
  $("#recipeGrid").innerHTML = recipes.length
    ? recipes.map(recipeCardTemplate).join("")
    : `<div class="empty">还没有匹配的菜谱。</div>`;
}

function recipeCardTemplate(recipe) {
  const ingredientNames = (recipe.ingredients || []).slice(0, 4).map((item) => item.name).join("、");
  const tags = (recipe.tags || []).slice(0, 3).map((tag) => `<span class="mini-tag">${escapeHtml(tag)}</span>`).join("");
  const cover = recipe.coverImage ? `<img class="recipe-cover" src="${escapeHtml(recipe.coverImage)}" alt="">` : "";
  return `
    <article class="recipe-card">
      ${cover}
      <div>
        <h3>${escapeHtml(recipe.title)}</h3>
        <p class="muted">${escapeHtml(ingredientNames || "未填写用料")}</p>
      </div>
      <div class="card-meta">${tags}</div>
      <div class="card-actions">
        <button class="ghost-btn" data-action="detail" data-id="${recipe.id}" type="button">查看</button>
        <button class="ghost-btn" data-action="edit" data-id="${recipe.id}" type="button">编辑</button>
        <button class="primary-btn" data-action="shop" data-id="${recipe.id}" type="button">加采购</button>
      </div>
    </article>
  `;
}

function renderPantry() {
  $("#pantryChips").innerHTML = state.pantry.length
    ? state.pantry.map((item) => `
      <button class="chip" data-action="remove-pantry" data-id="${item.id}" type="button">
        ${escapeHtml(item.name)}${item.amount ? ` · ${escapeHtml(item.amount)}` : ""}${item.expire ? ` · ${escapeHtml(item.expire)}` : ""}
      </button>
    `).join("")
    : `<div class="empty">冰箱里还没有记录食材。</div>`;
}

function scoreRecipe(recipe) {
  const pantryNames = new Set(state.pantry.map((item) => normalizeName(item.name)));
  const mainIngredients = (recipe.ingredients || []).filter((item) => item.role !== "seasoning");
  const ingredients = mainIngredients.length ? mainIngredients : recipe.ingredients || [];
  const matched = ingredients.filter((item) => pantryNames.has(normalizeName(item.name)));
  const missing = ingredients.filter((item) => !pantryNames.has(normalizeName(item.name)));
  const expiringNames = new Set(state.pantry.filter(isExpiringSoon).map((item) => normalizeName(item.name)));
  const expiryHits = matched.filter((item) => expiringNames.has(normalizeName(item.name))).length;
  const matchRate = ingredients.length ? matched.length / ingredients.length : 0;
  return { matched, missing, expiryHits, matchRate };
}

function isExpiringSoon(item) {
  if (!item.expire) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expire = new Date(`${item.expire}T00:00:00`);
  const days = (expire - today) / 86400000;
  return days >= 0 && days <= 3;
}

function renderRecommendations() {
  const sort = $("#recommendSort").value;
  const scored = state.recipes
    .map((recipe) => ({ recipe, ...scoreRecipe(recipe) }))
    .filter((item) => item.matched.length || state.pantry.length === 0);

  scored.sort((a, b) => {
    if (sort === "missing") return a.missing.length - b.missing.length || b.matchRate - a.matchRate;
    if (sort === "expiry") return b.expiryHits - a.expiryHits || b.matchRate - a.matchRate;
    return b.matchRate - a.matchRate || a.missing.length - b.missing.length;
  });

  $("#recommendList").innerHTML = scored.length
    ? scored.map(recommendTemplate).join("")
    : `<div class="empty">加入冰箱食材后，这里会推荐可以做或差一点能做的菜。</div>`;
}

function recommendTemplate(item) {
  const percent = Math.round(item.matchRate * 100);
  const missing = item.missing.map((ingredient) => ingredient.name).join("、") || "主料齐了";
  const matched = item.matched.map((ingredient) => ingredient.name).join("、") || "等待食材匹配";
  return `
    <article class="recommend-item">
      <h3>${escapeHtml(item.recipe.title)}</h3>
      <p class="muted">已有：${escapeHtml(matched)}</p>
      <div class="scorebar" aria-label="匹配度 ${percent}%"><span style="width:${percent}%"></span></div>
      <p class="muted">还缺：${escapeHtml(missing)}</p>
      <div class="button-row">
        <button class="primary-btn" data-action="shop-missing" data-id="${item.recipe.id}" type="button">补齐采购</button>
        <button class="ghost-btn" data-action="detail" data-id="${item.recipe.id}" type="button">查看</button>
      </div>
    </article>
  `;
}

function renderShopping() {
  $("#shoppingList").innerHTML = state.shopping.length
    ? state.shopping.map((item) => `
      <label class="shopping-item ${item.done ? "done" : ""}">
        <input data-action="toggle-shopping" data-id="${item.id}" type="checkbox" ${item.done ? "checked" : ""} />
        <span>${escapeHtml(item.name)}${item.amount ? ` · ${escapeHtml(item.amount)}` : ""}</span>
        <button class="ghost-btn" data-action="remove-shopping" data-id="${item.id}" type="button">删除</button>
      </label>
    `).join("")
    : `<div class="empty">购物清单为空。</div>`;
}

function renderPlan() {
  const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  $("#weekGrid").innerHTML = days.map((day) => `
    <div class="plan-cell">
      <h3>${day}</h3>
      <select data-action="plan" data-day="${day}">
        <option value="">未安排</option>
        ${state.recipes.map((recipe) => `<option value="${recipe.id}" ${state.plan[day] === recipe.id ? "selected" : ""}>${escapeHtml(recipe.title)}</option>`).join("")}
      </select>
    </div>
  `).join("");
}

function addRecipeToShopping(recipe, onlyMissing = false) {
  const pantryNames = new Set(state.pantry.map((item) => normalizeName(item.name)));
  const source = onlyMissing
    ? (recipe.ingredients || []).filter((item) => item.role !== "seasoning" && !pantryNames.has(normalizeName(item.name)))
    : recipe.ingredients || [];

  for (const ingredient of source) {
    const existing = state.shopping.find((item) => normalizeName(item.name) === normalizeName(ingredient.name) && !item.done);
    if (existing) {
      if (ingredient.amount && !existing.amount.includes(ingredient.amount)) {
        existing.amount = existing.amount ? `${existing.amount} + ${ingredient.amount}` : ingredient.amount;
      }
    } else {
      state.shopping.push({ id: crypto.randomUUID(), name: ingredient.name, amount: ingredient.amount, done: false });
    }
  }
  saveState();
  renderShopping();
}

function showDetail(recipe) {
  const steps = normalizeSteps(recipe.steps || []);
  $("#recipeDetail").innerHTML = `
    <h2>${escapeHtml(recipe.title)}</h2>
    <p class="muted">${escapeHtml(recipe.source || "无来源")}</p>
    ${recipe.coverImage ? `<img class="detail-cover" src="${escapeHtml(recipe.coverImage)}" alt="">` : ""}
    <h3>用料</h3>
    <ul>${(recipe.ingredients || []).map((item) => `<li>${escapeHtml(item.name)} ${escapeHtml(item.amount || "")}</li>`).join("")}</ul>
    <h3>步骤</h3>
    <div class="detail-steps">${steps.map((step, index) => {
      const textValue = typeof step === "string" ? step : step.text || "";
      const imageValue = typeof step === "string" ? "" : step.image || "";
      return `
        <article class="step-row">
          <div class="step-number">${index + 1}</div>
          <p class="step-text">${escapeHtml(textValue)}</p>
          ${imageValue ? `<img class="step-image" src="${escapeHtml(imageValue)}" alt="">` : `<div class="step-image-placeholder"></div>`}
        </article>
      `;
    }).join("")}</div>
    ${recipe.tips ? `<h3>小贴士</h3><p>${escapeHtml(recipe.tips)}</p>` : ""}
    ${recipe.notes ? `<h3>家庭备注</h3><p>${escapeHtml(recipe.notes)}</p>` : ""}
  `;
  $("#recipeDialog").showModal();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("#navTabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (button) switchView(button.dataset.view);
});

$("#globalSearch").addEventListener("input", renderRecipes);

$("#tagFilters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tag]");
  if (!button) return;
  activeTag = button.dataset.tag;
  render();
});

$("#recipeGrid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const recipe = state.recipes.find((item) => item.id === button.dataset.id);
  if (!recipe) return;
  if (button.dataset.action === "detail") showDetail(recipe);
  if (button.dataset.action === "edit") {
    fillRecipeForm(recipe, "已载入");
    switchView("import");
  }
  if (button.dataset.action === "shop") {
    addRecipeToShopping(recipe);
    switchView("shopping");
  }
});

$("#quickAddBtn").addEventListener("click", () => {
  fillRecipeForm({ ingredients: [], steps: [], tags: [] }, "新建");
  switchView("import");
});

$("#loadSampleBtn").addEventListener("click", () => {
  $("#rawText").value = sampleText;
});

$("#importForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const recipe = parseRecipeText($("#rawText").value, $("#sourceUrl").value.trim());
  fillRecipeForm(recipe, "识别结果");
});

async function importBatchFromText(text, label = "批量内容") {
  const recipes = parseBatchInput(text);
  if (!recipes.length) {
    $("#batchStatus").textContent = `${label}里没有识别到菜谱`;
    return;
  }
  const result = upsertRecipes(recipes);
  $("#batchStatus").textContent = `${label}：新增 ${result.added}，更新 ${result.updated}`;
  $("#batchInput").value = "";
  render();
}

async function importBatchFromFile(file) {
  $("#batchStatus").textContent = `正在读取 ${file.name}`;
  try {
    const text = await file.text();
    await importBatchFromText(text, file.name);
  } catch (error) {
    $("#batchStatus").textContent = `读取失败：${error.message || error}`;
  }
}

$("#batchImportBtn").addEventListener("click", async () => {
  const text = $("#batchInput").value.trim();
  const file = $("#batchFileInput").files?.[0];
  if (text) {
    await importBatchFromText(text);
    return;
  }
  if (file) {
    await importBatchFromFile(file);
    return;
  }
  $("#batchStatus").textContent = "请先粘贴内容或选择 JSON 文件";
});

$("#exportDataBtn").addEventListener("click", downloadBackup);

$("#batchFileInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  await importBatchFromFile(file);
});

$("#recipeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const recipe = recipeFromForm();
  const index = state.recipes.findIndex((item) => item.id === recipe.id);
  if (index >= 0) {
    state.recipes[index] = recipe;
  } else {
    state.recipes.unshift(recipe);
  }
  saveState();
  fillRecipeForm(recipe, "已保存");
  switchView("recipes");
});

$("#deleteRecipeBtn").addEventListener("click", () => {
  const id = $("#recipeId").value;
  if (!id) return;
  state.recipes = state.recipes.filter((recipe) => recipe.id !== id);
  saveState();
  fillRecipeForm({ ingredients: [], steps: [], tags: [] }, "已删除");
  switchView("recipes");
});

$("#pantryForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.pantry.push({
    id: crypto.randomUUID(),
    name: $("#pantryName").value.trim(),
    amount: $("#pantryAmount").value.trim(),
    expire: getPantryExpireDate()
  });
  event.currentTarget.reset();
  $("#pantryExpireDays").value = "3";
  updatePantryExpirePreview();
  saveState();
  render();
});

$("#pantryExpireDays").addEventListener("input", updatePantryExpirePreview);

$("#pantryChips").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='remove-pantry']");
  if (!button) return;
  state.pantry = state.pantry.filter((item) => item.id !== button.dataset.id);
  saveState();
  render();
});

$("#recommendSort").addEventListener("change", renderRecommendations);

$("#recommendList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const recipe = state.recipes.find((item) => item.id === button.dataset.id);
  if (!recipe) return;
  if (button.dataset.action === "detail") showDetail(recipe);
  if (button.dataset.action === "shop-missing") {
    addRecipeToShopping(recipe, true);
    switchView("shopping");
  }
});

$("#shoppingList").addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-action='remove-shopping']");
  if (removeButton) {
    state.shopping = state.shopping.filter((item) => item.id !== removeButton.dataset.id);
    saveState();
    renderShopping();
  }
});

$("#shoppingList").addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-action='toggle-shopping']");
  if (!checkbox) return;
  const item = state.shopping.find((entry) => entry.id === checkbox.dataset.id);
  if (item) item.done = checkbox.checked;
  saveState();
  renderShopping();
});

$("#clearShoppingBtn").addEventListener("click", () => {
  state.shopping = [];
  saveState();
  renderShopping();
});

$("#weekGrid").addEventListener("change", (event) => {
  const select = event.target.closest("[data-action='plan']");
  if (!select) return;
  if (select.value) state.plan[select.dataset.day] = select.value;
  else delete state.plan[select.dataset.day];
  saveState();
});

$("#clearPlanBtn").addEventListener("click", () => {
  state.plan = {};
  saveState();
  renderPlan();
});

render();
switchView(activeView);
updatePantryExpirePreview();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./service-worker.js");
}
