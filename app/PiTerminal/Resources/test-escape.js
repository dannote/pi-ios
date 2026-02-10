const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log("Test 1: Basic output");
  console.log("Test 2: Should appear on new line");
  console.log("");
  console.log("Input area:");
  console.log("");  // Empty line for input
  console.log("Status bar");
  
  await sleep(1000);
  
  // Now try to update the input area in place
  // We're 2 lines below the input area
  
  // Move up 2 lines
  process.stdout.write("\x1b[2A");
  // Move to column 1
  process.stdout.write("\x1b[1G");
  // Clear line
  process.stdout.write("\x1b[2K");
  // Write new content
  process.stdout.write("a");
  
  await sleep(500);
  
  // Update again
  process.stdout.write("\x1b[2K");
  process.stdout.write("\x1b[1G");
  process.stdout.write("ab");
  
  await sleep(500);
  
  // Update again
  process.stdout.write("\x1b[2K");
  process.stdout.write("\x1b[1G");
  process.stdout.write("abc");
  
  await sleep(500);
  
  // Move back down and finish
  process.stdout.write("\x1b[2B");
  process.stdout.write("\n");
  console.log("Done!");
}

main();
