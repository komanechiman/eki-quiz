/* えきクイズ Service Worker
   - 初回アクセスで必要なファイルを全部キャッシュ → 以降はオフラインでも動く
   - HTML は network-first（新しい版があれば取りに行く / 圏外ならキャッシュ）
   - それ以外は cache-first（速い）
   ファイルを更新したら CACHE_VERSION の数字を上げてください。 */

var CACHE_VERSION = "v3";
var CACHE_NAME = "eki-quiz-" + CACHE_VERSION;

var PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      // 1つ失敗しても install 全体を止めない
      return Promise.all(PRECACHE.map(function(url){
        return cache.add(new Request(url, {cache: "reload"}))["catch"](function(){});
      }));
    })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE_NAME) return caches["delete"](k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// ページから「更新」ボタンが押されたとき
self.addEventListener("message", function(e){
  if(e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;

  var url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if(url.origin !== self.location.origin) return;

  var isHTML = req.mode === "navigate" ||
               (req.headers.get("accept") || "").indexOf("text/html") !== -1;

  if(isHTML){
    // network-first
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(c){ c.put(req, copy); });
        return res;
      })["catch"](function(){
        return caches.match(req).then(function(hit){
          return hit || caches.match("./index.html");
        });
      })
    );
    return;
  }

  // cache-first
  e.respondWith(
    caches.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(res){
        if(res && res.status === 200 && res.type === "basic"){
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function(c){ c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
