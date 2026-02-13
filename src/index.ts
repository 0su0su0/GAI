import { ConfigLoader } from './config/ConfigLoader.js';
import { LLMManager } from './llm/LLMManager.js';
import { Agent } from './core/Agent.js';
import { ToolRegistry } from './core/ToolRegistry.js';
import { ScreenReaderTool } from './tools/gui/ScreenReader.js';
import { EchoTool } from './tools/gui/EchoTool.js';
import type { LLMConfig, LLMModeConfig } from './core/types.js';

async function main() {
  console.log('🤖 GAI (Graphic Agent Interface) - Starting...\n');

  // Load configuration
  const configLoader = new ConfigLoader();
  const config = configLoader.get();

  // Validate configuration
  const validation = configLoader.validate();
  if (!validation.valid) {
    console.error('❌ Configuration errors:');
    validation.errors.forEach((err) => console.error(`  - ${err}`));
    console.error('\nPlease set ANTHROPIC_API_KEY in .env file or config/config.json');
    process.exit(1);
  }

  console.log(`✅ Configuration loaded:`);

  // Check if mode config
  if ('default' in config.llm && 'fast' in config.llm && 'vision' in config.llm) {
    const modeConfig = config.llm as LLMModeConfig;
    console.log(`   Mode: Multi-mode (default/fast/vision)`);
    console.log(`   Default: ${modeConfig.default.provider} / ${modeConfig.default.model}`);
    console.log(`   Fast: ${modeConfig.fast.provider} / ${modeConfig.fast.model}`);
    console.log(`   Vision: ${modeConfig.vision.provider} / ${modeConfig.vision.model}`);
  } else {
    const singleConfig = config.llm as LLMConfig;
    console.log(`   Mode: Single`);
    console.log(`   Provider: ${singleConfig.provider}`);
    console.log(`   Model: ${singleConfig.model}`);
  }

  console.log(`   Max Iterations: ${config.agent.maxIterations}\n`);

  // Initialize LLM Manager
  const llmManager = new LLMManager(config.llm);
  const llm = llmManager.getAdapter();

  // Initialize Tool Registry
  const toolRegistry = new ToolRegistry();

  // Register tools (with LLM injection for GUI tools)
  toolRegistry.register(new EchoTool());
  toolRegistry.register(new ScreenReaderTool(llm));

  console.log(`✅ Registered ${toolRegistry.count()} tools:`);
  toolRegistry.getAll().forEach((tool) => {
    console.log(`   - ${tool.name}: ${tool.description}`);
  });
  console.log('');

  // Initialize Agent
  const agent = new Agent(llmManager, toolRegistry, {
    maxIterations: config.agent.maxIterations,
    verbose: true,
  });

  // Start session
  agent.startSession();

  // Get user input from command line
  const userInput = process.argv.slice(2).join(' ');

  if (!userInput) {
    console.log('Usage: npm start <your message>');
    console.log('Example: npm start "Echo hello world"');
    console.log('Example: npm start "Analyze the current screen"');
    process.exit(0);
  }

  console.log(`📝 User: ${userInput}\n`);
  console.log('🤔 Agent thinking...\n');
  console.log('━'.repeat(60));

  // Process request
  const response = await agent.processRequest(userInput);

  console.log('━'.repeat(60));
  console.log(`\n✨ Final Response:\n`);
  console.log(response.message);

  if (response.finished) {
    console.log('\n✅ Task completed!');
  } else {
    console.log('\n⚠️  Task incomplete (max iterations reached)');
  }

  // Clean up
  agent.endSession();
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
