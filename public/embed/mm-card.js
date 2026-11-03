(function () {
  var script = document.currentScript;
  if (!script || !script.src) return;
  var origin = new URL(script.src).origin;

  function mount(el) {
    if (el.getAttribute('data-mm-mounted')) return;
    var state = (el.getAttribute('data-mm-card') || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) return;
    el.setAttribute('data-mm-mounted', '1');
    var frame = document.createElement('iframe');
    frame.src = origin + '/embed-card.html?state=' + encodeURIComponent(state);
    frame.title = state + ' Senate 2026: Money & Margins';
    frame.loading = 'lazy';
    frame.style.cssText = 'display:block;width:100%;max-width:1200px;aspect-ratio:1200/630;border:0;';
    el.appendChild(frame);
  }

  var nodes = document.querySelectorAll('[data-mm-card]');
  for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
})();
