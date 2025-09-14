/**
 * End-to-End Cache Consistency Test
 * 
 * This test simulates the exact scenario you're experiencing:
 * 1. Load a bunch of recipes (13 recipes)
 * 2. Update one recipe 
 * 3. Check that all recipes are still in cache
 * 4. Simulate GitHub being slow and eventually consistent
 */

import RecipeRepository, { SyncStrategy } from '../repositories/RecipeRepository.js';
import { generateFilenameFromRecipeName } from '../utils/recipeUtils.js';

// Mock GitHub API that simulates realistic behavior
class RealisticMockGitHubAPI {
  constructor() {
    this.files = new Map();
    this.networkDelay = 100; // Simulate network delay
    this.eventualConsistencyDelay = 500; // Simulate eventual consistency
    this.callLog = [];
    
    // Set up initial 13 recipes like in your real scenario
    this.setupInitialRecipes();
  }
  
  setupInitialRecipes() {
    const recipes = [
      { name: 'Guláš', ingredients: ['beef', 'onion'], instructions: ['Cook'], servings: 4 },
      { name: 'Palačinky', ingredients: ['flour', 'milk'], instructions: ['Mix'], servings: 6 },
      { name: 'Šťáva z arónie', ingredients: ['berries'], instructions: ['Juice'], servings: 2 },
      { name: 'Hovězí guláš', ingredients: ['beef'], instructions: ['Stew'], servings: 8 },
      { name: 'Česnečka', ingredients: ['garlic'], instructions: ['Boil'], servings: 4 },
      { name: 'Svíčková', ingredients: ['beef', 'cream'], instructions: ['Roast'], servings: 6 },
      { name: 'Řízek', ingredients: ['pork'], instructions: ['Fry'], servings: 2 },
      { name: 'Knedlíky', ingredients: ['flour'], instructions: ['Steam'], servings: 8 },
      { name: 'Bramboráky', ingredients: ['potatoes'], instructions: ['Grate'], servings: 4 },
      { name: 'Smažený sýr', ingredients: ['cheese'], instructions: ['Fry'], servings: 2 },
      { name: 'Goulash soup', ingredients: ['beef', 'paprika'], instructions: ['Simmer'], servings: 6 },
      { name: 'Apple strudel', ingredients: ['apples'], instructions: ['Bake'], servings: 8 },
      { name: 'Potato dumplings', ingredients: ['potatoes'], instructions: ['Boil'], servings: 6 }
    ];
    
    recipes.forEach(recipe => {
      const filename = generateFilenameFromRecipeName(recipe.name);
      this.files.set(filename, recipe);
    });
  }
  
  async getFileList() {
    this.callLog.push('getFileList');
    await this.simulateNetworkDelay();
    return Array.from(this.files.keys());
  }
  
  async getFile(filename) {
    this.callLog.push(`getFile:${filename}`);
    await this.simulateNetworkDelay();
    
    if (this.files.has(filename)) {
      return { ...this.files.get(filename) }; // Return copy
    }
    throw new Error(`File not found: ${filename}`);
  }
  
  async createFile(filename, content) {
    this.callLog.push(`createFile:${filename}`);
    await this.simulateNetworkDelay();
    
    if (this.files.has(filename)) {
      throw new Error(`File already exists: ${filename}`);
    }
    
    this.files.set(filename, { ...content });
    
    // Simulate eventual consistency - file might not be immediately available
    setTimeout(() => {
      // File becomes eventually consistent
    }, this.eventualConsistencyDelay);
    
    return { success: true };
  }
  
  async updateFile(filename, content) {
    this.callLog.push(`updateFile:${filename}`);
    await this.simulateNetworkDelay();
    
    if (!this.files.has(filename)) {
      throw new Error(`File not found: ${filename}`);
    }
    
    // Simulate the update with eventual consistency
    this.files.set(filename, { ...content });
    
    // Simulate eventual consistency delay
    setTimeout(() => {
      console.log(`📡 Eventually consistent: ${filename}`);
    }, this.eventualConsistencyDelay);
    
    return { success: true };
  }
  
  async deleteFile(filename) {
    this.callLog.push(`deleteFile:${filename}`);
    await this.simulateNetworkDelay();
    
    if (!this.files.has(filename)) {
      throw new Error(`File not found: ${filename}`);
    }
    
    this.files.delete(filename);
    return { success: true };
  }
  
  async checkFileExists(filename) {
    this.callLog.push(`checkFileExists:${filename}`);
    await this.simulateNetworkDelay();
    return this.files.has(filename);
  }
  
  async simulateNetworkDelay() {
    await new Promise(resolve => setTimeout(resolve, this.networkDelay));
  }
  
  getCallLog() {
    return [...this.callLog];
  }
  
  clearCallLog() {
    this.callLog = [];
  }
  
  setNetworkDelay(ms) {
    this.networkDelay = ms;
  }
}

describe('E2E Cache Consistency Test', () => {
  let repository;
  let mockGitHubAPI;
  let eventLog;
  
  beforeEach(() => {
    mockGitHubAPI = new RealisticMockGitHubAPI();
    repository = new RecipeRepository({
      cacheTimeout: 300000, // 5 minutes like in your real app
      syncStrategy: SyncStrategy.IMMEDIATE,
      optimisticUpdates: true
    });
    
    repository.setGitHubAPI(mockGitHubAPI);
    
    // Track all events
    eventLog = [];
    repository.on('recipesUpdated', (recipes) => {
      eventLog.push({ event: 'recipesUpdated', count: recipes.length });
      console.log(`📡 recipesUpdated: ${recipes.length} recipes`);
    });
    
    repository.on('cacheUpdated', (data) => {
      eventLog.push({ event: 'cacheUpdated', data });
      console.log(`💾 cacheUpdated:`, data);
    });
  });
  
  test('should maintain all recipes in cache after updating one recipe', async () => {
    console.log('\n🧪 Starting E2E Cache Consistency Test...');
    
    // Step 1: Load initial recipes (simulating your app startup)
    console.log('\n📋 Step 1: Loading initial recipes...');
    const initialRecipes = await repository.getAll();
    console.log(`✅ Loaded ${initialRecipes.length} recipes initially`);
    
    expect(initialRecipes).toHaveLength(13);
    
    // Verify cache metadata
    const initialMetadata = repository.getCacheMetadata();
    console.log(`💾 Initial cache: ${initialMetadata.totalEntries} entries`);
    expect(initialMetadata.totalEntries).toBe(13);
    
    // Step 2: Update one recipe (simulating user edit)
    console.log('\n✏️ Step 2: Updating one recipe...');
    const recipeToUpdate = 'gulas.json'; // This is your Guláš recipe
    const originalRecipe = await repository.getByName(recipeToUpdate);
    
    const updatedData = {
      ...originalRecipe,
      servings: 10, // Changed from 4 to 10
      description: 'Updated description'
    };
    
    // Clear event log before update
    eventLog.length = 0;
    
    const updatedRecipe = await repository.update(recipeToUpdate, updatedData, {
      syncStrategy: SyncStrategy.IMMEDIATE,
      optimistic: true
    });
    
    console.log(`✅ Recipe updated: ${updatedRecipe.name}`);
    
    // Step 3: Check cache state immediately after update
    console.log('\n🔍 Step 3: Checking cache state after update...');
    const cacheMetadataAfterUpdate = repository.getCacheMetadata();
    console.log(`💾 Cache after update: ${cacheMetadataAfterUpdate.totalEntries} entries`);
    
    // THIS IS THE CRITICAL TEST - Cache should still have all 13 recipes
    expect(cacheMetadataAfterUpdate.totalEntries).toBe(13);
    
    // Step 4: Verify all recipes are still accessible
    console.log('\n🔍 Step 4: Verifying all recipes are still accessible...');
    const allRecipesAfterUpdate = await repository.getAll();
    console.log(`📋 Recipes accessible after update: ${allRecipesAfterUpdate.length}`);
    
    // THIS IS THE MAIN ISSUE - Should be 13, not 1
    expect(allRecipesAfterUpdate).toHaveLength(13);
    
    // Verify the updated recipe has the new data
    const updatedRecipeFromCache = allRecipesAfterUpdate.find(r => r.name === 'Guláš');
    expect(updatedRecipeFromCache.servings).toBe(10);
    expect(updatedRecipeFromCache.description).toBe('Updated description');
    
    // Step 5: Simulate eventual consistency delay
    console.log('\n⏰ Step 5: Waiting for eventual consistency...');
    await new Promise(resolve => setTimeout(resolve, 600)); // Wait for eventual consistency
    
    // Step 6: Final verification
    console.log('\n🔍 Step 6: Final verification after eventual consistency...');
    const finalRecipes = await repository.getAll({ forceRefresh: true });
    console.log(`📋 Final recipe count: ${finalRecipes.length}`);
    
    expect(finalRecipes).toHaveLength(13);
    
    // Log the event sequence
    console.log('\n📊 Event Log:');
    eventLog.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.event}: ${JSON.stringify(event.data || event.count)}`);
    });
    
    // Log API calls
    console.log('\n📡 API Call Log:');
    mockGitHubAPI.getCallLog().forEach((call, i) => {
      console.log(`  ${i + 1}. ${call}`);
    });
  });
  
  test('should handle slow GitHub responses gracefully', async () => {
    console.log('\n🧪 Testing slow GitHub responses...');
    
    // Load initial recipes
    await repository.getAll();
    
    // Make GitHub API slow
    mockGitHubAPI.setNetworkDelay(1000); // 1 second delay
    
    const startTime = Date.now();
    
    // Update recipe with slow GitHub
    const updatedData = {
      name: 'Guláš',
      ingredients: ['beef', 'onion', 'paprika'],
      instructions: ['Cook slowly'],
      servings: 8
    };
    
    await repository.update('gulas.json', updatedData, {
      syncStrategy: SyncStrategy.IMMEDIATE,
      optimistic: true
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`⏱️ Update took ${duration}ms with slow GitHub`);
    
    // Even with slow GitHub, cache should be consistent
    const metadata = repository.getCacheMetadata();
    expect(metadata.totalEntries).toBe(13);
    
    const allRecipes = await repository.getAll();
    expect(allRecipes).toHaveLength(13);
  });
  
  test('should maintain cache consistency during concurrent operations', async () => {
    console.log('\n🧪 Testing concurrent operations...');
    
    // Load initial recipes
    await repository.getAll();
    
    // Perform multiple concurrent updates
    const updatePromises = [
      repository.update('gulas.json', { name: 'Guláš', servings: 6 }),
      repository.update('palacinky.json', { name: 'Palačinky', servings: 8 }),
      repository.update('stava-z-aronie.json', { name: 'Šťáva z arónie', servings: 4 })
    ];
    
    await Promise.all(updatePromises);
    
    // Cache should still have all recipes
    const metadata = repository.getCacheMetadata();
    expect(metadata.totalEntries).toBe(13);
    
    const allRecipes = await repository.getAll();
    expect(allRecipes).toHaveLength(13);
  });
});
