const write = (s) => process.stdout.write(s + '\r\n');
write('Terminal size test:');
write('process.stdout.columns: ' + process.stdout.columns);
write('process.stdout.rows: ' + process.stdout.rows);
write('env PI_TERMINAL_COLUMNS: ' + process.env.PI_TERMINAL_COLUMNS);
write('env PI_TERMINAL_ROWS: ' + process.env.PI_TERMINAL_ROWS);
write('global __PI_TERMINAL_COLUMNS: ' + globalThis.__PI_TERMINAL_COLUMNS);
write('global __PI_TERMINAL_ROWS: ' + globalThis.__PI_TERMINAL_ROWS);
setInterval(() => {}, 1000);
