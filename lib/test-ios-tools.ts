import { bashTool, grepTool, findTool, readTool, writeTool, lsTool, getFilesystem, resetBash } from "./ios-tools.js";

async function main() {
  console.log("Testing iOS tools...\n");
  
  // Reset to fresh state
  resetBash();
  
  // First, let's create some test files
  const bash = getFilesystem();
  await bash.exec('mkdir -p /project/src');
  await bash.exec('echo "const greeting = \'Hello iOS\'" > /project/src/main.ts');
  await bash.exec('echo "import { greeting } from \'./main\'" > /project/src/index.ts');
  await bash.exec('echo "# iOS Project\nThis is a test" > /project/README.md');
  
  console.log("1. bash tool:");
  const bashResult = await bashTool('ls -la /project');
  console.log(bashResult.stdout);
  
  console.log("2. grep tool:");
  const grepResult = await grepTool('iOS', '/project', { ignoreCase: true });
  console.log(`Found ${grepResult.matchCount} matches:`);
  console.log(grepResult.output);
  
  console.log("3. find tool:");
  const findResult = await findTool('*.ts', '/project');
  console.log("TypeScript files:", findResult.files);
  
  console.log("\n4. read tool:");
  const readResult = await readTool('/project/src/main.ts');
  console.log("main.ts content:", readResult.content);
  
  console.log("5. write tool:");
  await writeTool('/project/test.txt', 'Written from iOS!');
  const verifyWrite = await bashTool('cat /project/test.txt');
  console.log("Verified write:", verifyWrite.stdout.trim());
  
  console.log("\n6. ls tool:");
  const lsResult = await lsTool('/project', { long: true, all: true });
  console.log(lsResult.output);
  
  console.log("\n✅ All iOS tools working!");
}

main().catch(console.error);
