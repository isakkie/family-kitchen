(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const absolute = (href) => new URL(href, location.origin).href;
  const unique = (items) => [...new Set(items)];
  const text = (node) => node?.textContent?.replace(/\s+/g, " ").trim() || "";
  const attr = (node, name) => node?.getAttribute(name)?.replace(/\s+/g, " ").trim() || "";

  const parseAmount = (value) => {
    const clean = value.replace(/\s+/g, " ").trim();
    const match = clean.match(/^(.+?)(?:\s+|：|:)(.+)$/);
    return {
      name: (match ? match[1] : clean).trim(),
      amount: (match ? match[2] : "").trim()
    };
  };

  const parseRecipe = (html, url) => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const recipeId = url.match(/recipe\/(\d+)/)?.[1] || "";
    const metaTitle = attr(doc.querySelector("meta[property='og:title'], meta[name='twitter:title']"), "content")
      .replace(/_下厨房.*$/, "")
      .replace(/的做法.*$/, "");
    const documentTitle = text(doc.querySelector("title"))
      .replace(/_下厨房.*$/, "")
      .replace(/的做法.*$/, "");
    const heading = [...doc.querySelectorAll("h1.page-title, h1[itemprop='name'], h1")]
      .map(text)
      .find((value) => value && !/首页|菜谱分类|菜单|作品动态|下厨房/.test(value));
    const title = metaTitle || documentTitle || heading || `下厨房菜谱 ${recipeId}`;

    const ingredientRows = [...doc.querySelectorAll(".ings tr, .ings li, [itemprop='recipeIngredient']")];
    const ingredients = ingredientRows
      .map((row) => {
        const name = text(row.querySelector(".name, [itemprop='name']"));
        const amount = text(row.querySelector(".unit, .amount"));
        if (name || amount) return { name, amount };
        return parseAmount(text(row));
      })
      .filter((item) => item.name);

    const stepNodes = [...doc.querySelectorAll(".steps .text, .steps li, [itemprop='recipeInstructions']")];
    const steps = unique(stepNodes.map(text).filter(Boolean));

    const tipTitle = [...doc.querySelectorAll("h2, h3")].find((node) => /小贴士|贴士|提示/.test(text(node)));
    let tips = "";
    if (tipTitle) {
      let current = tipTitle.nextElementSibling;
      const collected = [];
      while (current && !/^H[23]$/.test(current.tagName)) {
        const value = text(current);
        if (value) collected.push(value);
        current = current.nextElementSibling;
      }
      tips = collected.join("\n");
    }
    tips = tips || text(doc.querySelector(".tip, .tips, .recipe-tip"));

    return {
      title,
      source: url,
      ingredients,
      steps,
      tips,
      tags: ["下厨房"],
      notes: ""
    };
  };

  const collectLinksFromPage = async (url) => {
    const html = await fetch(url, { credentials: "include" }).then((response) => response.text());
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll("a[href*='/recipe/']")]
      .map((anchor) => absolute(anchor.getAttribute("href")))
      .filter((href) => /\/recipe\/\d+\/?$/.test(href));
  };

  const baseUrl = location.href.replace(/[?#].*$/, "");
  const allLinks = [];
  let emptyPages = 0;

  for (let page = 1; page <= 40; page += 1) {
    const url = `${baseUrl}?page=${page}`;
    const links = unique(await collectLinksFromPage(url));
    links.forEach((href) => allLinks.push(href));
    console.log(`收藏页 ${page}: ${links.length} 个链接，累计 ${unique(allLinks).length}`);
    if (!links.length) emptyPages += 1;
    else emptyPages = 0;
    if (emptyPages >= 2) break;
    await sleep(600);
  }

  const recipeLinks = unique(allLinks);
  const recipes = [];
  const failed = [];

  for (let index = 0; index < recipeLinks.length; index += 1) {
    const url = recipeLinks[index];
    try {
      console.log(`读取 ${index + 1}/${recipeLinks.length}: ${url}`);
      const html = await fetch(url, { credentials: "include" }).then((response) => response.text());
      const recipe = parseRecipe(html, url);
      recipes.push(recipe);
      console.log(`标题：${recipe.title}`);
    } catch (error) {
      failed.push({ url, error: String(error) });
    }
    await sleep(900);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    source: location.href,
    totalLinks: recipeLinks.length,
    failed,
    recipes
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "xiachufang-recipes.json";
  link.click();
  URL.revokeObjectURL(downloadUrl);
  alert(`完成：找到 ${recipeLinks.length} 个链接，成功导出 ${recipes.length} 个菜谱。失败 ${failed.length} 个。`);
})();
