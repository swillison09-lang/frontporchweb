// Small stand-ins for browser features that older TVs lack (Chromecast/Vizio Cast
// firmware runs Chrome 84). Each one only fills in when the browser doesn't have it,
// so newer browsers are untouched. Load before vendor/supabase.js.
(() => {
  if (!window.structuredClone) {
    // Supabase only clones plain settings objects, which JSON handles.
    window.structuredClone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  }
  if (!Array.prototype.at) {
    Object.defineProperty(Array.prototype, 'at', {
      configurable: true, writable: true,
      value(i) { i = Math.trunc(i) || 0; if (i < 0) i += this.length; return this[i]; },
    });
  }
  if (!Object.hasOwn) {
    Object.hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  }
  if (!String.prototype.replaceAll) {
    Object.defineProperty(String.prototype, 'replaceAll', {
      configurable: true, writable: true,
      value(find, repl) {
        if (find instanceof RegExp) return this.replace(find, repl);
        return this.split(String(find)).join(typeof repl === 'function' ? repl(find) : repl);
      },
    });
  }
  if (window.AbortSignal && !AbortSignal.timeout) {
    AbortSignal.timeout = ms => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
  }
  if (!Promise.any) {
    Promise.any = list => new Promise((resolve, reject) => {
      const items = Array.from(list), errors = [];
      let left = items.length;
      if (!left) reject(new Error('All promises were rejected'));
      items.forEach((p, i) => Promise.resolve(p).then(resolve, e => { errors[i] = e; if (!--left) reject(new Error('All promises were rejected')); }));
    });
  }
})();
