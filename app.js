const recipeList = document.getElementById("recipeList");
const loadedRecipes = [];

// dynamically load all recipes from recepty folder using GitHub API
async function loadAllRecipes() {
  try {
    // get all files in recepty folder via GitHub API
    const apiUrl = "https://api.github.com/repos/etancik/Kuchtik/contents/recepty";
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const files = await response.json();
    
    // filter only JSON files
    const recipeFiles = files
      .filter(file => file.type === 'file')
      .filter(file => file.name.endsWith('.json'))
      .map(file => file.name);
    
    console.log(`Found ${recipeFiles.length} recipes:`, recipeFiles);
    
    // load all recipes
    for (const recipeFile of recipeFiles) {
      try {
        const url = `recepty/${recipeFile}`;
        const recipeResponse = await fetch(url);
        if (recipeResponse.ok) {
          const data = await recipeResponse.json();
          loadedRecipes.push(data);
          renderRecipe(data);
        } else {
          console.warn(`Failed to load recipe: ${url}`);
        }
      } catch (error) {
        console.error(`Error loading recipe ${recipeFile}:`, error);
      }
    }
  } catch (error) {
    console.error("Error loading recipes from GitHub API:", error);
    // fallback - if GitHub API fails, use hardcoded list
    console.log("Using fallback loading...");
    const fallbackRecipes = ["recepty/gulas.json", "recepty/palacinky.json"];
    for (const url of fallbackRecipes) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          loadedRecipes.push(data);
          renderRecipe(data);
        }
      } catch (error) {
        console.error(`Error loading fallback recipe ${url}:`, error);
      }
    }
  }
}

// start loading recipes
loadAllRecipes();

// render recipe as Bootstrap card
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

// export to iOS Reminders
document.getElementById("exportBtn").addEventListener("click", () => {
  const checkedBoxes = document.querySelectorAll(".selectRecipe:checked");
  
  let items = [];
  checkedBoxes.forEach(checkbox => {
    const cardTitle = checkbox.closest("h5").textContent;
    const recipeName = cardTitle.split(" (")[0].replace(/^\s*/, ""); // remove leading whitespace
    const recipe = loadedRecipes.find(r => r.nazev === recipeName);
    if (recipe) {
      items.push(...recipe.ingredience);
    }
  });

  if (items.length === 0) {
    alert("Prosím vyberte alespoň jeden recept!");
    return;
  }

  const text = encodeURIComponent(items.join("\n"));
  const shortcutName = encodeURIComponent("Import receptů"); // must match Shortcut name on iOS
  const url = `shortcuts://run-shortcut?name=${shortcutName}&input=text&text=${text}`;
  window.location.href = url;
});
