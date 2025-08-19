console.log("FoE Tracker активний");

// приклад: слухати всі XHR
(function(open) {
  XMLHttpRequest.prototype.open = function(method, url) {
    this.addEventListener("load", function() {
      if (url.includes("getBattleground")) {
        try {
          let data = JSON.parse(this.responseText);
          console.log("Battleground data:", data);
        } catch(e) {}
      }
    });
    open.apply(this, arguments);
  };
})(XMLHttpRequest.prototype.open);
