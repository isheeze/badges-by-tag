(function () {
  function findCard(container) {
    return container.closest('.card, .product-card, .product-item, [class*="product-card"], [class*="card"]');
  }

  function applyBadgeSettings() {
    document.querySelectorAll('.bbt-badges').forEach(function (container) {
      var fontSize = Number(container.dataset.fontSize || 12);
      if (Number.isFinite(fontSize)) {
        container.style.setProperty('--bbt-font-size', fontSize + 'px');
      }

      var overlayOffset = Number(container.dataset.overlayOffset || 8);
      if (Number.isFinite(overlayOffset)) {
        container.style.setProperty('--bbt-overlay-offset', overlayOffset + 'px');
      }

      var position = container.dataset.position || 'inline';
      if (position === 'top-left' || position === 'top-right') {
        var card = findCard(container);
        if (card && window.getComputedStyle(card).position === 'static') {
          card.style.position = 'relative';
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBadgeSettings);
  } else {
    applyBadgeSettings();
  }

  document.addEventListener('shopify:section:load', applyBadgeSettings);
  document.addEventListener('shopify:block:select', applyBadgeSettings);
})();
