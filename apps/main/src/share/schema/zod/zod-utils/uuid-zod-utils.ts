export function generateUUID(): string {
  // RFC4122 v4 (non-crypto) fallback for universal environments
  let dt = new Date().getTime();
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    dt += performance.now();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}


