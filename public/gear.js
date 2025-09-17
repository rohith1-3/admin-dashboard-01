// Minimal hash-based router and utilities used by this demo app
// Exposes Gear: { route, navigate, onReady, el, html, fmtDate, today }
(function () {
  const listeners = [];
  const routes = {};

  function route(path, render) {
    routes[path] = render;
  }

  function navigate(path) {
    if (location.hash !== `#${path}`) location.hash = `#${path}`;
    render();
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function render() {
    const hash = location.hash || '#/dashboard';
    const path = hash.replace(/^#/, '');
    const renderer = routes[path] || routes['/404'];
    if (renderer) renderer();
    listeners.forEach((l) => l());
  }

  window.addEventListener('hashchange', render);

  // small helper to create elements
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.substring(2), v);
        else if (v !== undefined && v !== null) node.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function html(strings, ...vals) {
    const tpl = document.createElement('template');
    tpl.innerHTML = strings.reduce((acc, s, i) => acc + s + (vals[i] ?? ''), '');
    return tpl.content;
  }

  function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toISOString().slice(0, 10);
  }

  function today(offsetDays = 0) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  window.Gear = { route, navigate, onReady, el, html, fmtDate, today };
})();

