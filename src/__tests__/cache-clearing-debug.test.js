/**
 * Focused test to isolate the cache clearing issue during update
 */

import RecipeRepository, { SyncStrategy } from '../repositories/RecipeRepository.js';

// Simple mock that matches the behavior from your logs
class SimpleMockRecipeAdapter {
  constructor() {
    this.files = new Map();
    // Add the 13 recipes like in your scenario
    this.setupRecipes();
  }
  
  setupRecipes() {
    const recipes = [
      { name: 'Guláš', servings: 4 },
      { name: 'Palačinky', servings: 6 },
      { name: 'Recipe 3', servings: 2 },
      { name: 'Recipe 4', servings: 4 },
      { name: 'Recipe 5', servings: 6 },
      { name: 'Recipe 6', servings: 8 },
      { name: 'Recipe 7', servings: 2 },
      { name: 'Recipe 8', servings: 4 },
      { name: 'Recipe 9', servings: 6 },
      { name: 'Recipe 10', servings: 8 },
      { name: 'Recipe 11', servings: 2 },
      { name: 'Recipe 12', servings: 4 },
      { name: 'Recipe 13', servings: 6 }
    ];
    
    recipes.forEach(recipe => {
      const filename = this.generateFilename(recipe.name);
      this.files.set(filename, recipe);
    });
  }
  
  generateFilename(recipeName) {
    return recipeName.toLowerCase()
      .replace(/[áàâä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/[ýÿ]/g, 'y')
      .replace(/č/g, 'c')
      .replace(/ď/g, 'd')
      .replace(/ň/g, 'n')
      .replace(/ř/g, 'r')
      .replace(/š/g, 's')
      .replace(/ť/g, 't')
      .replace(/ž/g, 'z')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '.json';
  }
  
  async getFileList() {
    return Array.from(this.files.keys());
  }
  
  async getFile(filename) {
    if (this.files.has(filename)) {
      return { ...this.files.get(filename) };
    }
    throw new Error(`File not found: ${filename}`);
  }
  
  async updateFile(filename, content) {
    this.files.set(filename, { ...content });
    return { success: true };
  }
  
  async checkFileExists(filename) {
    return this.files.has(filename);
  }
}

describe('Cache Clearing Bug Investigation', () => {
  let repository;
  let mockRecipeAdapter;
  let cacheEvents = [];
  let recipeEvents = [];
  
  beforeEach(() => {
    mockRecipeAdapter = new SimpleMockRecipeAdapter();
    repository = new RecipeRepository({
      cacheTimeout: 300000,
      syncStrategy: SyncStrategy.IMMEDIATE,
      optimisticUpdates: true
    });
    
    repository.setAdapter(mockRecipeAdapter);
    
    // Track events
    cacheEvents = [];
    recipeEvents = [];
    
    repository.on('recipesUpdated', (recipes) => {
      recipeEvents.push({ event: 'recipesUpdated', count: recipes.length });
      console.log(`📡 recipesUpdated: ${recipes.length} recipes`);
    });
    
    repository.on('cacheUpdated', (data) => {
      cacheEvents.push({ event: 'cacheUpdated', data });
      console.log(`💾 cacheUpdated:`, data);
    });
  });
  
  test('should reproduce the cache clearing issue step by step', async () => {
    console.log('\n🔍 Step-by-step cache investigation...');
    
    // Step 1: Initial load
    console.log('\n📋 Step 1: Loading initial recipes...');
    const initialRecipes = await repository.getAll();
    console.log(`✅ Initial load: ${initialRecipes.length} recipes`);
    
    const initialCache = repository.getCacheMetadata();
    console.log(`💾 Initial cache: ${initialCache.totalEntries} entries`);
    console.log('Cache keys:', initialCache.entries.map(e => e.name));
    
    expect(initialRecipes).toHaveLength(13);
    expect(initialCache.totalEntries).toBe(13);
    
    // Step 2: Check cache state before update
    console.log('\n🔍 Step 2: Cache state before update...');
    const beforeUpdateCache = repository.getCacheMetadata();
    console.log(`💾 Before update cache: ${beforeUpdateCache.totalEntries} entries`);
    
    // Step 3: Perform update
    console.log('\n✏️ Step 3: Performing update...');
    recipeEvents.length = 0; // Clear event log
    cacheEvents.length = 0;
    
    const updatedData = {
      name: 'Guláš',
      servings: 10 // Changed from 4 to 10
    };
    
    console.log('About to call repository.update...');
    await repository.update('gulas.json', updatedData, {
      syncStrategy: SyncStrategy.IMMEDIATE,
      optimistic: true
    });
    console.log('Update completed');
    
    // Step 4: Check cache immediately after update
    console.log('\n🔍 Step 4: Cache state immediately after update...');
    const afterUpdateCache = repository.getCacheMetadata();
    console.log(`💾 After update cache: ${afterUpdateCache.totalEntries} entries`);
    console.log('Cache keys after update:', afterUpdateCache.entries.map(e => e.name));
    
    // Step 5: Check what getCachedRecipes returns
    console.log('\n🔍 Step 5: What getCachedRecipes returns...');
    const cachedRecipesAfterUpdate = repository.getCachedRecipes ? repository.getCachedRecipes() : 'method not accessible';
    console.log('getCachedRecipes result:', Array.isArray(cachedRecipesAfterUpdate) ? cachedRecipesAfterUpdate.length : cachedRecipesAfterUpdate);
    
    // Step 6: Check what getAll returns
    console.log('\n🔍 Step 6: What getAll returns after update...');
    const allRecipesAfterUpdate = await repository.getAll();
    console.log(`📋 getAll after update: ${allRecipesAfterUpdate.length} recipes`);
    
    // Log events
    console.log('\n📊 Events during update:');
    recipeEvents.forEach((event, i) => {
      console.log(`  Recipe Event ${i + 1}: ${event.event} (${event.count} recipes)`);
    });
    cacheEvents.forEach((event, i) => {
      console.log(`  Cache Event ${i + 1}: ${event.event}`, event.data);
    });
    
    // This should pass but will probably fail, revealing the issue
    expect(allRecipesAfterUpdate).toHaveLength(13);
  });
});
