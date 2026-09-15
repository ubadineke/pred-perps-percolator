const [command, phase] = process.argv.slice(2);

console.error(`${command} is intentionally unavailable until ${phase}.`);
process.exitCode = 2;

