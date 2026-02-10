// Test cursor movement sequences directly
const write = (s) => process.stdout.write(s);

// Clear and home
write('\x1b[2J\x1b[H');

// Print 10 lines
for (let i = 1; i <= 10; i++) {
  write(`Line ${i}\r\n`);
}

// Wait, then try cursor up
setTimeout(() => {
  write('\x1b[5A');  // Move up 5 lines
  write('\x1b[2K');  // Clear line
  write('>>> UPDATED LINE 6 <<<\r\n');
  
  setTimeout(() => {
    write('\x1b[?25h');
    write('\r\nTest complete. Line 6 should say UPDATED.\r\n');
  }, 2000);
}, 2000);

// Keep alive
setInterval(() => {}, 1000);
