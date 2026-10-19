/* ==========================================================================
   WHENGRAM — TRUE iOS 6.1.3 ENGINE (ES5, WebSQL, Native ZIP, Last.fm + iTunes)
   ========================================================================== */

(function() {
  var STORAGE_KEY = "whengram_ios6_pro_v3";

  // Стартовые данные из твоего оригинального бэкапа (18 октября 2026)
  var defaultManifest = {
    "version": "2.0",
    "exported_at": "2026-10-19T16:46:32.369Z",
    "memories": [
      {
        "id": "ee1b9527-b962-4d63-b99e-f8a1510fd2ec",
        "text": "ой да в пизду((((((\n\nблч такой уебский день с...",
        "mood": "negative",
        "date": "2026-10-18",
        "imageUri": "whengram_1792357823320_4.jpg",
        "created_at": "2026-10-18T21:10:36.492Z",
        "updated_at": "2026-10-18T21:10:36.492Z"
      }
    ],
    "events": [],
    "profile": {
      "name": "Илюша",
      "reminder_time": "21:00",
      "created_at": "2026-10-18T15:35:23.827Z",
      "setup_complete": true
    },
    "settings": {
      "theme": "cream",
      "lastfm_user": "",
      "lastfm_key": "b25b959554ed76058ac220b0b2e13d21"
    }
  };

  var appData = null;
  var photoCache = {}; // imageUri -> data:image/jpeg;base64,...
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
  var MONTHS_RU_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  var MONTHS_RU_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  var DAYS_SHORT = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
  var DAYS_FULL = ["ВОСКРЕСЕНЬЕ", "ПОНЕДЕЛЬНИК", "ВТОРНИК", "СРЕДА", "ЧЕТВЕРГ", "ПЯТНИЦА", "СУББОТА"];

  // ==========================================================================
  // 1. ИНИЦИАЛИЗАЦИЯ И ОФФЛАЙН-БАЗА WEBSQL ДЛЯ iOS 6.1.3
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
        webSqlDb = window.openDatabase("WhengramIOS6DB", "1.0", "Whengram Offline Photos", 45 * 1024 * 1024);
        webSqlDb.transaction(function(tx) {
          tx.executeSql("CREATE TABLE IF NOT EXISTS photos (uri TEXT PRIMARY KEY, data TEXT)");
          tx.executeSql("SELECT uri, data FROM photos", [], function(tx2, results) {
            var len = results.rows.length;
            for (var i = 0; i < len; i++) {
              var row = results.rows.item(i);
              photoCache[row.uri] = row.data;
            }
            callback();
          }, function() { callback(); });
        });
      } else {
        callback();
      }
    } catch (e) {
      callback();
    }
  }

  function savePhotoToOfflineDB(uri, base64Data) {
    if (!uri || !base64Data) return;
    photoCache[uri] = base64Data;
    if (webSqlDb) {
      try {
        webSqlDb.transaction(function(tx) {
          tx.executeSql("INSERT OR REPLACE INTO photos (uri, data) VALUES (?, ?)", [uri, base64Data]);
        });
      } catch (e) {}
    } else {
      try {
        localStorage.setItem("wg_img_" + uri, base64Data);
      } catch (e2) {}
    }
  }

  function getPhotoSource(uri) {
    if (!uri) return "";
    if (uri.indexOf("data:image") === 0) return uri;
    var cleanName = uri.replace(/^photos\//, "");
    if (photoCache[cleanName]) return photoCache[cleanName];
    if (photoCache[uri]) return photoCache[uri];
    try {
      var fromLs = localStorage.getItem("wg_img_" + cleanName);
      if (fromLs) return fromLs;
    } catch (e) {}
    return "";
  }

  function loadAppState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        appData = JSON.parse(raw);
      } else {
        appData = defaultManifest;
        saveAppState();
      }
    } catch (e) {
      appData = defaultManifest;
    }

    if (!appData.version) appData.version = "2.0";
    if (!appData.memories) appData.memories = [];
    if (!appData.events) appData.events = [];
    if (!appData.profile) appData.profile = { name: "Илюша", reminder_time: "21:00", setup_complete: true };
    if (!appData.settings) appData.settings = { theme: "cream", lastfm_user: "", lastfm_key: "b25b959554ed76058ac220b0b2e13d21" };
    if (!appData.settings.lastfm_key) appData.settings.lastfm_key = "b25b959554ed76058ac220b0b2e13d21";
  }

  function saveAppState() {
    try {
      appData.exported_at = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {
      showHud("Память хранилища заполнена");
    }
  }

  // Мгновенный отклик кнопок без задержки 300мс на iOS 6
  function bindTouchFeedback() {
    document.addEventListener("touchstart", function(e) {
      var t = e.target;
      while (t && t !== document.body) {
        if (t.tagName === "BUTTON" || t.tagName === "LABEL") {
          if (t.className.indexOf("touched") === -1) {
            t.className += " touched";
          }
          break;
        }
        t = t.parentNode;
      }
    }, false);

    document.addEventListener("touchend", function() {
      var touchedEls = document.querySelectorAll(".touched");
      for (var i = 0; i < touchedEls.length; i++) {
        touchedEls[i].className = touchedEls[i].className.replace(/\s*touched/g, "");
      }
    }, false);
  }

  // ==========================================================================
  // 2. ПРИВЯЗКА ВСЕХ КНОПОК И ПЕРЕКЛЮЧАТЕЛЕЙ
  // ==========================================================================
  function initEventListeners() {
    // Нижний таб-бар (.tab-btn)
    var tabs = document.querySelectorAll(".tab-btn");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].onclick = function() {
        switchTab(this.getAttribute("data-tab"));
      };
    }

    // Кнопка в верхнем баре (+ Новое / + Новая)
    document.getElementById("navbar-action-btn").onclick = function() {
      if (currentTab === "events") {
        openEventModal(null);
      } else {
        openMemoryModal(null);
      }
    };

    document.getElementById("btn-write-today").onclick = function() {
      openMemoryModal(null, getTodayISO());
    };

    // Переключатель темы (Кремовая бумага / Тёмный лён)
    var themeToggle = document.getElementById("toggle-cream-theme");
    applyThemeUI();
    themeToggle.onclick = function() {
      if (appData.settings.theme === "dark") {
        appData.settings.theme = "cream";
      } else {
        appData.settings.theme = "dark";
      }
      applyThemeUI();
      saveAppState();
    };

    // Переключатель Хроника / Книжная полка iBooks
    document.getElementById("view-btn-list").onclick = function() {
      this.className = "seg-pill active";
      document.getElementById("view-btn-shelf").className = "seg-pill";
      removeClass(document.getElementById("memories-list-container"), "hidden");
      addClass(document.getElementById("whenshelf-container"), "hidden");
    };

    document.getElementById("view-btn-shelf").onclick = function() {
      this.className = "seg-pill active";
      document.getElementById("view-btn-list").className = "seg-pill";
      addClass(document.getElementById("memories-list-container"), "hidden");
      removeClass(document.getElementById("whenshelf-container"), "hidden");
      renderWoodenShelf();
    };

    document.getElementById("bottom-whenshelf-teaser").onclick = function() {
      document.getElementById("view-btn-shelf").click();
      document.getElementById("main-scroll").scrollTop = 0;
    };

    // Полка: Годы / Месяцы
    document.getElementById("shelf-by-year").onclick = function() {
      shelfMode = "year";
      this.className = "crown-btn active";
      document.getElementById("shelf-by-month").className = "crown-btn";
      renderWoodenShelf();
    };

    document.getElementById("shelf-by-month").onclick = function() {
      shelfMode = "month";
      this.className = "crown-btn active";
      document.getElementById("shelf-by-year").className = "crown-btn";
      renderWoodenShelf();
    };

    document.getElementById("btn-reset-shelf-filter").onclick = function() {
      activeShelfFilter = null;
      addClass(document.getElementById("shelf-active-filter-bar"), "hidden");
      renderMemoriesFeed();
    };

    // Кнопки выбора настроения (.mood-pad)
    var moodPads = document.querySelectorAll(".mood-pad");
    for (var m = 0; m < moodPads.length; m++) {
      moodPads[m].onclick = function() {
        for (var k = 0; k < moodPads.length; k++) {
          moodPads[k].className = "mood-pad";
        }
        this.className = "mood-pad active";
        selectedMood = this.getAttribute("data-mood");
      };
    }

    // Закрытие и сохранение модалки Воспоминания
    document.getElementById("btn-close-memory-modal").onclick = function() {
      addClass(document.getElementById("modal-memory"), "hidden");
    };
    document.getElementById("btn-save-memory").onclick = function() {
      saveMemoryRecord();
    };
    document.getElementById("btn-delete-memory").onclick = function() {
      var id = document.getElementById("memory-edit-id").value;
      if (id && confirm("Удалить это воспоминание из капсулы?")) {
        deleteMemoryById(id);
        addClass(document.getElementById("modal-memory"), "hidden");
        renderAll();
        showHud("Запись удалена");
      }
    };

    // Загрузка фото в воспоминание
    document.getElementById("memory-photo-input").onchange = function(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      compressPhotoForRetina(file, function(base64) {
        currentMemoryPhotoData = base64;
        currentMemoryPhotoName = "whengram_" + (new Date().getTime()) + "_" + Math.floor(Math.random() * 10) + ".jpg";
        document.getElementById("memory-photo-preview").src = base64;
        removeClass(document.getElementById("memory-photo-preview-wrap"), "hidden");
        removeClass(document.getElementById("btn-remove-photo"), "hidden");
      });
    };

    document.getElementById("btn-remove-photo").onclick = function() {
      currentMemoryPhotoData = "";
      currentMemoryPhotoName = "";
      document.getElementById("memory-photo-preview").src = "";
      addClass(document.getElementById("memory-photo-preview-wrap"), "hidden");
      addClass(this, "hidden");
    };

    // Кнопка Last.fm
    document.getElementById("btn-fetch-lastfm").onclick = function() {
      fetchTopSongFromLastFm();
    };

    // Модалка Вехи (Events)
    document.getElementById("btn-close-event-modal").onclick = function() {
      addClass(document.getElementById("modal-event"), "hidden");
    };
    document.getElementById("btn-save-event").onclick = function() {
      saveEventRecord();
    };
    document.getElementById("btn-delete-event").onclick = function() {
      var id = document.getElementById("event-edit-id").value;
      if (id && confirm("Удалить эту веху?")) {
        deleteEventById(id);
        addClass(document.getElementById("modal-event"), "hidden");
        renderAll();
        showHud("Веха удалена");
      }
    };
    document.getElementById("event-photo-input").onchange = function(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      compressPhotoForRetina(file, function(base64) {
        currentEventPhotoData = base64;
        currentEventPhotoName = "whengram_ev_" + (new Date().getTime()) + ".jpg";
        document.getElementById("event-photo-preview").src = base64;
        removeClass(document.getElementById("event-photo-preview-wrap"), "hidden");
      });
    };

    // Модалка чтения
    document.getElementById("btn-close-reader").onclick = function() {
      stopAudioPreview();
      addClass(document.getElementById("modal-reader"), "hidden");
    };

    // Поиск и фильтры
    document.getElementById("memories-search-input").oninput = function() {
      renderMemoriesFeed();
    };
    document.getElementById("memories-mood-filter").onchange = function() {
      renderMemoriesFeed();
    };
    document.getElementById("events-search-input").oninput = function() {
      renderEventsFeed();
    };

    // Настройки профиля и Last.fm
    document.getElementById("btn-save-settings").onclick = function() {
      appData.profile.name = document.getElementById("setting-profile-name").value.trim() || "Илюша";
      appData.profile.reminder_time = document.getElementById("setting-reminder-time").value.trim() || "21:00";
      appData.settings.lastfm_user = document.getElementById("setting-lastfm-user").value.trim();
      var customKey = document.getElementById("setting-lastfm-key").value.trim();
      if (customKey) appData.settings.lastfm_key = customKey;
      saveAppState();
      renderAll();
      showHud("Настройки сохранены");
    };

    // Экспорт и Импорт .ZIP / JSON
    document.getElementById("btn-export-zip").onclick = function() {
      exportWhengramZipBackup();
    };

    document.getElementById("input-import-zip").onchange = function(e) {
      var file = e.target.files && e.target.files[0];
      if (file) {
        importWhengramBackupFile(file);
      }
    };

    document.getElementById("btn-copy-manifest").onclick = function() {
      var area = document.getElementById("backup-json-textarea");
      area.value = JSON.stringify(buildCleanManifestForExport(), null, 2);
      area.focus();
      area.select();
      showHud("manifest.json готов к копированию");
    };

    document.getElementById("btn-import-manifest-text").onclick = function() {
      var raw = document.getElementById("backup-json-textarea").value.trim();
      if (!raw) {
        showHud("Поле пустое");
        return;
      }
      try {
        var parsed = JSON.parse(raw);
        applyImportedManifest(parsed);
        showHud("Бэкап успешно импортирован!");
      } catch (err) {
        showHud("Ошибка в формате JSON");
      }
    };
  }

  function applyThemeUI() {
    var sw = document.getElementById("toggle-cream-theme");
    if (appData.settings.theme === "dark") {
      document.body.className = "theme-dark";
      sw.className = "ios6-toggle-switch";
    } else {
      document.body.className = "theme-cream";
      sw.className = "ios6-toggle-switch active";
    }
  }

  function switchTab(tabName) {
    currentTab = tabName;
    var views = document.querySelectorAll(".tab-view");
    for (var i = 0; i < views.length; i++) {
      views[i].className = "tab-view";
    }
    var target = document.getElementById("tab-" + tabName);
    if (target) target.className = "tab-view active";

    var btns = document.querySelectorAll(".tab-btn");
    for (var j = 0; j < btns.length; j++) {
      if (btns[j].getAttribute("data-tab") === tabName) {
        btns[j].className = "tab-btn active";
      } else {
        btns[j].className = "tab-btn";
      }
    }

    // Меняем заголовок и кнопку в кожаном баре под текущую вкладку
    var navTitle = document.getElementById("navbar-title");
    var navSub = document.getElementById("navbar-subtitle");
    var actionBtn = document.getElementById("navbar-action-btn");

    if (tabName === "home") {
      navTitle.innerHTML = 'WHENGRAM<span class="accent-dot">.</span>';
      navSub.innerText = "PERSONAL TIME CAPSULE";
      actionBtn.innerHTML = '<span class="plus-glyph">+</span> Новое';
      removeClass(actionBtn, "hidden");
    } else if (tabName === "memories") {
      navTitle.innerHTML = 'Воспоминания';
      navSub.innerText = appData.memories.length + " В КАПСУЛЕ";
      actionBtn.innerHTML = '<span class="plus-glyph">+</span> Новое';
      removeClass(actionBtn, "hidden");
    } else if (tabName === "events") {
      navTitle.innerHTML = 'Вехи';
      navSub.innerText = "ДОСТИЖЕНИЯ, КОТОРЫЕ ОПРЕДЕЛЯЮТ ЖИЗНЬ";
      actionBtn.innerHTML = '<span class="plus-glyph">+</span> Новая';
      removeClass(actionBtn, "hidden");
    } else if (tabName === "settings") {
      navTitle.innerHTML = 'Настройки';
      navSub.innerText = "ПРОФИЛЬ И РЕЗЕРВНАЯ КОПИЯ";
      addClass(actionBtn, "hidden");
    }

    document.getElementById("main-scroll").scrollTop = 0;
  }

  // ==========================================================================
  // 3. ОТРИСОВКА ГЛАВНОГО ЭКРАНА, МЕХАНИЧЕСКИХ СЧЁТЧИКОВ И ПОЛКИ iBOOKS
  // ==========================================================================
  function renderAll() {
    var todayIso = getTodayISO();
    var dayOfYear = getDayOfYear(todayIso);
    var yearNow = todayIso.split("-")[0];

    // Верхняя металлическая плашка даты
    document.getElementById("home-current-date").innerText = getWeekdayFull(todayIso) + ", " + formatDateRussian(todayIso).toUpperCase();
    document.getElementById("home-day-number").innerText = "№ " + dayOfYear;

    // Приветствие по времени суток
    var hour = new Date().getHours();
    var greet = "ДОБРЫЙ ДЕНЬ,";
    if (hour >= 5 && hour < 12) greet = "ДОБРОЕ УТРО,";
    else if (hour >= 18 || hour < 5) greet = "ДОБРЫЙ ВЕЧЕР,";
    document.getElementById("home-greeting-time").innerText = greet;
    document.getElementById("home-greeting-name").innerText = (appData.profile.name || "ИЛЮША").toUpperCase();

    // Поля в настройках
    document.getElementById("setting-profile-name").value = appData.profile.name || "Илюша";
    document.getElementById("setting-reminder-time").value = appData.profile.reminder_time || "21:00";
    document.getElementById("setting-lastfm-user").value = appData.settings.lastfm_user || "";
    document.getElementById("setting-lastfm-key").value =
      appData.settings.lastfm_key === "b25b959554ed76058ac220b0b2e13d21" ? "" : appData.settings.lastfm_key;

    document.getElementById("log-year-label").innerText = yearNow + " НА СЕГОДНЯ";

    renderHomeTodayCard(todayIso);
    renderWhenWeekRack();
    renderMechanicalCounters(dayOfYear);
    renderMemoriesFeed();
    renderWoodenShelf();
    renderEventsFeed();
  }

  function renderHomeTodayCard(todayIso) {
    var todayMem = findMemoryByDate(todayIso);
    var promptCard = document.getElementById("home-prompt-card");
    var todayCard = document.getElementById("home-today-card");

    if (!todayMem) {
      removeClass(promptCard, "hidden");
      addClass(todayCard, "hidden");
      return;
    }

    addClass(promptCard, "hidden");
    removeClass(todayCard, "hidden");

    var moodBadge = document.getElementById("today-card-mood");
    moodBadge.className = "mood-led-pill mood-" + (todayMem.mood || "positive");
    moodBadge.innerHTML = '<i class="led-dot"></i> ' + getMoodTitle(todayMem.mood);

    var photoWrap = document.getElementById("today-card-photo-wrap");
    var imgSrc = getPhotoSource(todayMem.imageUri);
    if (imgSrc) {
      document.getElementById("today-card-photo").src = imgSrc;
      removeClass(photoWrap, "hidden");
    } else {
      addClass(photoWrap, "hidden");
    }

    var parsed = splitMemoryTextAndSong(todayMem.text, todayMem);
    document.getElementById("today-card-text").innerText = parsed.cleanText;
    document.getElementById("today-card-time").innerText = formatTimeHHMM(todayMem.created_at);

    renderLastFmWidget(parsed.song, "today-lastfm-box");

    document.getElementById("btn-edit-today").onclick = function() {
      openMemoryModal(todayMem);
    };
  }

  function renderWhenWeekRack() {
    var rack = document.getElementById("whenweek-strip");
    rack.innerHTML = "";

    var now = new Date();
    var dayOfWeek = now.getDay();
    var diffToMon = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    var monday = new Date(now.getFullYear(), now.getMonth(), diffToMon);

    var labels = ["П", "В", "С", "Ч", "П", "С", "В"];
    var todayIso = getTodayISO();
    var writtenCount = 0;

    for (var i = 0; i < 7; i++) {
      var d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      var iso = dateToISO(d);
      var mem = findMemoryByDate(iso);
      if (mem) writtenCount++;

      var slot = document.createElement("div");
      slot.className = "week-day-slot" + (iso === todayIso ? " is-today" : "") + (mem ? " has-memory" : "");
      slot.innerHTML =
        '<span class="week-day-name">' + labels[i] + '</span>' +
        '<span class="week-day-num">' + d.getDate() + '</span>' +
        '<span class="week-day-dot"></span>';

      (function(dateIso, existingMem) {
        slot.onclick = function() {
          if (existingMem) {
            openReaderModal(existingMem);
          } else {
            openMemoryModal(null, dateIso);
          }
        };
      })(iso, mem);

      rack.appendChild(slot);
    }

    document.getElementById("whenweek-count").innerText = "ЗАПИСАНО: " + writtenCount;
  }

  function renderMechanicalCounters(dayOfYear) {
    renderFlipRig("flip-memories", appData.memories.length);
    renderFlipRig("flip-events", appData.events.length);
    renderFlipRig("flip-day-of-year", dayOfYear);
  }

  function renderFlipRig(id, val) {
    var el = document.getElementById(id);
    if (!el) return;
    var s = "" + (val || 0);
    while (s.length < 3) s = "0" + s;
    var html = "";
    for (var i = 0; i < s.length; i++) {
      html += '<span class="flip-digit">' + s.charAt(i) + '</span>';
    }
    el.innerHTML = html;
  }

  // Лента воспоминаний
  function renderMemoriesFeed() {
    var feed = document.getElementById("memories-list-container");
    feed.innerHTML = "";

    var q = (document.getElementById("memories-search-input").value || "").toLowerCase();
    var filter = document.getElementById("memories-mood-filter").value;

    var list = [];
    for (var i = 0; i < appData.memories.length; i++) {
      var m = appData.memories[i];
      var matchQ = !q || (m.text && m.text.toLowerCase().indexOf(q) !== -1) || (m.date && m.date.indexOf(q) !== -1);
      var matchF =
        filter === "all" ||
        (filter === "photo" && m.imageUri && getPhotoSource(m.imageUri)) ||
        m.mood === filter;
      var matchShelf = !activeShelfFilter || (m.date && m.date.indexOf(activeShelfFilter) === 0);

      if (matchQ && matchF && matchShelf) {
        list.push(m);
      }
    }

    list.sort(function(a, b) {
      return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0);
    });

    if (list.length === 0) {
      feed.innerHTML =
        '<div class="skeuo-panel" style="text-align:center;padding:24px 12px;">' +
          '<div style="font-weight:900;font-size:14px;margin-bottom:4px;">Записей не найдено</div>' +
          '<div style="font-size:11px;color:#7d6a54;">Нажми «+ Новое» в правом верхнем углу, чтобы сохранить этот день.</div>' +
        '</div>';
      return;
    }

    var groups = {};
    var groupOrder = [];

    for (var j = 0; j < list.length; j++) {
      var item = list[j];
      var parts = item.date.split("-");
      var yr = parts[0];
      var moIdx = parseInt(parts[1], 10) - 1;
      var gKey = yr + "-" + parts[1];
      if (!groups[gKey]) {
        groups[gKey] = {
          title: (MONTHS_RU_UPPER[moIdx] || parts[1]) + " " + yr,
          items: []
        };
        groupOrder.push(gKey);
      }
      groups[gKey].items.push(item);
    }

    for (var g = 0; g < groupOrder.length; g++) {
      var grp = groups[groupOrder[g]];
      var wrap = document.createElement("div");

      var countWord = grp.items.length === 1 ? "1 ВОСПОМИНАНИЕ" : grp.items.length + " ВОСПОМИНАНИЙ";
      wrap.innerHTML =
        '<div class="month-group-header">' +
          '<span class="month-group-name">' + grp.title + '</span>' +
          '<span class="month-group-count">' + countWord + '</span>' +
        '</div>';

      for (var k = 0; k < grp.items.length; k++) {
        var mem = grp.items[k];
        var card = document.createElement("div");
        card.className = "memory-row-card";

        var dParts = mem.date.split("-");
        var dayNumber = dParts[2];
        var imgData = getPhotoSource(mem.imageUri);
        var parsedText = splitMemoryTextAndSong(mem.text, mem);

        var thumbHtml = imgData
          ? '<div class="memory-row-thumb"><img src="' + imgData + '" alt=""></div>'
          : '';

        var songBadgeHtml = parsedText.song
          ? '<span class="memory-row-song">&#9835; ' + escapeHtml(parsedText.song.artist + " — " + parsedText.song.title) + '</span>'
          : '';

        card.innerHTML =
          '<div class="memory-row-date">' +
            '<span class="memory-day-num">' + dayNumber + '</span>' +
            '<span class="memory-weekday-short">' + getWeekdayShort(mem.date) + '</span>' +
          '</div>' +
          thumbHtml +
          '<div class="memory-row-body">' +
            '<p class="memory-row-text">' + escapeHtml(parsedText.cleanText) + '</p>' +
            songBadgeHtml +
          '</div>';

        (function(memTarget) {
          card.onclick = function() {
            openReaderModal(memTarget);
          };
        })(mem);

        wrap.appendChild(card);
      }

      feed.appendChild(wrap);
    }
  }

  // Деревянный шкаф iBooks (По годам и По месяцам)
  function renderWoodenShelf() {
    var shelf = document.getElementById("ibooks-wooden-shelf");
    shelf.innerHTML = "";

    document.getElementById("shelf-total-summary").innerText =
      "ВСЕГО ВОСПОМИНАНИЙ В БИБЛИОТЕКЕ: " + appData.memories.length;

    var map = {};
    var keys = [];

    for (var i = 0; i < appData.memories.length; i++) {
      var m = appData.memories[i];
      if (!m.date) continue;
      var p = m.date.split("-");
      var y = p[0];
      var mo = p[1];
      var key = shelfMode === "year" ? y : (y + "-" + mo);

      if (!map[key]) {
        map[key] = { key: key, year: y, month: mo, count: 0 };
        keys.push(key);
      }
      map[key].count++;
    }

    // Если хотим показать классические годы на полке даже когда мало записей
    if (shelfMode === "year" && keys.length < 3) {
      var sampleYears = ["2026", "2025", "2024"];
      for (var s = 0; s < sampleYears.length; s++) {
        var sy = sampleYears[s];
        if (!map[sy]) {
          map[sy] = { key: sy, year: sy, month: "01", count: 0 };
          keys.push(sy);
        }
      }
    }

    keys.sort().reverse();

    var colors = ["book-terracotta", "book-emerald", "book-navy"];

    for (var t = 0; t < keys.length; t += 3) {
      var tier = document.createElement("div");
      tier.className = "ibooks-tier";

      for (var b = t; b < t + 3 && b < keys.length; b++) {
        var item = map[keys[b]];
        var book = document.createElement("div");
        book.className = "ibooks-book " + colors[b % 3];

        if (shelfMode === "year") {
          book.innerHTML =
            '<span class="book-year-title">' + item.year + '.</span>' +
            '<span class="book-month-title">' + (item.year === "2026" ? "ПИШЕТСЯ" : "АРХИВ") + '</span>' +
            '<span class="book-count-badge">' + item.count + ' ЗАП.</span>';
        } else {
          var mName = MONTHS_RU_NOM[parseInt(item.month, 10) - 1] || item.month;
          book.innerHTML =
            '<span class="book-year-title">' + item.year + '</span>' +
            '<span class="book-month-title">' + mName + '</span>' +
            '<span class="book-count-badge">' + item.count + ' ЗАП.</span>';
        }

        (function(bookInfo) {
          book.onclick = function() {
            if (bookInfo.count === 0) {
              showHud("В книге " + bookInfo.key + " пока 0 записей");
              return;
            }
            activeShelfFilter = bookInfo.key;
            var banner = document.getElementById("shelf-active-filter-bar");
            removeClass(banner, "hidden");
            document.getElementById("shelf-filter-title").innerText = "Открыта книга: " + bookInfo.key;
            document.getElementById("view-btn-list").click();
            renderMemoriesFeed();
          };
        })(item);

        tier.appendChild(book);
      }

      shelf.appendChild(tier);
    }
  }

  // Вкладка 3: Вехи (Milestones / Events)
  function renderEventsFeed() {
    var container = document.getElementById("events-list-container");
    container.innerHTML = "";

    var q = (document.getElementById("events-search-input").value || "").toLowerCase();
    var list = [];

    for (var i = 0; i < appData.events.length; i++) {
      var ev = appData.events[i];
      var title = ev.title || ev.text || "";
      if (!q || title.toLowerCase().indexOf(q) !== -1 || (ev.category && ev.category.toLowerCase().indexOf(q) !== -1)) {
        list.push(ev);
      }
    }

    list.sort(function(a, b) {
      return a.date < b.date ? 1 : -1;
    });

    if (list.length === 0) {
      var emptyCard = document.createElement("div");
      emptyCard.className = "paper-sheet-card";
      emptyCard.innerHTML =
        '<div class="sheet-inner" style="text-align:center;">' +
          '<h2 class="sheet-headline" style="font-size:19px;">Вех пока нет.</h2>' +
          '<p class="sheet-lead">Повышения, поездки, крупные покупки — всё, что определяет жизнь. Отметьте эти моменты, и они окажутся здесь.</p>' +
          '<button type="button" id="btn-empty-add-event" class="ios6-hero-btn">' +
            '<span class="hero-btn-label">ОТМЕТИТЬ ВЕХУ</span>' +
            '<span class="hero-btn-circle">&rarr;</span>' +
          '</button>' +
        '</div>';
      container.appendChild(emptyCard);

      var btnAdd = document.getElementById("btn-empty-add-event");
      if (btnAdd) {
        btnAdd.onclick = function() {
          openEventModal(null);
        };
      }
      return;
    }

    for (var j = 0; j < list.length; j++) {
      var item = list[j];
      var row = document.createElement("div");
      row.className = "memory-row-card";

      var dParts = (item.date || getTodayISO()).split("-");
      var dayNum = dParts[2] || "01";
      var moIdx = parseInt(dParts[1], 10) - 1;
      var moShort = (MONTHS_RU_UPPER[moIdx] || "").substring(0, 3) + " '" + dParts[0].substring(2);
      var imgData = getPhotoSource(item.imageUri);

      var thumb = imgData ? '<div class="memory-row-thumb"><img src="' + imgData + '" alt=""></div>' : '';

      row.innerHTML =
        '<div class="memory-row-date">' +
          '<span class="memory-day-num">' + dayNum + '</span>' +
          '<span class="memory-weekday-short">' + moShort + '</span>' +
        '</div>' +
        thumb +
        '<div class="memory-row-body">' +
          '<span class="cassette-badge" style="color:#e8451e;">' + escapeHtml(item.category || "ЖИЗНЬ") + '</span>' +
          '<p class="memory-row-text" style="font-weight:bold;">' + escapeHtml(item.title || item.text || "") + '</p>' +
        '</div>';

      (function(evObj) {
        row.onclick = function() {
          openEventModal(evObj);
        };
      })(item);

      container.appendChild(row);
    }
  }

  // ==========================================================================
  // 4. МОДАЛЬНЫЕ ОКНА ЗАПИСИ, ВЕХ И ПРОСМОТРА («ПЕРЕЖИТЬ ЗАНОВО»)
  // ==========================================================================
  function openMemoryModal(memObj, presetDate) {
    removeClass(document.getElementById("modal-memory"), "hidden");

    var idField = document.getElementById("memory-edit-id");
    var dateField = document.getElementById("memory-date-input");
    var textField = document.getElementById("memory-text-input");
    var songTitleField = document.getElementById("memory-song-title");
    var songArtistField = document.getElementById("memory-song-artist");
    var songPlaysField = document.getElementById("memory-song-plays");
    var songCoverField = document.getElementById("memory-song-cover");
    var delWrap = document.getElementById("memory-delete-wrap");

    if (memObj) {
      idField.value = memObj.id;
      dateField.value = memObj.date;
      selectedMood = memObj.mood || "positive";

      var parsed = splitMemoryTextAndSong(memObj.text, memObj);
      textField.value = parsed.cleanText;

      if (parsed.song) {
        songTitleField.value = parsed.song.title || "";
        songArtistField.value = parsed.song.artist || "";
        songPlaysField.value = parsed.song.plays || "";
        songCoverField.value = parsed.song.cover || "";
        renderSongPreviewInModal(parsed.song);
      } else {
        songTitleField.value = "";
        songArtistField.value = "";
        songPlaysField.value = "";
        songCoverField.value = "";
        document.getElementById("memory-lastfm-preview").innerHTML =
          '<span class="slot-placeholder">Нажми «Подтянуть за день» или впиши трек ниже</span>';
      }

      currentMemoryPhotoName = memObj.imageUri ? memObj.imageUri.replace(/^photos\//, "") : "";
      currentMemoryPhotoData = getPhotoSource(memObj.imageUri);

      if (currentMemoryPhotoData) {
        document.getElementById("memory-photo-preview").src = currentMemoryPhotoData;
        removeClass(document.getElementById("memory-photo-preview-wrap"), "hidden");
        removeClass(document.getElementById("btn-remove-photo"), "hidden");
      } else {
        addClass(document.getElementById("memory-photo-preview-wrap"), "hidden");
        addClass(document.getElementById("btn-remove-photo"), "hidden");
      }

      removeClass(delWrap, "hidden");
    } else {
      idField.value = "";
      dateField.value = presetDate || getTodayISO();
      textField.value = "";
      selectedMood = "positive";
      currentMemoryPhotoData = "";
      currentMemoryPhotoName = "";
      songTitleField.value = "";
      songArtistField.value = "";
      songPlaysField.value = "";
      songCoverField.value = "";
      document.getElementById("memory-lastfm-preview").innerHTML =
        '<span class="slot-placeholder">Нажми «Подтянуть за день» или впиши трек ниже</span>';
      addClass(document.getElementById("memory-photo-preview-wrap"), "hidden");
      addClass(document.getElementById("btn-remove-photo"), "hidden");
      addClass(delWrap, "hidden");
    }

    var pads = document.querySelectorAll(".mood-pad");
    for (var i = 0; i < pads.length; i++) {
      pads[i].className = pads[i].getAttribute("data-mood") === selectedMood ? "mood-pad active" : "mood-pad";
    }
  }

  function saveMemoryRecord() {
    var editId = document.getElementById("memory-edit-id").value;
    var dateVal = document.getElementById("memory-date-input").value || getTodayISO();
    var cleanText = document.getElementById("memory-text-input").value.trim();

    var sTitle = document.getElementById("memory-song-title").value.trim();
    var sArtist = document.getElementById("memory-song-artist").value.trim();
    var sPlays = document.getElementById("memory-song-plays").value.trim();
    var sCover = document.getElementById("memory-song-cover").value.trim();

    if (!cleanText && !currentMemoryPhotoData && !sTitle) {
      showHud("Напиши пару строк или прикрепи фото");
      return;
    }

    var finalText = cleanText;
    var lastfmMeta = null;

    if (sTitle || sArtist) {
      var artistPart = sArtist || "Неизвестен";
      var titlePart = sTitle || "Трек";
      var playsSuffix = sPlays ? " (прослушано: " + sPlays + " раз)" : "";
      finalText = cleanText + (cleanText ? "\n\n" : "") + "🎵 Саундтрек дня: " + artistPart + " — " + titlePart + playsSuffix;
      lastfmMeta = {
        artist: artistPart,
        title: titlePart,
        plays: sPlays,
        cover: sCover
      };
    }

    var uriToSave = "";
    if (currentMemoryPhotoData) {
      uriToSave = currentMemoryPhotoName || ("whengram_" + (new Date().getTime()) + "_1.jpg");
      savePhotoToOfflineDB(uriToSave, currentMemoryPhotoData);
    }

    var nowIso = new Date().toISOString();

    if (editId) {
      for (var i = 0; i < appData.memories.length; i++) {
        if (appData.memories[i].id === editId) {
          appData.memories[i].date = dateVal;
          appData.memories[i].text = finalText;
          appData.memories[i].mood = selectedMood;
          appData.memories[i].imageUri = uriToSave;
          appData.memories[i].lastfm = lastfmMeta;
          appData.memories[i].updated_at = nowIso;
          break;
        }
      }
    } else {
      appData.memories.push({
        id: makeUUID(),
        text: finalText,
        mood: selectedMood,
        date: dateVal,
        imageUri: uriToSave,
        lastfm: lastfmMeta,
        created_at: nowIso,
        updated_at: nowIso
      });
    }

    saveAppState();
    addClass(document.getElementById("modal-memory"), "hidden");
    renderAll();
    showHud("Сохранено в капсулу");
  }

  function openEventModal(evObj) {
    removeClass(document.getElementById("modal-event"), "hidden");

    var idField = document.getElementById("event-edit-id");
    var titleField = document.getElementById("event-title-input");
    var catField = document.getElementById("event-category-select");
    var dateField = document.getElementById("event-date-input");
    var notesField = document.getElementById("event-notes-input");
    var delWrap = document.getElementById("event-delete-wrap");

    if (evObj) {
      idField.value = evObj.id;
      titleField.value = evObj.title || evObj.text || "";
      catField.value = evObj.category || "ЖИЗНЬ";
      dateField.value = evObj.date || getTodayISO();
      notesField.value = evObj.notes || "";
      currentEventPhotoName = evObj.imageUri || "";
      currentEventPhotoData = getPhotoSource(evObj.imageUri);

      if (currentEventPhotoData) {
        document.getElementById("event-photo-preview").src = currentEventPhotoData;
        removeClass(document.getElementById("event-photo-preview-wrap"), "hidden");
      } else {
        addClass(document.getElementById("event-photo-preview-wrap"), "hidden");
      }
      removeClass(delWrap, "hidden");
    } else {
      idField.value = "";
      titleField.value = "";
      catField.value = "ЖИЗНЬ";
      dateField.value = getTodayISO();
      notesField.value = "";
      currentEventPhotoData = "";
      currentEventPhotoName = "";
      addClass(document.getElementById("event-photo-preview-wrap"), "hidden");
      addClass(delWrap, "hidden");
    }
  }

  function saveEventRecord() {
    var editId = document.getElementById("event-edit-id").value;
    var titleVal = document.getElementById("event-title-input").value.trim();
    var catVal = document.getElementById("event-category-select").value;
    var dateVal = document.getElementById("event-date-input").value || getTodayISO();
    var notesVal = document.getElementById("event-notes-input").value.trim();

    if (!titleVal) {
      showHud("Укажи название вехи");
      return;
    }

    var uriToSave = "";
    if (currentEventPhotoData) {
      uriToSave = currentEventPhotoName || ("whengram_ev_" + (new Date().getTime()) + ".jpg");
      savePhotoToOfflineDB(uriToSave, currentEventPhotoData);
    }

    var nowIso = new Date().toISOString();

    if (editId) {
      for (var i = 0; i < appData.events.length; i++) {
        if (appData.events[i].id === editId) {
          appData.events[i].title = titleVal;
          appData.events[i].text = titleVal;
          appData.events[i].category = catVal;
          appData.events[i].date = dateVal;
          appData.events[i].notes = notesVal;
          appData.events[i].imageUri = uriToSave;
          appData.events[i].updated_at = nowIso;
          break;
        }
      }
    } else {
      appData.events.push({
        id: makeUUID(),
        title: titleVal,
        text: titleVal,
        category: catVal,
        date: dateVal,
        notes: notesVal,
        imageUri: uriToSave,
        created_at: nowIso,
        updated_at: nowIso
      });
    }

    saveAppState();
    addClass(document.getElementById("modal-event"), "hidden");
    renderAll();
    showHud("Веха отмечена!");
  }

  function openReaderModal(memObj) {
    removeClass(document.getElementById("modal-reader"), "hidden");

    document.getElementById("reader-weekday").innerText =
      getWeekdayFull(memObj.date) + " • " + formatTimeHHMM(memObj.created_at);
    document.getElementById("reader-full-date").innerText = formatDateRussian(memObj.date);
    document.getElementById("reader-day-of-year").innerText = getDayOfYear(memObj.date) + " / 365";

    var badge = document.getElementById("reader-mood-badge");
    badge.className = "mood-led-pill mood-" + (memObj.mood || "positive");
    badge.innerHTML = '<i class="led-dot"></i> ' + getMoodTitle(memObj.mood);

    var photoWrap = document.getElementById("reader-photo-wrap");
    var imgData = getPhotoSource(memObj.imageUri);
    if (imgData) {
      document.getElementById("reader-photo-img").src = imgData;
      removeClass(photoWrap, "hidden");
    } else {
      addClass(photoWrap, "hidden");
    }

    var parsed = splitMemoryTextAndSong(memObj.text, memObj);
    document.getElementById("reader-text-body").innerText = parsed.cleanText;

    renderLastFmWidget(parsed.song, "reader-lastfm-box");

    document.getElementById("btn-reader-edit").onclick = function() {
      stopAudioPreview();
      addClass(document.getElementById("modal-reader"), "hidden");
      openMemoryModal(memObj);
    };
  }

  // ==========================================================================
  // 5. LAST.FM САМАЯ ПРОСЛУШИВАЕМАЯ ПЕСНЯ ЗА ДЕНЬ + АУДИО-ПРЕВЬЮ ITUNES
  // ==========================================================================
  function fetchTopSongFromLastFm() {
    var user = (appData.settings.lastfm_user || document.getElementById("setting-lastfm-user").value || "").trim();
    var apiKey = appData.settings.lastfm_key || "b25b959554ed76058ac220b0b2e13d21";
    var dateVal = document.getElementById("memory-date-input").value || getTodayISO();

    if (!user) {
      showHud("Сначала введи ник Last.fm в Настройках!");
      return;
    }

    showHud("Ищем топ-песню дня на Last.fm...");

    var parts = dateVal.split("-");
    var startTs = Math.floor(new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 0, 0, 0).getTime() / 1000);
    var endTs = Math.floor(new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59).getTime() / 1000);

    var url = "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=" + encodeURIComponent(user) +
              "&api_key=" + encodeURIComponent(apiKey) + "&from=" + startTs + "&to=" + endTs + "&limit=200&format=json";

    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try {
          var res = JSON.parse(xhr.responseText);
          var list = res && res.recenttracks && res.recenttracks.track;
          if (!list) {
            showHud("За этот день скробблов нет");
            return;
          }
          if (! (list instanceof Array)) list = [list];

          // Считаем самую прослушиваемую песню за этот день
          var counts = {};
          var bestKey = null;
          var maxPlays = 0;

          for (var i = 0; i < list.length; i++) {
            var tr = list[i];
            if (tr["@attr"] && tr["@attr"].nowplaying === "true") continue;
            var title = (tr.name || "").trim();
            var artist = (tr.artist && (tr.artist["#text"] || tr.artist.name) || "").trim();
            if (!title) continue;

            var cover = "";
            if (tr.image && tr.image.length) {
              cover = tr.image[tr.image.length - 1]["#text"] || "";
            }

            var k = artist.toLowerCase() + "|||" + title.toLowerCase();
            if (!counts[k]) {
              counts[k] = { artist: artist, title: title, plays: 0, cover: cover };
            }
            counts[k].plays++;
            if (counts[k].plays > maxPlays) {
              maxPlays = counts[k].plays;
              bestKey = k;
            }
          }

          if (!bestKey) {
            showHud("За этот день скробблов не найдено");
            return;
          }

          var winner = counts[bestKey];
          document.getElementById("memory-song-title").value = winner.title;
          document.getElementById("memory-song-artist").value = winner.artist;
          document.getElementById("memory-song-plays").value = "" + winner.plays;
          document.getElementById("memory-song-cover").value = winner.cover || "";

          renderSongPreviewInModal(winner);
          showHud("Топ-трек найден (" + winner.plays + " раз)!");
        } catch (err) {
          showHud("Ошибка ответа Last.fm");
        }
      } else {
        showHud("Нет связи с Last.fm");
      }
    };
    xhr.send();
  }

  function renderSongPreviewInModal(song) {
    var box = document.getElementById("memory-lastfm-preview");
    var playsText = song.plays ? " • ↻ " + song.plays + " раз" : "";
    box.innerHTML =
      '<div style="font-weight:900;color:#e8451e;font-size:9px;">САМАЯ ПРОСЛУШИВАЕМАЯ ПЕСНЯ ДНЯ' + playsText + '</div>' +
      '<div style="font-weight:800;font-size:12px;margin-top:2px;">' + escapeHtml(song.artist + " — " + song.title) + '</div>';
  }

  function renderLastFmWidget(songObj, containerId) {
    var box = document.getElementById(containerId);
    if (!box) return;
    if (!songObj || (!songObj.title && !songObj.artist)) {
      addClass(box, "hidden");
      return;
    }

    removeClass(box, "hidden");
    var coverHtml = songObj.cover
      ? '<img src="' + songObj.cover + '" alt="">'
      : '<div class="cassette-vinyl-disc">&#9835;</div>';

    var badgeText = "САУНДТРЕК ДНЯ (LAST.FM)" + (songObj.plays ? " • ↻ " + songObj.plays + " РАЗ" : "");

    box.innerHTML =
      '<div class="cassette-cover-wrap">' + coverHtml + '</div>' +
      '<div class="cassette-info">' +
        '<span class="cassette-badge">' + badgeText + '</span>' +
        '<span class="cassette-song">' + escapeHtml(songObj.title) + '</span>' +
        '<span class="cassette-artist">' + escapeHtml(songObj.artist) + '</span>' +
      '</div>' +
      '<button type="button" class="cassette-play-btn" title="Слушать отрывок">&#9654;</button>';

    var playBtn = box.querySelector(".cassette-play-btn");
    if (playBtn) {
      playBtn.onclick = function(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        toggleTrackPreview(songObj, playBtn);
      };
    }
  }

  function toggleTrackPreview(songObj, btnEl) {
    var audio = document.getElementById("lastfm-audio-preview");
    if (!audio.paused && audio.getAttribute("data-Key") === (songObj.artist + songObj.title)) {
      audio.pause();
      btnEl.innerHTML = "&#9654;";
      return;
    }

    btnEl.innerHTML = "&#8987;";
    var cbName = "itunes_cb_" + Math.floor(Math.random() * 1000000);
    var query = encodeURIComponent(songObj.artist + " " + songObj.title);

    window[cbName] = function(data) {
      try {
        delete window[cbName];
      } catch (e) {}
      if (data && data.results && data.results.length > 0 && data.results[0].previewUrl) {
        audio.src = data.results[0].previewUrl;
        audio.setAttribute("data-Key", songObj.artist + songObj.title);
        audio.play();
        btnEl.innerHTML = "&#9632;";
        audio.onended = function() {
          btnEl.innerHTML = "&#9654;";
        };
      } else {
        btnEl.innerHTML = "&#9654;";
        showHud("Превью трека не найдено в iTunes");
      }
    };

    var script = document.createElement("script");
    script.src = "https://itunes.apple.com/search?term=" + query + "&media=music&limit=1&callback=" + cbName;
    document.body.appendChild(script);
  }

  function stopAudioPreview() {
    var audio = document.getElementById("lastfm-audio-preview");
    if (audio && !audio.paused) audio.pause();
  }

  function splitMemoryTextAndSong(rawText, memObj) {
    var text = rawText || "";
    var marker = "🎵 Саундтрек дня:";
    var idx = text.indexOf(marker);
    var song = (memObj && memObj.lastfm) ? memObj.lastfm : null;

    if (idx !== -1) {
      var line = text.substring(idx + marker.length).trim();
      text = text.substring(0, idx).trim();

      if (!song) {
        var playsMatch = line.match(/\(прослушано:\s*(\d+)\s*раз\)/i);
        var plays = playsMatch ? playsMatch[1] : "";
        var cleanLine = line.replace(/\s*\(прослушано:\s*\d+\s*раз\)/i, "");
        var dashParts = cleanLine.split(" — ");
        song = {
          artist: dashParts[0] || "Last.fm",
          title: dashParts.slice(1).join(" — ") || cleanLine,
          plays: plays,
          cover: ""
        };
      }
    }
    return { cleanText: text, song: song };
  }

  // ==========================================================================
  // 6. НАСТОЯЩИЙ ГЕНЕРАТОР И ПАРСЕР .ZIP БЭКАПОВ WHENGRAM (ЧИСТЫЙ ES5)
  // ==========================================================================
  function buildCleanManifestForExport() {
    var cleanMemories = [];
    for (var i = 0; i < appData.memories.length; i++) {
      var m = appData.memories[i];
      var fileName = m.imageUri ? m.imageUri.replace(/^photos\//, "") : "";
      cleanMemories.push({
        id: m.id,
        text: m.text,
        mood: m.mood || "positive",
        date: m.date,
        imageUri: fileName || undefined,
        created_at: m.created_at,
        updated_at: m.updated_at
      });
    }
    return {
      version: "2.0",
      exported_at: new Date().toISOString(),
      memories: cleanMemories,
      events: appData.events || [],
      profile: appData.profile,
      settings: { theme: "system" }
    };
  }

  function exportWhengramZipBackup() {
    try {
      var manifestObj = buildCleanManifestForExport();
      var manifestBytes = utf8StringToBytes(JSON.stringify(manifestObj));

      var zipEntries = [];
      // 1. Добавляем фотографии в папку photos/ (точно как в оригинальном архиве)
      for (var i = 0; i < appData.memories.length; i++) {
        var uri = appData.memories[i].imageUri;
        if (uri) {
          var cleanName = uri.replace(/^photos\//, "");
          var b64 = getPhotoSource(uri);
          if (b64 && b64.indexOf("base64,") !== -1) {
            var rawBytes = base64ToBytes(b64.split("base64,")[1]);
            zipEntries.push({ name: "photos/" + cleanName, data: rawBytes });
          }
        }
      }

      // 2. Добавляем сам manifest.json
      zipEntries.push({ name: "manifest.json", data: manifestBytes });

      var zipBinary = createStoredZipBytes(zipEntries);
      var blob = new Blob([zipBinary], { type: "application/zip" });
      var url = (window.URL || window.webkitURL).createObjectURL(blob);

      var a = document.createElement("a");
      a.href = url;
      a.download = "whengram-backup-" + getTodayISO() + ".zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showHud("Архив .ZIP собран!");
    } catch (e) {
      // Фолбэк для старого окна Safari
      var area = document.getElementById("backup-json-textarea");
      area.value = JSON.stringify(buildCleanManifestForExport(), null, 2);
      showHud("Код бэкапа выведен в текстовое поле ниже");
    }
  }

  function importWhengramBackupFile(file) {
    var name = (file.name || "").toLowerCase();
    if (name.indexOf(".json") !== -1) {
      var r = new FileReader();
      r.onload = function(e) {
        try {
          applyImportedManifest(JSON.parse(e.target.result));
          showHud("JSON-бэкап загружен!");
        } catch (err) {
          showHud("Ошибка чтения JSON");
        }
      };
      r.readAsText(file);
      return;
    }

    // Чтение бинарного .ZIP архива Whengram
    var reader = new FileReader();
    reader.onload = function(evt) {
      try {
        var bytes = new Uint8Array(evt.target.result);
        var entries = parseZipArchive(bytes);
        var foundManifest = null;

        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          if (entry.name.indexOf("photos/") === 0 && entry.data.length > 0) {
            var shortName = entry.name.replace(/^photos\//, "");
            var dataUrl = "data:image/jpeg;base64," + bytesToBase64(entry.data);
            savePhotoToOfflineDB(shortName, dataUrl);
          } else if (entry.name.indexOf("manifest.json") !== -1) {
            var jsonText = bytesToUtf8String(entry.data);
            foundManifest = JSON.parse(jsonText);
          }
        }

        if (foundManifest) {
          applyImportedManifest(foundManifest);
          showHud("ZIP-архив и фото успешно импортированы!");
        } else {
          showHud("В архиве не найден manifest.json");
        }
      } catch (err) {
        showHud("Не удалось распаковать ZIP");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function applyImportedManifest(parsed) {
    if (!parsed || !parsed.memories) return;
    appData.memories = parsed.memories;
    appData.events = parsed.events || [];
    if (parsed.profile && parsed.profile.name && parsed.profile.name.trim()) {
      appData.profile.name = parsed.profile.name.trim();
    }
    if (parsed.profile && parsed.profile.reminder_time) {
      appData.profile.reminder_time = parsed.profile.reminder_time;
    }
    saveAppState();
    renderAll();
  }

  // Упаковщик ZIP (метод STORE = 0, читается любым приложением на Android/iOS/ПК)
  var crcTable = null;
  function makeCrcTable() {
    crcTable = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      crcTable[n] = c;
    }
  }

  function crc32(bytes) {
    if (!crcTable) makeCrcTable();
    var crc = 0 ^ (-1);
    for (var i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function createStoredZipBytes(files) {
    var localParts = [];
    var centralParts = [];
    var offset = 0;

    for (var i = 0; i < files.length; i++) {
      var nameBytes = utf8StringToBytes(files[i].name);
      var dataBytes = files[i].data;
      var crc = crc32(dataBytes);
      var len = dataBytes.length;

      var localHeader = new Uint8Array(30 + nameBytes.length);
      writeUint32LE(localHeader, 0, 0x04034b50);
      writeUint16LE(localHeader, 4, 20);
      writeUint16LE(localHeader, 6, 0x0800);
      writeUint16LE(localHeader, 8, 0);
      writeUint16LE(localHeader, 10, 0);
      writeUint16LE(localHeader, 12, 0);
      writeUint32LE(localHeader, 14, crc);
      writeUint32LE(localHeader, 18, len);
      writeUint32LE(localHeader, 22, len);
      writeUint16LE(localHeader, 26, nameBytes.length);
      writeUint16LE(localHeader, 28, 0);
      localHeader.set(nameBytes, 30);

      localParts.push(localHeader);
      localParts.push(dataBytes);

      var centralHeader = new Uint8Array(46 + nameBytes.length);
      writeUint32LE(centralHeader, 0, 0x02014b50);
      writeUint16LE(centralHeader, 4, 20);
      writeUint16LE(centralHeader, 6, 20);
      writeUint16LE(centralHeader, 8, 0x0800);
      writeUint16LE(centralHeader, 10, 0);
      writeUint16LE(centralHeader, 12, 0);
      writeUint16LE(centralHeader, 14, 0);
      writeUint32LE(centralHeader, 16, crc);
      writeUint32LE(centralHeader, 20, len);
      writeUint32LE(centralHeader, 24, len);
      writeUint16LE(centralHeader, 28, nameBytes.length);
      writeUint16LE(centralHeader, 30, 0);
      writeUint16LE(centralHeader, 32, 0);
      writeUint16LE(centralHeader, 34, 0);
      writeUint16LE(centralHeader, 36, 0);
      writeUint32LE(centralHeader, 38, 0);
      writeUint32LE(centralHeader, 42, offset);
      centralHeader.set(nameBytes, 46);

      centralParts.push(centralHeader);
      offset += localHeader.length + len;
    }

    var centralSize = 0;
    for (var c = 0; c < centralParts.length; c++) centralSize += centralParts[c].length;

    var eocd = new Uint8Array(22);
    writeUint32LE(eocd, 0, 0x06054b50);
    writeUint16LE(eocd, 4, 0);
    writeUint16LE(eocd, 6, 0);
    writeUint16LE(eocd, 8, files.length);
    writeUint16LE(eocd, 10, files.length);
    writeUint32LE(eocd, 12, centralSize);
    writeUint32LE(eocd, 16, offset);
    writeUint16LE(eocd, 20, 0);

    var totalLen = offset + centralSize + 22;
    var out = new Uint8Array(totalLen);
    var pos = 0;
    for (var l = 0; l < localParts.length; l++) {
      out.set(localParts[l], pos);
      pos += localParts[l].length;
    }
    for (var cp = 0; cp < centralParts.length; cp++) {
      out.set(centralParts[cp], pos);
      pos += centralParts[cp].length;
    }
    out.set(eocd, pos);
    return out;
  }

  function parseZipArchive(bytes) {
    var result = [];
    // Читаем через Central Directory в конце файла (чтобы корректно обходить флаги Data Descriptor)
    var eocdPos = -1;
    for (var i = bytes.length - 22; i >= 0; i--) {
      if (readUint32LE(bytes, i) === 0x06054b50) {
        eocdPos = i;
        break;
      }
    }
    if (eocdPos === -1) return result;

    var totalEntries = readUint16LE(bytes, eocdPos + 10);
    var cdOffset = readUint32LE(bytes, eocdPos + 16);
    var ptr = cdOffset;

    for (var e = 0; e < totalEntries; e++) {
      if (readUint32LE(bytes, ptr) !== 0x02014b50) break;
      var method = readUint16LE(bytes, ptr + 10);
      var compSize = readUint32LE(bytes, ptr + 20);
      var nameLen = readUint16LE(bytes, ptr + 28);
      var extraLen = readUint16LE(bytes, ptr + 30);
      var commentLen = readUint16LE(bytes, ptr + 32);
      var localOffset = readUint32LE(bytes, ptr + 42);

      var nameBytes = bytes.subarray(ptr + 46, ptr + 46 + nameLen);
      var fileName = bytesToUtf8String(nameBytes);

      var localNameLen = readUint16LE(bytes, localOffset + 26);
      var localExtraLen = readUint16LE(bytes, localOffset + 28);
      var dataStart = localOffset + 30 + localNameLen + localExtraLen;

      if (method === 0 && compSize > 0) {
        result.push({
          name: fileName,
          data: bytes.subarray(dataStart, dataStart + compSize)
        });
      }
      ptr += 46 + nameLen + extraLen + commentLen;
    }
    return result;
  }

  // ==========================================================================
  // 7. ВСПОМОГАТЕЛЬНЫЕ УТИЛИТЫ И СЖАТИЕ ФОТО ПОД ПАМЯТЬ iPHONE 4S
  // ==========================================================================
  function compressPhotoForRetina(file, callback) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement("canvas");
        var maxSide = 780;
        var w = img.width;
        var h = img.height;
        if (w > h && w > maxSide) {
          h = Math.round(h * (maxSide / w));
          w = maxSide;
        } else if (h >= w && h > maxSide) {
          w = Math.round(w * (maxSide / h));
          h = maxSide;
        }
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function findMemoryByDate(dateIso) {
    for (var i = 0; i < appData.memories.length; i++) {
      if (appData.memories[i].date === dateIso) return appData.memories[i];
    }
    return null;
  }

  function deleteMemoryById(id) {
    var next = [];
    for (var i = 0; i < appData.memories.length; i++) {
      if (appData.memories[i].id !== id) next.push(appData.memories[i]);
    }
    appData.memories = next;
    saveAppState();
  }

  function deleteEventById(id) {
    var next = [];
    for (var i = 0; i < appData.events.length; i++) {
      if (appData.events[i].id !== id) next.push(appData.events[i]);
    }
    appData.events = next;
    saveAppState();
  }

  function getTodayISO() {
    return dateToISO(new Date());
  }

  function dateToISO(d) {
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
  }

  function getDayOfYear(dateIso) {
    var p = dateIso.split("-");
    var current = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    var start = new Date(parseInt(p[0], 10), 0, 0);
    return Math.floor((current - start) / (1000 * 60 * 60 * 24));
  }

  function formatDateRussian(dateIso) {
    if (!dateIso) return "";
    var p = dateIso.split("-");
    var mo = MONTHS_RU_GEN[parseInt(p[1], 10) - 1] || p[1];
    return parseInt(p[2], 10) + " " + mo + " " + p[0] + " г.";
  }

  function getWeekdayShort(dateIso) {
    var p = dateIso.split("-");
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return DAYS_SHORT[d.getDay()] || "";
  }

  function getWeekdayFull(dateIso) {
    var p = dateIso.split("-");
    var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    return DAYS_FULL[d.getDay()] || "";
  }

  function formatTimeHHMM(isoStr) {
    if (!isoStr) return appData.profile.reminder_time || "21:00";
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return "21:00";
    var h = d.getHours();
    var m = d.getMinutes();
    return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
  }

  function getMoodTitle(mood) {
    if (mood === "neutral") return "РОВНО";
    if (mood === "negative") return "ТЯЖЕЛО";
    return "ХОРОШО";
  }

  function escapeHtml(str) {
    if (!str) return "";
    return ("" + str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function addClass(el, cls) {
    if (!el) return;
    if (el.className.indexOf(cls) === -1) {
      el.className = (el.className + " " + cls).trim();
    }
  }

  function removeClass(el, cls) {
    if (!el) return;
    var reg = new RegExp("(\\s|^)" + cls + "(\\s|$)", "g");
    el.className = el.className.replace(reg, " ").trim();
  }

  function makeUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function utf8StringToBytes(str) {
    var utf8 = unescape(encodeURIComponent(str));
    var arr = new Uint8Array(utf8.length);
    for (var i = 0; i < utf8.length; i++) arr[i] = utf8.charCodeAt(i);
    return arr;
  }

  function bytesToUtf8String(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try {
      return decodeURIComponent(escape(s));
    } catch (e) {
      return s;
    }
  }

  function base64ToBytes(b64) {
    var bin = window.atob(b64);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function bytesToBase64(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return window.btoa(bin);
  }

  function writeUint16LE(buf, pos, val) {
    buf[pos] = val & 0xFF;
    buf[pos + 1] = (val >>> 8) & 0xFF;
  }

  function writeUint32LE(buf, pos, val) {
    buf[pos] = val & 0xFF;
    buf[pos + 1] = (val >>> 8) & 0xFF;
    buf[pos + 2] = (val >>> 16) & 0xFF;
    buf[pos + 3] = (val >>> 24) & 0xFF;
  }

  function readUint16LE(buf, pos) {
    return buf[pos] | (buf[pos + 1] << 8);
  }

  function readUint32LE(buf, pos) {
    return (buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16) | (buf[pos + 3] << 24)) >>> 0;
  }

  var hudTimer = null;
  function showHud(msg) {
    var hud = document.getElementById("ios6-hud");
    var txt = document.getElementById("ios6-hud-text");
    if (!hud || !txt) return;
    txt.innerText = msg;
    removeClass(hud, "hidden");
    if (hudTimer) clearTimeout(hudTimer);
    hudTimer = setTimeout(function() {
      addClass(hud, "hidden");
    }, 2200);
  }
})();
