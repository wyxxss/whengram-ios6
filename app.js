/* ==========================================================================
   WHENGRAM — TRUE iOS 6 LEATHER ENGINE (FULL VERSION)
   ========================================================================== */

(function() {
  var STORAGE_KEY = "whengram_ios6_leather_v1";

  var defaultManifest = {
    "version": "2.0",
    "exported_at": new Date().toISOString(),
    "memories": [],
    "events": [],
    "profile": { name: "Илюша", reminder_time: "21:00" },
    "settings": { theme: "leather", lastfm_user: "", lastfm_key: "b25b959554ed76058ac220b0b2e13d21" }
  };

  var appData = null;
  var photoCache = {};
  var webSqlDb = null;

  var currentTab = "home";
  var shelfMode = "year";
  var activeShelfFilter = null;
  var selectedMood = "positive";
  
  var currentMemoryPhotoData = "";
  var currentMemoryPhotoName = "";
  var currentEventPhotoData = "";
  var currentEventPhotoName = "";

  var MONTHS_RU_UPPER = ["ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ", "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ"];
  var MONTHS_RU_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  var DAYS_SHORT = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];

  // ==========================================================================
  // 1. ИНИЦИАЛИЗАЦИЯ И WEBSQL (БАЗА ФОТО ДЛЯ iPHONE 4S)
  // ==========================================================================
  window.onload = function() {
    initWebSQL(function() {
      loadAppState();
      bindTouchFeedback();
      initEventListeners();
      renderAll();
    });
  };

  function initWebSQL(callback) {
    try {
      if (window.openDatabase) {
        webSqlDb = window.openDatabase("WhengramLeatherDB", "1.0", "Offline Photos", 45 * 1024 * 1024);
        webSqlDb.transaction(function(tx) {
          tx.executeSql("CREATE TABLE IF NOT EXISTS photos (uri TEXT PRIMARY KEY, data TEXT)");
          tx.executeSql("SELECT uri, data FROM photos", [], function(tx2, res) {
            for (var i = 0; i < res.rows.length; i++) {
              photoCache[res.rows.item(i).uri] = res.rows.item(i).data;
            }
            callback();
          }, function() { callback(); });
        });
      } else { callback(); }
    } catch (e) { callback(); }
  }

  function savePhotoToOfflineDB(uri, base64Data) {
    if (!uri || !base64Data) return;
    photoCache[uri] = base64Data;
    if (webSqlDb) {
      webSqlDb.transaction(function(tx) { tx.executeSql("INSERT OR REPLACE INTO photos (uri, data) VALUES (?, ?)", [uri, base64Data]); });
    } else {
      try { localStorage.setItem("wg_img_" + uri, base64Data); } catch (e) {}
    }
  }

  function getPhotoSource(uri) {
    if (!uri) return "";
    if (uri.indexOf("data:image") === 0) return uri;
    var clean = uri.replace(/^photos\//, "");
    if (photoCache[clean]) return photoCache[clean];
    if (photoCache[uri]) return photoCache[uri];
    try { return localStorage.getItem("wg_img_" + clean) || ""; } catch (e) { return ""; }
  }

  function loadAppState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      appData = raw ? JSON.parse(raw) : defaultManifest;
    } catch (e) { appData = defaultManifest; }
    if (!appData.memories) appData.memories = [];
    if (!appData.events) appData.events = [];
    if (!appData.profile) appData.profile = { name: "Илюша" };
    if (!appData.settings) appData.settings = {};
  }

  function saveAppState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); } catch (e) { showHud("Память заполнена"); }
  }

  function bindTouchFeedback() {
    document.addEventListener("touchstart", function(e) {
      var t = e.target;
      while (t && t !== document.body) {
        if (t.tagName === "BUTTON" || (t.className && t.className.indexOf("cal-square") !== -1) || (t.className && t.className.indexOf("vintage-envelope") !== -1) || (t.className && t.className.indexOf("memory-row-card") !== -1)) {
          if (t.className.indexOf("touched") === -1) t.className += " touched";
          break;
        }
        t = t.parentNode;
      }
    }, false);
    document.addEventListener("touchend", function() {
      var touchedEls = document.querySelectorAll(".touched");
      for (var i = 0; i < touchedEls.length; i++) touchedEls[i].className = touchedEls[i].className.replace(/\s*touched/g, "");
    }, false);
  }

  // ==========================================================================
  // 2. ПРИВЯЗКА СОБЫТИЙ И КНОПОК
  // ==========================================================================
  function initEventListeners() {
    var tabs = document.querySelectorAll(".tab-btn");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].onclick = function() { switchTab(this.getAttribute("data-tab")); };
    }

    document.getElementById("navbar-btn-new").onclick = function() {
      if (currentTab === "events") openEventModal(null);
      else openMemoryModal(null);
    };
    var btnWriteToday = document.getElementById("btn-write-today");
    if (btnWriteToday) btnWriteToday.onclick = function() { openMemoryModal(null, getTodayISO()); };
    
    var btnQuickAdd = document.getElementById("whenweek-quick-add");
    if (btnQuickAdd) btnQuickAdd.onclick = function() { openMemoryModal(null, getTodayISO()); };

    var env = document.getElementById("on-this-day-widget");
    if (env) env.onclick = function() {
      var m = findMemoryByDate(this.getAttribute("data-target-date"));
      if (m) openReaderModal(m);
    };

    var tmBtn = document.getElementById("btn-time-machine");
    if (tmBtn) tmBtn.onclick = function() { triggerTimeMachine(); };

    document.getElementById("view-btn-list").onclick = function() {
      this.className = "seg-btn active"; document.getElementById("view-btn-shelf").className = "seg-btn";
      removeClass(document.getElementById("memories-list-container"), "hidden");
      addClass(document.getElementById("whenshelf-container"), "hidden");
    };
    document.getElementById("view-btn-shelf").onclick = function() {
      this.className = "seg-btn active"; document.getElementById("view-btn-list").className = "seg-btn";
      addClass(document.getElementById("memories-list-container"), "hidden");
      removeClass(document.getElementById("whenshelf-container"), "hidden");
      renderWoodenShelf();
    };

    document.getElementById("shelf-by-year").onclick = function() {
      shelfMode = "year"; this.className = "wood-btn active"; document.getElementById("shelf-by-month").className = "wood-btn"; renderWoodenShelf();
    };
    document.getElementById("shelf-by-month").onclick = function() {
      shelfMode = "month"; this.className = "wood-btn active"; document.getElementById("shelf-by-year").className = "wood-btn"; renderWoodenShelf();
    };
    document.getElementById("btn-reset-shelf-filter").onclick = function() {
      activeShelfFilter = null; addClass(document.getElementById("shelf-active-filter-bar"), "hidden"); renderMemoriesFeed();
    };

    // Модалка Воспоминания
    document.getElementById("btn-close-memory-modal").onclick = function() { addClass(document.getElementById("modal-memory"), "hidden"); };
    document.getElementById("btn-save-memory").onclick = function() { saveMemoryRecord(); };
    document.getElementById("btn-delete-memory").onclick = function() {
      var id = document.getElementById("memory-edit-id").value;
      if (id && confirm("Удалить?")) { deleteMemoryById(id); addClass(document.getElementById("modal-memory"), "hidden"); renderAll(); }
    };
    
    var moodBtns = document.querySelectorAll(".mood-btn");
    for (var m = 0; m < moodBtns.length; m++) {
      moodBtns[m].onclick = function() {
        for (var k = 0; k < moodBtns.length; k++) moodBtns[k].className = "mood-btn";
        this.className = "mood-btn active"; selectedMood = this.getAttribute("data-mood");
      };
    }

    document.getElementById("btn-fetch-lastfm").onclick = function() { fetchLastFmJSONP(); };

    document.getElementById("memory-photo-input").onchange = function(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      compressPhoto(file, function(b64) {
        currentMemoryPhotoData = b64; currentMemoryPhotoName = "img_" + new Date().getTime() + ".jpg";
        document.getElementById("memory-photo-preview").src = b64;
        removeClass(document.getElementById("memory-photo-preview"), "hidden");
        removeClass(document.getElementById("btn-remove-photo"), "hidden");
      });
    };
    document.getElementById("btn-remove-photo").onclick = function() {
      currentMemoryPhotoData = ""; currentMemoryPhotoName = "";
      document.getElementById("memory-photo-preview").src = "";
      addClass(document.getElementById("memory-photo-preview"), "hidden");
      addClass(this, "hidden");
    };

    // Модалка Вех
    document.getElementById("btn-close-event-modal").onclick = function() { addClass(document.getElementById("modal-event"), "hidden"); };
    document.getElementById("btn-save-event").onclick = function() { saveEventRecord(); };
    document.getElementById("btn-delete-event").onclick = function() {
      var id = document.getElementById("event-edit-id").value;
      if (id && confirm("Удалить веху?")) { deleteEventById(id); addClass(document.getElementById("modal-event"), "hidden"); renderAll(); }
    };
    document.getElementById("event-photo-input").onchange = function(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      compressPhoto(file, function(b64) {
        currentEventPhotoData = b64; currentEventPhotoName = "ev_" + new Date().getTime() + ".jpg";
        document.getElementById("event-photo-preview").src = b64;
        removeClass(document.getElementById("event-photo-preview"), "hidden");
      });
    };

    document.getElementById("btn-close-reader").onclick = function() { stopAudio(); addClass(document.getElementById("modal-reader"), "hidden"); };

    document.getElementById("btn-save-settings").onclick = function() {
      appData.profile.name = document.getElementById("setting-profile-name").value || "Илюша";
      appData.settings.lastfm_user = document.getElementById("setting-lastfm-user").value;
      saveAppState(); renderAll(); showHud("Настройки сохранены");
    };
    document.getElementById("btn-export-zip").onclick = function() { exportWhengramZip(); };
    document.getElementById("input-import-zip").onchange = function(e) { importWhengramZip(e.target.files[0]); };

    document.getElementById("memories-search-input").oninput = renderMemoriesFeed;
    document.getElementById("memories-mood-filter").onchange = renderMemoriesFeed;
    document.getElementById("events-search-input").oninput = renderEventsFeed;
  }

  function switchTab(tabName) {
    currentTab = tabName;
    var views = document.querySelectorAll(".tab-view");
    for (var i = 0; i < views.length; i++) addClass(views[i], "hidden");
    removeClass(document.getElementById("tab-" + tabName), "hidden");

    var btns = document.querySelectorAll(".tab-btn");
    for (var j = 0; j < btns.length; j++) {
      btns[j].className = (btns[j].getAttribute("data-tab") === tabName) ? "tab-btn active" : "tab-btn";
    }

    var navTitle = document.getElementById("navbar-title");
    var actionBtn = document.getElementById("navbar-btn-new");
    var capBtn = document.getElementById("navbar-btn-capsule");

    if (tabName === "home") {
      navTitle.innerText = "WHENGRAM";
      removeClass(actionBtn, "hidden"); removeClass(capBtn, "hidden");
    } else if (tabName === "memories") {
      navTitle.innerText = "ВОСПОМИНАНИЯ";
      removeClass(actionBtn, "hidden"); addClass(capBtn, "hidden");
    } else if (tabName === "events") {
      navTitle.innerText = "ВЕХИ";
      removeClass(actionBtn, "hidden"); addClass(capBtn, "hidden");
    } else {
      navTitle.innerText = "НАСТРОЙКИ";
      addClass(actionBtn, "hidden"); addClass(capBtn, "hidden");
    }
    document.getElementById("main-scroll").scrollTop = 0;
  }

  // ==========================================================================
  // 3. ОТРИСОВКА ИНТЕРФЕЙСА
  // ==========================================================================
  function renderAll() {
    var todayIso = getTodayISO();
    
    var hr = new Date().getHours();
    var greet = (hr >= 5 && hr < 12) ? "ДОБРОЕ УТРО," : (hr >= 18 || hr < 5 ? "ДОБРЫЙ ВЕЧЕР," : "ДОБРЫЙ ДЕНЬ,");
    document.getElementById("home-greeting-time").innerText = greet;
    document.getElementById("home-greeting-name").innerText = (appData.profile.name || "ИЛЮША").toUpperCase();

    var dParts = todayIso.split("-");
    var ruDate = parseInt(dParts[2], 10) + " " + MONTHS_RU_UPPER[parseInt(dParts[1], 10) - 1] + " " + dParts[0] + " Г.";
    document.getElementById("home-current-date").innerText = getWeekdayFull(todayIso) + ", " + ruDate;
    document.getElementById("home-day-number").innerText = "№ " + getDayOfYear(todayIso);

    renderOnThisDay(todayIso);

    var todayMem = findMemoryByDate(todayIso);
    var promptCard = document.getElementById("home-prompt-card");
    var todayCard = document.getElementById("home-today-card");

    if (todayMem) {
      addClass(promptCard, "hidden"); removeClass(todayCard, "hidden");
      var moodBadge = document.getElementById("today-card-mood");
      moodBadge.innerText = getMoodTitle(todayMem.mood);
      moodBadge.className = "meta-badge mood-badge mood-" + (todayMem.mood || "positive");

      var pWrap = document.getElementById("today-card-photo-wrap");
      var img = getPhotoSource(todayMem.imageUri);
      if (img) { document.getElementById("today-card-photo").src = img; removeClass(pWrap, "hidden"); }
      else { addClass(pWrap, "hidden"); }

      var parsed = splitTextAndSong(todayMem.text, todayMem);
      document.getElementById("today-card-text").innerText = parsed.cleanText;
      document.getElementById("today-card-time").innerText = formatTime(todayMem.created_at);
      renderLastFmWidget(parsed.song, "today-lastfm-box");

      document.getElementById("btn-edit-today").onclick = function() { openMemoryModal(todayMem); };
    } else {
      removeClass(promptCard, "hidden"); addClass(todayCard, "hidden");
    }

    renderCalendarSquares(todayIso);
    renderFlipClocks(getDayOfYear(todayIso));
    renderMemoriesFeed();
    renderWoodenShelf();
    renderEventsFeed();
    
    document.getElementById("setting-profile-name").value = appData.profile.name || "Илюша";
    document.getElementById("setting-lastfm-user").value = appData.settings.lastfm_user || "";
  }

  function renderOnThisDay(todayIso) {
    var env = document.getElementById("on-this-day-widget");
    if (!env) return;
    var parts = todayIso.split("-");
    var moDay = parts[1] + "-" + parts[2];
    var currYr = parseInt(parts[0], 10);
    
    var found = null, yearsAgo = 0;
    for (var i = 0; i < appData.memories.length; i++) {
      var m = appData.memories[i];
      if (m.date && m.date !== todayIso && m.date.indexOf("-" + moDay) !== -1) {
        found = m; yearsAgo = currYr - parseInt(m.date.split("-")[0], 10); break;
      }
    }
    
    if (found) {
      env.setAttribute("data-target-date", found.date);
      document.getElementById("env-date-subtitle").innerText = (yearsAgo === 1) ? "Ровно год назад вы что-то записали..." : yearsAgo + " г. назад вы что-то записали...";
      removeClass(env, "hidden");
    } else { addClass(env, "hidden"); }
  }

  function triggerTimeMachine() {
    if (appData.memories.length === 0) { showHud("Капсула пока пуста!"); return; }
    var rnd = Math.floor(Math.random() * appData.memories.length);
    openReaderModal(appData.memories[rnd]);
  }

  function renderCalendarSquares(todayIso) {
    var strip = document.getElementById("whenweek-strip");
    if (!strip) return;
    strip.innerHTML = "";

    var now = new Date();
    var dw = now.getDay();
    var diff = now.getDate() - dw + (dw === 0 ? -6 : 1);
    var mon = new Date(now.getFullYear(), now.getMonth(), diff);

    var writtenCount = 0;
    var mlbl = document.getElementById("whenweek-month-label");
    if (mlbl) mlbl.innerText = "WHENWEEK • " + MONTHS_RU_UPPER[mon.getMonth()];

    var labels = ["П", "В", "С", "Ч", "П", "С", "В"];

    for (var i = 0; i < 7; i++) {
      var d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
      var iso = dateToISO(d);
      var mem = findMemoryByDate(iso);
      if (mem) writtenCount++;

      var btn = document.createElement("div");
      btn.className = "cal-square" + (iso === todayIso ? " is-today" : "") + (mem ? " has-mem" : "");
      btn.innerHTML = '<span class="cal-sq-day">' + labels[i] + '</span><span class="cal-sq-num">' + d.getDate() + '</span><div class="cal-sq-dot"></div>';

      (function(targetIso, existing) {
        btn.onclick = function() {
          if (existing) openReaderModal(existing);
          else openMemoryModal(null, targetIso);
        };
      })(iso, mem);
      strip.appendChild(btn);
    }
    
    var cnt = document.getElementById("whenweek-count");
    if (cnt) cnt.innerText = "ЗАПИСАНО: " + writtenCount;
  }

  function renderFlipClocks(doy) {
    drawFlip("flip-memories", appData.memories.length);
    drawFlip("flip-events", appData.events.length);
    drawFlip("flip-day-of-year", doy);
  }
  function drawFlip(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    var s = "" + (val || 0);
    while (s.length < 3) s = "0" + s;
    var h = "";
    for (var i = 0; i < s.length; i++) h += '<span class="flip-digit">' + s.charAt(i) + '</span>';
    el.innerHTML = h;
  }

  // ==========================================================================
  // ЛЕНТА, ШКАФ И ВЕХИ
  // ==========================================================================
  function renderMemoriesFeed() {
    var feed = document.getElementById("memories-list-container");
    if (!feed) return;
    feed.innerHTML = "";

    var q = (document.getElementById("memories-search-input").value || "").toLowerCase();
    var filter = document.getElementById("memories-mood-filter").value;

    var list = [];
    for (var i = 0; i < appData.memories.length; i++) {
      var m = appData.memories[i];
      var matchQ = !q || (m.text && m.text.toLowerCase().indexOf(q) !== -1) || (m.date && m.date.indexOf(q) !== -1);
      var matchF = filter === "all" || (filter === "photo" && m.imageUri) || m.mood === filter;
      var matchShelf = !activeShelfFilter || (m.date && m.date.indexOf(activeShelfFilter) === 0);
      if (matchQ && matchF && matchShelf) list.push(m);
    }

    list.sort(function(a, b) { return a.date < b.date ? 1 : -1; });

    if (list.length === 0) {
      feed.innerHTML = '<div class="ios6-inset-panel" style="text-align:center;padding:20px;"><div style="color:#d1c1a9;font-weight:bold;">Записей не найдено</div></div>';
      return;
    }

    var groups = {}, order = [];
    for (var j = 0; j < list.length; j++) {
      var item = list[j];
      var p = item.date.split("-");
      var key = p[0] + "-" + p[1];
      if (!groups[key]) {
        groups[key] = { title: (MONTHS_RU_UPPER[parseInt(p[1],10)-1] || p[1]) + " " + p[0], items: [] };
        order.push(key);
      }
      groups[key].items.push(item);
    }

    for (var g = 0; g < order.length; g++) {
      var grp = groups[order[g]];
      var wrap = document.createElement("div");
      wrap.innerHTML = '<div class="month-group-header" style="background:#d4c5ae; padding:6px 10px; margin: 10px 0 6px 0; border-radius:4px; font-size:10px; font-weight:bold; color:#4a3726;">' + grp.title + ' <span style="float:right;">' + grp.items.length + ' ВОСП.</span></div>';

      for (var k = 0; k < grp.items.length; k++) {
        var mem = grp.items[k];
        var card = document.createElement("div");
        card.className = "ios6-paper-card";
        card.style.cursor = "pointer";
        
        var dP = mem.date.split("-");
        var imgData = getPhotoSource(mem.imageUri);
        var thumb = imgData ? '<div style="float:right; width:50px; height:50px; border:1px solid #ccc; border-radius:4px; overflow:hidden; margin-left:10px;"><img src="' + imgData + '" style="width:100%;height:100%;object-fit:cover;"></div>' : '';
        
        var parsed = splitTextAndSong(mem.text, mem);
        var songHtml = parsed.song ? '<div style="font-size:10px; color:#d94e28; font-weight:bold; margin-top:4px;">&#9835; ' + escapeHtml(parsed.song.artist + " — " + parsed.song.title) + '</div>' : '';

        card.innerHTML = '<div style="float:left; width:45px; text-align:center; border-right:1px dotted #ccc; margin-right:10px; padding-right:5px;"><span style="display:block; font-size:18px; font-weight:900; border-bottom:2px solid #e8451e; margin-bottom:2px;">' + dP[2] + '</span><span style="font-size:9px; color:#888;">' + getWeekdayShort(mem.date) + '</span></div>' +
                         thumb + '<div style="overflow:hidden;"><div style="font-family:Georgia,serif; font-size:13px; color:#333; max-height:36px; overflow:hidden;">' + escapeHtml(parsed.cleanText) + '</div>' + songHtml + '</div>';
        
        (function(mObj) { card.onclick = function() { openReaderModal(mObj); }; })(mem);
        wrap.appendChild(card);
      }
      feed.appendChild(wrap);
    }
  }

  function renderWoodenShelf() {
    var shelf = document.getElementById("ibooks-wooden-shelf");
    if (!shelf) return;
    shelf.innerHTML = "";

    var map = {}, keys = [];
    for (var i = 0; i < appData.memories.length; i++) {
      var m = appData.memories[i];
      if (!m.date) continue;
      var p = m.date.split("-");
      var key = shelfMode === "year" ? p[0] : (p[0] + "-" + p[1]);
      if (!map[key]) { map[key] = { key: key, year: p[0], month: p[1], count: 0 }; keys.push(key); }
      map[key].count++;
    }

    if (shelfMode === "year" && keys.length < 3) {
      var sys = ["2026", "2025", "2024"];
      for (var s = 0; s < sys.length; s++) {
        if (!map[sys[s]]) { map[sys[s]] = { key: sys[s], year: sys[s], month: "01", count: 0 }; keys.push(sys[s]); }
      }
    }
    keys.sort().reverse();
    var colors = ["#691e09", "#0f3628", "#15243d"]; // терракота, изумруд, синий

    for (var t = 0; t < keys.length; t += 3) {
      var tier = document.createElement("div");
      tier.style.cssText = "min-height:120px; background:#3d1f0c; padding:15px 10px; border-bottom:15px solid #78421e; position:relative; box-shadow:inset 0 -5px 10px rgba(0,0,0,0.5);";

      for (var b = t; b < t + 3 && b < keys.length; b++) {
        var item = map[keys[b]];
        var book = document.createElement("div");
        book.style.cssText = "float:left; width:30%; height:90px; margin:0 1.6%; padding:10px; border-radius:4px 6px 6px 4px; box-shadow:inset 2px 0 3px rgba(255,255,255,0.2), 3px 4px 6px rgba(0,0,0,0.6); cursor:pointer; background:linear-gradient(to right, " + colors[b%3] + ", #222);";
        book.innerHTML = '<span style="display:block; font-family:Georgia,serif; font-size:16px; font-weight:bold; color:#ffdf9e;">' + item.year + '</span>' +
                         '<span style="display:block; font-size:10px; font-weight:bold; color:#fff; margin-top:2px;">' + (shelfMode === "year" ? "АРХИВ" : MONTHS_RU_NOM[parseInt(item.month,10)-1]) + '</span>' +
                         '<span style="position:absolute; bottom:8px; font-size:9px; color:#f0d8a8; border-top:1px solid rgba(255,255,255,0.2); padding-top:2px;">' + item.count + ' ЗАП.</span>';
        
        (function(bookInfo) {
          book.onclick = function() {
            if (bookInfo.count === 0) { showHud("Пустой том"); return; }
            activeShelfFilter = bookInfo.key;
            removeClass(document.getElementById("shelf-active-filter-bar"), "hidden");
            document.getElementById("shelf-filter-title").innerText = "Том: " + bookInfo.key;
            document.getElementById("view-btn-list").click();
            renderMemoriesFeed();
          };
        })(item);
        tier.appendChild(book);
      }
      shelf.appendChild(tier);
    }
  }

  function renderEventsFeed() {
    var feed = document.getElementById("events-list-container");
    if (!feed) return;
    feed.innerHTML = "";
    var q = (document.getElementById("events-search-input").value || "").toLowerCase();
    
    var list = [];
    for (var i = 0; i < appData.events.length; i++) {
      var e = appData.events[i];
      if (!q || (e.title||"").toLowerCase().indexOf(q) !== -1 || (e.category||"").toLowerCase().indexOf(q) !== -1) list.push(e);
    }
    list.sort(function(a, b) { return a.date < b.date ? 1 : -1; });

    if (list.length === 0) {
      feed.innerHTML = '<div class="ios6-paper-card" style="text-align:center;"><h3 style="margin-top:0;">Вех пока нет</h3><p style="font-size:12px; color:#666;">Нажмите "+ Новая" чтобы отметить важное событие.</p></div>';
      return;
    }

    for (var j = 0; j < list.length; j++) {
      var item = list[j];
      var card = document.createElement("div");
      card.className = "ios6-paper-card";
      card.style.cursor = "pointer";
      
      var dP = (item.date || getTodayISO()).split("-");
      var img = getPhotoSource(item.imageUri);
      var thumbHtml = img ? '<div style="float:right; width:50px; height:50px; border-radius:4px; overflow:hidden; border:1px solid #ccc; margin-left:10px;"><img src="' + img + '" style="width:100%;height:100%;object-fit:cover;"></div>' : '';

      card.innerHTML = '<div style="float:left; width:45px; text-align:center; border-right:1px dotted #ccc; margin-right:10px; padding-right:5px;"><span style="display:block; font-size:18px; font-weight:900; border-bottom:2px solid #e8451e; margin-bottom:2px;">' + dP[2] + '</span><span style="font-size:9px; color:#888;">' + (MONTHS_RU_UPPER[parseInt(dP[1],10)-1]||"").substring(0,3) + '</span></div>' +
                       thumbHtml + '<div style="overflow:hidden;"><span style="display:inline-block; font-size:8px; font-weight:bold; color:#fff; background:#d94e28; padding:2px 4px; border-radius:3px; margin-bottom:4px;">' + escapeHtml(item.category || "ЖИЗНЬ") + '</span>' +
                       '<div style="font-size:14px; font-weight:bold; color:#222;">' + escapeHtml(item.title || item.text) + '</div></div>';
      
      (function(evObj) { card.onclick = function() { openEventModal(evObj); }; })(item);
      feed.appendChild(card);
    }
  }

  // ==========================================================================
  // 4. LAST.FM (JSONP) И ITUNES
  // ==========================================================================
  function fetchLastFmJSONP() {
    var user = document.getElementById("setting-lastfm-user").value.trim() || appData.settings.lastfm_user;
    if (!user) { showHud("Укажите ник Last.fm в Настройках"); return; }
    
    showHud("Поиск на Last.fm...");
    var dateVal = document.getElementById("memory-date-input").value || getTodayISO();
    var p = dateVal.split("-");
    var fromTs = Math.floor(new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 0, 0, 0).getTime() / 1000);
    var toTs = Math.floor(new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 23, 59, 59).getTime() / 1000);

    var cbName = "lastfm_cb_" + new Date().getTime();
    window[cbName] = function(res) {
      try { delete window[cbName]; } catch(e){}
      var list = res && res.recenttracks && res.recenttracks.track;
      if (!list) { showHud("Скробблов за день нет"); return; }
      if (!(list instanceof Array)) list = [list];

      var counts = {}, best = null, max = 0;
      for (var i = 0; i < list.length; i++) {
        var tr = list[i];
        if (tr["@attr"] && tr["@attr"].nowplaying === "true") continue;
        var t = (tr.name || "").trim(), a = (tr.artist && (tr.artist["#text"] || tr.artist.name) || "").trim();
        if (!t) continue;
        var cov = (tr.image && tr.image.length) ? tr.image[tr.image.length - 1]["#text"] : "";
        var k = a.toLowerCase() + "|" + t.toLowerCase();
        
        if (!counts[k]) counts[k] = { a: a, t: t, plays: 0, c: cov };
        counts[k].plays++;
        if (counts[k].plays > max) { max = counts[k].plays; best = counts[k]; }
      }

      if (!best) { showHud("Скробблов не найдено"); return; }

      document.getElementById("memory-song-title").value = best.t;
      document.getElementById("memory-song-artist").value = best.a;
      document.getElementById("memory-song-plays").value = "" + best.plays;
      document.getElementById("memory-song-cover").value = best.c || "";

      document.getElementById("memory-lastfm-preview").innerHTML = '<div style="font-weight:bold;color:#d94e28">ТОП-ТРЕК (↻ ' + best.plays + ')</div><div style="font-size:12px;color:#222;margin-top:2px;">' + escapeHtml(best.a + " — " + best.t) + '</div>';
      showHud("Трек добавлен!");
    };

    var url = "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=" + encodeURIComponent(user) + "&api_key=b25b959554ed76058ac220b0b2e13d21&from=" + fromTs + "&to=" + toTs + "&limit=200&format=json&callback=" + cbName;
    var script = document.createElement("script"); script.src = url; document.body.appendChild(script);
  }

  function renderLastFmWidget(song, containerId) {
    var box = document.getElementById(containerId);
    if (!box) return;
    if (!song || (!song.title && !song.artist)) { addClass(box, "hidden"); return; }
    removeClass(box, "hidden");

    var covHtml = song.cover ? '<img src="' + song.cover + '" style="width:100%;height:100%;object-fit:cover">' : '<div style="line-height:38px;text-align:center;color:#ff6b3b;">&#9835;</div>';
    box.innerHTML = '<div class="lf-cover">' + covHtml + '</div>' +
                    '<div class="lf-info"><span class="lf-badge">САУНДТРЕК ДНЯ' + (song.plays ? ' • ↻ ' + song.plays : '') + '</span>' +
                    '<span class="lf-title">' + escapeHtml(song.title) + '</span><span class="lf-artist">' + escapeHtml(song.artist) + '</span></div>' +
                    '<div class="lf-play-btn" id="' + containerId + '_play">&#9654;</div>';

    var pBtn = document.getElementById(containerId + "_play");
    if (pBtn) {
      pBtn.onclick = function(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        playItunesPreview(song, pBtn);
      };
    }
  }

  function playItunesPreview(song, btn) {
    var audio = document.getElementById("lastfm-audio-preview");
    if (!audio.paused && audio.getAttribute("data-key") === song.title) {
      audio.pause(); btn.innerHTML = "&#9654;"; return;
    }
    audio.play(); // Разблокируем аудио-контекст на iOS 6 по клику пользователя
    btn.innerHTML = "&#8987;";
    
    var cbName = "itunes_cb_" + new Date().getTime();
    window[cbName] = function(res) {
      try { delete window[cbName]; } catch(e){}
      if (res && res.results && res.results.length > 0 && res.results[0].previewUrl) {
        audio.src = res.results[0].previewUrl; audio.setAttribute("data-key", song.title);
        audio.play(); btn.innerHTML = "&#9632;";
        audio.onended = function() { btn.innerHTML = "&#9654;"; };
      } else { btn.innerHTML = "&#9654;"; showHud("Превью не найдено"); }
    };
    var query = encodeURIComponent(song.artist + " " + song.title);
    var script = document.createElement("script"); script.src = "https://itunes.apple.com/search?term=" + query + "&media=music&limit=1&callback=" + cbName; document.body.appendChild(script);
  }

  function stopAudio() { var audio = document.getElementById("lastfm-audio-preview"); if (audio && !audio.paused) audio.pause(); }

  function splitTextAndSong(text, memObj) {
    text = text || "";
    var m = "🎵 Саундтрек дня:";
    var idx = text.indexOf(m);
    var song = (memObj && memObj.lastfm) ? memObj.lastfm : null;
    if (idx !== -1) {
      var line = text.substring(idx + m.length).trim();
      text = text.substring(0, idx).trim();
      if (!song) {
        var pl = line.match(/\(прослушано:\s*(\d+)\s*раз\)/i);
        var clean = line.replace(/\s*\(прослушано:\s*\d+\s*раз\)/i, "");
        var pts = clean.split(" — ");
        song = { artist: pts[0] || "Last.fm", title: pts.slice(1).join(" — ") || clean, plays: pl ? pl[1] : "", cover: "" };
      }
    }
    return { cleanText: text, song: song };
  }

  // ==========================================================================
  // 5. МОДАЛЬНЫЕ ОКНА И СОХРАНЕНИЕ
  // ==========================================================================
  function openMemoryModal(memObj, presetDate) {
    removeClass(document.getElementById("modal-memory"), "hidden");
    
    var idF = document.getElementById("memory-edit-id"), dtF = document.getElementById("memory-date-input");
    var txtF = document.getElementById("memory-text-input"), tF = document.getElementById("memory-song-title");
    var aF = document.getElementById("memory-song-artist"), pF = document.getElementById("memory-song-plays"), cF = document.getElementById("memory-song-cover");
    
    if (memObj) {
      idF.value = memObj.id; dtF.value = memObj.date; selectedMood = memObj.mood || "positive";
      var parsed = splitTextAndSong(memObj.text, memObj);
      txtF.value = parsed.cleanText;
      if (parsed.song) {
        tF.value = parsed.song.title || ""; aF.value = parsed.song.artist || "";
        pF.value = parsed.song.plays || ""; cF.value = parsed.song.cover || "";
        document.getElementById("memory-lastfm-preview").innerHTML = '<div style="font-weight:bold;color:#d94e28">ТОП-ТРЕК</div><div style="font-size:12px;color:#222;margin-top:2px;">' + escapeHtml(parsed.song.artist + " — " + parsed.song.title) + '</div>';
      }
      
      currentMemoryPhotoName = memObj.imageUri || "";
      currentMemoryPhotoData = getPhotoSource(memObj.imageUri);
      if (currentMemoryPhotoData) {
        document.getElementById("memory-photo-preview").src = currentMemoryPhotoData;
        removeClass(document.getElementById("memory-photo-preview"), "hidden");
        removeClass(document.getElementById("btn-remove-photo"), "hidden");
      }
      removeClass(document.getElementById("memory-delete-wrap"), "hidden");
    } else {
      idF.value = ""; dtF.value = presetDate || getTodayISO(); txtF.value = ""; selectedMood = "positive";
      tF.value = ""; aF.value = ""; pF.value = ""; cF.value = "";
      document.getElementById("memory-lastfm-preview").innerText = "Трек не выбран";
      currentMemoryPhotoData = ""; currentMemoryPhotoName = "";
      addClass(document.getElementById("memory-photo-preview"), "hidden");
      addClass(document.getElementById("btn-remove-photo"), "hidden");
      addClass(document.getElementById("memory-delete-wrap"), "hidden");
    }
    
    var btns = document.querySelectorAll(".mood-btn");
    for (var i = 0; i < btns.length; i++) btns[i].className = (btns[i].getAttribute("data-mood") === selectedMood) ? "mood-btn active" : "mood-btn";
  }

  function saveMemoryRecord() {
    var id = document.getElementById("memory-edit-id").value;
    var dt = document.getElementById("memory-date-input").value || getTodayISO();
    var txt = document.getElementById("memory-text-input").value.trim();
    var st = document.getElementById("memory-song-title").value.trim();
    var sa = document.getElementById("memory-song-artist").value.trim();
    
    if (!txt && !currentMemoryPhotoData && !st) { showHud("Запись пуста!"); return; }
    
    var finTxt = txt;
    var lfMeta = null;
    if (st || sa) {
      var pl = document.getElementById("memory-song-plays").value;
      finTxt = txt + (txt ? "\n\n" : "") + "🎵 Саундтрек дня: " + (sa || "Неизвестен") + " — " + (st || "Трек") + (pl ? " (прослушано: " + pl + " раз)" : "");
      lfMeta = { title: st, artist: sa, plays: pl, cover: document.getElementById("memory-song-cover").value };
    }

    if (currentMemoryPhotoData) {
      if (!currentMemoryPhotoName) currentMemoryPhotoName = "img_" + new Date().getTime() + ".jpg";
      savePhotoToOfflineDB(currentMemoryPhotoName, currentMemoryPhotoData);
    }
    
    var now = new Date().toISOString();
    if (id) {
      for (var i = 0; i < appData.memories.length; i++) {
        if (appData.memories[i].id === id) {
          appData.memories[i].date = dt; appData.memories[i].text = finTxt;
          appData.memories[i].mood = selectedMood; appData.memories[i].imageUri = currentMemoryPhotoName;
          appData.memories[i].lastfm = lfMeta; appData.memories[i].updated_at = now; break;
        }
      }
    } else {
      appData.memories.push({ id: makeUUID(), text: finTxt, mood: selectedMood, date: dt, imageUri: currentMemoryPhotoName, lastfm: lfMeta, created_at: now, updated_at: now });
    }
    
    saveAppState(); addClass(document.getElementById("modal-memory"), "hidden"); renderAll(); showHud("Сохранено!");
  }

  function openEventModal(evObj) {
    removeClass(document.getElementById("modal-event"), "hidden");
    var idF = document.getElementById("event-edit-id"), tF = document.getElementById("event-title-input"), cF = document.getElementById("event-category-select"), dF = document.getElementById("event-date-input");
    if (evObj) {
      idF.value = evObj.id; tF.value = evObj.title || evObj.text || ""; cF.value = evObj.category || "ЖИЗНЬ"; dF.value = evObj.date || getTodayISO();
      currentEventPhotoName = evObj.imageUri || ""; currentEventPhotoData = getPhotoSource(evObj.imageUri);
      if (currentEventPhotoData) { document.getElementById("event-photo-preview").src = currentEventPhotoData; removeClass(document.getElementById("event-photo-preview"), "hidden"); }
      removeClass(document.getElementById("event-delete-wrap"), "hidden");
    } else {
      idF.value = ""; tF.value = ""; cF.value = "ЖИЗНЬ"; dF.value = getTodayISO(); currentEventPhotoData = ""; currentEventPhotoName = "";
      addClass(document.getElementById("event-photo-preview"), "hidden"); addClass(document.getElementById("event-delete-wrap"), "hidden");
    }
  }

  function saveEventRecord() {
    var id = document.getElementById("event-edit-id").value, t = document.getElementById("event-title-input").value.trim(), c = document.getElementById("event-category-select").value, d = document.getElementById("event-date-input").value || getTodayISO();
    if (!t) { showHud("Напишите название"); return; }
    if (currentEventPhotoData) { if (!currentEventPhotoName) currentEventPhotoName = "ev_" + new Date().getTime() + ".jpg"; savePhotoToOfflineDB(currentEventPhotoName, currentEventPhotoData); }
    var now = new Date().toISOString();
    if (id) {
      for (var i = 0; i < appData.events.length; i++) {
        if (appData.events[i].id === id) { appData.events[i].title = t; appData.events[i].text = t; appData.events[i].category = c; appData.events[i].date = d; appData.events[i].imageUri = currentEventPhotoName; appData.events[i].updated_at = now; break; }
      }
    } else { appData.events.push({ id: makeUUID(), title: t, text: t, category: c, date: d, imageUri: currentEventPhotoName, created_at: now, updated_at: now }); }
    saveAppState(); addClass(document.getElementById("modal-event"), "hidden"); renderAll(); showHud("Веха сохранена!");
  }

  function openReaderModal(m) {
    removeClass(document.getElementById("modal-reader"), "hidden");
    document.getElementById("reader-full-date").innerText = formatDateRussian(m.date);
    document.getElementById("reader-mood-badge").innerText = getMoodTitle(m.mood);
    var img = getPhotoSource(m.imageUri);
    if (img) { document.getElementById("reader-photo-img").src = img; removeClass(document.getElementById("reader-photo-wrap"), "hidden"); }
    else { addClass(document.getElementById("reader-photo-wrap"), "hidden"); }
    var p = splitTextAndSong(m.text, m);
    document.getElementById("reader-text-body").innerText = p.cleanText;
    renderLastFmWidget(p.song, "reader-lastfm-box");
    document.getElementById("btn-reader-edit").onclick = function() { stopAudio(); addClass(document.getElementById("modal-reader"), "hidden"); openMemoryModal(m); };
  }

  // ==========================================================================
  // 6. БЭКАПЫ (.ZIP / JSON) И РАБОТА С БАЙТАМИ В ES5
  // ==========================================================================
  function exportWhengramZip() {
    showHud("Подготовка архива...");
    setTimeout(function() {
      try {
        var cleanMemories = [];
        var zipEntries = [];
        
        for (var i = 0; i < appData.memories.length; i++) {
          var m = appData.memories[i];
          var fn = m.imageUri ? m.imageUri.replace(/^photos\//, "") : "";
          cleanMemories.push({ id: m.id, text: m.text, mood: m.mood || "positive", date: m.date, imageUri: fn || undefined, lastfm: m.lastfm, created_at: m.created_at, updated_at: m.updated_at });
          
          if (fn) {
            var b64 = getPhotoSource(m.imageUri);
            if (b64 && b64.indexOf("base64,") !== -1) zipEntries.push({ name: "photos/" + fn, data: base64ToBytes(b64.split("base64,")[1]) });
          }
        }
        
        var mObj = { version: "2.0", exported_at: new Date().toISOString(), memories: cleanMemories, events: appData.events || [], profile: appData.profile, settings: { theme: "system" } };
        zipEntries.push({ name: "manifest.json", data: utf8StringToBytes(JSON.stringify(mObj)) });
        
        var zipBin = createStoredZip(zipEntries);
        var blob = new Blob([zipBin], { type: "application/zip" });
        var url = (window.URL || window.webkitURL).createObjectURL(blob);
        var a = document.createElement("a"); a.href = url; a.download = "whengram-backup-" + getTodayISO() + ".zip";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        showHud("Бэкап .ZIP скачан!");
      } catch (e) { showHud("Ошибка создания архива"); }
    }, 100);
  }

  function importWhengramZip(file) {
    if (!file) return;
    if (file.name.toLowerCase().indexOf(".json") !== -1) {
      var r = new FileReader();
      r.onload = function(e) { try { applyManifest(JSON.parse(e.target.result)); showHud("JSON загружен!"); } catch(err){ showHud("Ошибка чтения JSON"); } };
      r.readAsText(file); return;
    }
    var reader = new FileReader();
    reader.onload = function(evt) {
      try {
        var bytes = new Uint8Array(evt.target.result);
        var entries = parseZip(bytes);
        var foundManifest = null;
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].name.indexOf("photos/") === 0 && entries[i].data.length > 0) {
            savePhotoToOfflineDB(entries[i].name.replace(/^photos\//, ""), "data:image/jpeg;base64," + bytesToBase64(entries[i].data));
          } else if (entries[i].name.indexOf("manifest.json") !== -1) {
            foundManifest = JSON.parse(bytesToUtf8String(entries[i].data));
          }
        }
        if (foundManifest) { applyManifest(foundManifest); showHud("ZIP успешно загружен!"); }
        else { showHud("manifest.json не найден"); }
      } catch (err) { showHud("Ошибка чтения ZIP"); }
    };
    reader.readAsArrayBuffer(file);
  }

  function applyManifest(parsed) {
    if (!parsed || !parsed.memories) return;
    appData.memories = parsed.memories; appData.events = parsed.events || [];
    if (parsed.profile && parsed.profile.name) appData.profile.name = parsed.profile.name;
    saveAppState(); renderAll();
  }

  // Функции для создания и чтения ZIP-файлов (метод STORED = 0)
  var crcTable = null;
  function makeCrcTable() { crcTable = []; for (var n=0; n<256; n++) { var c=n; for(var k=0;k<8;k++) c = (c&1)?(0xEDB88320^(c>>>1)):(c>>>1); crcTable[n]=c; } }
  function crc32(b) { if(!crcTable) makeCrcTable(); var crc = 0^(-1); for(var i=0;i<b.length;i++) crc=(crc>>>8)^crcTable[(crc^b[i])&0xFF]; return (crc^(-1))>>>0; }
  
  function createStoredZip(files) {
    var lParts = [], cParts = [], offset = 0;
    for (var i=0; i<files.length; i++) {
      var nB = utf8StringToBytes(files[i].name), dB = files[i].data, crc = crc32(dB), len = dB.length;
      var lH = new Uint8Array(30 + nB.length);
      w32(lH, 0, 0x04034b50); w16(lH, 4, 20); w16(lH, 6, 0x0800); w16(lH, 8, 0); w16(lH, 10, 0); w16(lH, 12, 0);
      w32(lH, 14, crc); w32(lH, 18, len); w32(lH, 22, len); w16(lH, 26, nB.length); w16(lH, 28, 0); lH.set(nB, 30);
      lParts.push(lH); lParts.push(dB);
      
      var cH = new Uint8Array(46 + nB.length);
      w32(cH, 0, 0x02014b50); w16(cH, 4, 20); w16(cH, 6, 20); w16(cH, 8, 0x0800); w16(cH, 10, 0); w16(cH, 12, 0); w16(cH, 14, 0);
      w32(cH, 16, crc); w32(cH, 20, len); w32(cH, 24, len); w16(cH, 28, nB.length); w16(cH, 30, 0); w16(cH, 32, 0); w16(cH, 34, 0); w16(cH, 36, 0); w32(cH, 38, 0); w32(cH, 42, offset); cH.set(nB, 46);
      cParts.push(cH); offset += lH.length + len;
    }
    var cSize = 0; for(var c=0; c<cParts.length; c++) cSize += cParts[c].length;
    var eocd = new Uint8Array(22);
    w32(eocd, 0, 0x06054b50); w16(eocd, 4, 0); w16(eocd, 6, 0); w16(eocd, 8, files.length); w16(eocd, 10, files.length); w32(eocd, 12, cSize); w32(eocd, 16, offset); w16(eocd, 20, 0);
    var out = new Uint8Array(offset + cSize + 22), pos = 0;
    for(var lp=0; lp<lParts.length; lp++) { out.set(lParts[lp], pos); pos += lParts[lp].length; }
    for(var cp=0; cp<cParts.length; cp++) { out.set(cParts[cp], pos); pos += cParts[cp].length; }
    out.set(eocd, pos); return out;
  }
  
  function parseZip(b) {
    var res = [], ep = -1;
    for (var i = b.length-22; i>=0; i--) { if (r32(b, i) === 0x06054b50) { ep = i; break; } }
    if (ep === -1) return res;
    var tE = r16(b, ep+10), ptr = r32(b, ep+16);
    for (var e = 0; e < tE; e++) {
      if (r32(b, ptr) !== 0x02014b50) break;
      var meth = r16(b, ptr+10), cSize = r32(b, ptr+20), nLen = r16(b, ptr+28), exLen = r16(b, ptr+30), comLen = r16(b, ptr+32), lOff = r32(b, ptr+42);
      var nB = b.subarray(ptr+46, ptr+46+nLen), fName = bytesToUtf8String(nB);
      var lNLen = r16(b, lOff+26), lExLen = r16(b, lOff+28), dStart = lOff+30+lNLen+lExLen;
      if (meth === 0 && cSize > 0) res.push({ name: fName, data: b.subarray(dStart, dStart+cSize) });
      ptr += 46 + nLen + exLen + comLen;
    }
    return res;
  }
  
  function w16(b,p,v) { b[p]=v&0xFF; b[p+1]=(v>>>8)&0xFF; }
  function w32(b,p,v) { b[p]=v&0xFF; b[p+1]=(v>>>8)&0xFF; b[p+2]=(v>>>16)&0xFF; b[p+3]=(v>>>24)&0xFF; }
  function r16(b,p) { return b[p]|(b[p+1]<<8); }
  function r32(b,p) { return (b[p]|(b[p+1]<<8)|(b[p+2]<<16)|(b[p+3]<<24))>>>0; }

  // Утилиты строк, байтов и дат
  function utf8StringToBytes(s) { var u=unescape(encodeURIComponent(s)), a=new Uint8Array(u.length); for(var i=0;i<u.length;i++) a[i]=u.charCodeAt(i); return a; }
  function bytesToUtf8String(b) { var s=""; for(var i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); try{return decodeURIComponent(escape(s));}catch(e){return s;} }
  function base64ToBytes(b64) { var bin=window.atob(b64), arr=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i); return arr; }
  function bytesToBase64(b) { var bin=""; for(var i=0;i<b.length;i++) bin+=String.fromCharCode(b[i]); return window.btoa(bin); }
  
  function getTodayISO() { var d=new Date(); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function dateToISO(d) { return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function pad(n) { return n<10?"0"+n:n; }
  function getDayOfYear(iso) { var p=iso.split("-"); return Math.floor((new Date(p[0],p[1]-1,p[2])-new Date(p[0],0,0))/864e5); }
  function formatDateRussian(iso) { if(!iso)return"";var p=iso.split("-"); return parseInt(p[2],10)+" "+(MONTHS_RU_UPPER[parseInt(p[1],10)-1]||p[1])+" "+p[0]+" Г."; }
  function getWeekdayShort(iso) { var p=iso.split("-"); return DAYS_SHORT[new Date(p[0],p[1]-1,p[2]).getDay()]||""; }
  function getWeekdayFull(iso) { var p=iso.split("-"); return ["ВОСКРЕСЕНЬЕ","ПОНЕДЕЛЬНИК","ВТОРНИК","СРЕДА","ЧЕТВЕРГ","ПЯТНИЦА","СУББОТА"][new Date(p[0],p[1]-1,p[2]).getDay()]; }
  function formatTime(iso) { if(!iso)return"21:00"; var d=new Date(iso); if(isNaN(d.getTime()))return"21:00"; return pad(d.getHours())+":"+pad(d.getMinutes()); }
  function getMoodTitle(m) { return m==="neutral"?"РОВНО":(m==="negative"?"ТЯЖЕЛО":"ХОРОШО"); }
  function escapeHtml(s) { return (""+s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function addClass(e,c) { if(e&&e.className.indexOf(c)===-1) e.className=(e.className+" "+c).trim(); }
  function removeClass(e,c) { if(e) e.className=e.className.replace(new RegExp("(\\s|^)"+c+"(\\s|$)","g")," ").trim(); }
  function makeUUID() { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==="x"?r:(r&0x3|0x8)).toString(16);}); }
})();
