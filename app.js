const recipeList = document.getElementById("recipeList");

// seznam JSON receptů
const recipes = ["recepty/gulas.json", "recepty/palacinky.json"];
const loadedRecipes = [];

// načtení všech receptů
recipes.forEach(url => {
  fetch(url)
    .then(res => res.json())
    .then(data => {
      loadedRecipes.push(data);
      renderRecipe(data);
    });
});

// vykreslení receptu jako Bootstrap kartu
function renderRecipe(recipe) {
  const div = document.createElement("div");
  div.classList.add("col");

  div.innerHTML = `
    <div class="card h-100">
      <div class="card-body">
        <h5 class="card-title">
          <input type="checkbox" class="selectRecipe me-2">
          ${recipe.nazev} (${recipe.porce} porce, ${recipe.cas_pripravy})
        </h5>
        <p class="card-subtitle mb-2 text-muted">Tagy: ${recipe.tagy.join(", ")}</p>
        <h6>Ingredience:</h6>
        <ul>${recipe.ingredience.map(i => `<li>${i}</li>`).join("")}</ul>
        <h6>Postup:</h6>
        <ol>${recipe.postup.map(k => `<li>${k}</li>`).join("")}</ol>
      </div>
    </div>
  `;
  recipeList.appendChild(div);
}

// export do iOS Připomínek
document.getElementById("exportBtn").addEventListener("click", () => {
  const checkedDivs = [...document.querySelectorAll(".recipe")].filter(div => div.querySelector(".selectRecipe")?.checked);

  let items = [];
  checkedDivs.forEach(div => {
    const recipeName = div.querySelector("h5").textContent.split(" (")[0];
    const recipe = loadedRecipes.find(r => r.nazev === recipeName);
    if (recipe) items.push(...recipe.ingredience);
  });

  const text = encodeURIComponent(items.join("\n"));
  const shortcutName = encodeURIComponent("Import receptů"); // musí odpovídat Shortcut na iOS
  const url = `shortcuts://run-shortcut?name=${shortcutName}&input=${text}`;
  window.location.href = url;
});
