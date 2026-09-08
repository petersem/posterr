(function registerPosterrPwa() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  function normalizeBaseUrl(value) {
    if (!value || value === "/") {
      return "";
    }
    return value.endsWith("/") ? value.slice(0, -1) : value;
  }

  const currentScript =
    document.currentScript || document.querySelector('script[src$="/js/pwa-register.js"]');
  const baseUrl = normalizeBaseUrl(currentScript && currentScript.getAttribute("data-base-url"));
  const serviceWorkerUrl = `${baseUrl}/service-worker.js`;
  const scope = `${baseUrl || ""}/`;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register(serviceWorkerUrl, { scope: scope }).catch(function () {
      // Registration failures should not impact normal app usage.
    });
  });
})();
