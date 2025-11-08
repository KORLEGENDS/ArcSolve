function tick(): void {
  const ts = new Date().toISOString();
  process.stdout.write(`[outbox-worker] alive ${ts}\n`);
}

setInterval(tick, 5000);
tick();




