'use strict';
// Einstieg im Thunderbird-Verfassen-Fenster: der ganze <body> ist der Editor.

(function rspStart() {
  if (window.rspGestartet) return;
  window.rspGestartet = true;
  const los = () => {
    if (!document.body) { setTimeout(los, 200); return; }
    window.rspPruefer = new RspPruefer(document.body);
  };
  los();
})();
