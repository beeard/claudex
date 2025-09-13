export function appendJsonl(filePath, obj) {
  const fs = await import('node:fs');
  fs.mkdirSync(require('node:path').dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(obj) + "\n");
}

