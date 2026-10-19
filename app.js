/* =========================================================
   WHENGRAM — APP.JS (ES5 для Mobile Safari на iOS 6.1.3)
   ========================================================= */

(function() {
  // Базовые данные по умолчанию (если память пустая, подгружаем твой бэкап за 18.10.2026)
  var defaultManifest = {
    "version": "2.0",
    "exported_at": "2026-10-19T16:46:32.369Z",
    "memories": [
      {
        "id": "ee1b9527-b962-4d63-b99e-f8a1510fd2ec",
        "text": "ой да в пизду((((((\n\nблч такой уебский день с...",
        "mood": "negative",
        "date": "2026-10-18",
        "imageUri": "",
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

  var STORAGE_KEY = "whengram_ios6_data_v2";
  var appData = null;

  // Активные фильтры и состояния
  var currentTab = "home";
  var shelfMode = "year"; // 'year' или 'month'
  var activeShelfFilter = null; // например '2026' или '2026-10'
  var selectedMood = "positive";
  var currentPhotoBase64 = "";

  // Инициализация при загрузке DOM
  window.onload = function() {
    loadDataFromStorage();
    initUIBindings();
    renderAll();
  };

  // Загрузка данных из localStorage / WebSQL
  function loadDataFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        appData = JSON.parse(raw);
      } else {
        appData = defaultManifest;
        saveDataToStorage();
      }
    } catch (e) {
      appData = defaultManifest;
    }
    if (!appData.profile) appData.profile = { name: "Илюша", reminder_time: "21:00" };
    if (!appData.settings) appData.settings = { theme: "cream" };
    if (!appData.memories) appData.memories = [];
    if (!appData.events) appData.events = [];
  }

  function saveDataToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {
      showAlert("Ошибка: память устройства заполнена!");
    }
  }

  // Привязка событий интерфейса
  function initUIBindings() {
    // Переключение вкладок внизу
    var tabButtons = document.querySelectorAll(".tab-item");
    for (var i = 0; i < tabButtons.length; i++) {
      tabButtons[i].onclick = function() {
        var tabName = this.getAttribute("data-tab");
        switchTab(tabName);
      };
    }

    // Кнопки «+ Новое»
    document.getElementById("navbar-action-btn").onclick = function() {
      openMemoryModal();
    };
    document.getElementById("btn-write-today").onclick = function() {
      openMemoryModal();
    };

    // Переключение тем
    var themeSwitch = document.getElementById("toggle-cream-theme");
    if (appData.settings.theme === "dark") {
      document.body.className = "theme-dark";
      themeSwitch.className = "ios6-switch";
    } else {
      document.body.className = "theme-cream";
      themeSwitch.className = "ios6-switch active";
    }

    themeSwitch.onclick = function() {
      if (appData.settings.theme === "dark") {
        appData.settings.theme = "cream";
        document.body.className = "theme-cream";
        this.className = "ios6-switch active";
      } else {
        appData.settings.theme = "dark";
        document.body.className = "theme-dark";
        this.className = "ios6-switch";
      }
      saveDataToStorage();
    };

    // Сегментированный переключатель списка и полки
    document.getElementById("view-btn-list").onclick = function() {
      document.getElementById("view-btn-list").className = "seg-btn active";
      document.getElementById("view-btn-shelf").className = "seg-btn";
      document.getElementById("memories-list-container").style.display = "block";
      document.getElementById("whenshelf-container").style.display = "none";
    };

    document.getElementById("view-btn-shelf").onclick = function() {
      document.getElementById("view-btn-list").className = "seg-btn";
      document.getElementById("view-btn-shelf").className = "seg-btn active";
      document.getElementById("memories-list-container").style.display = "none";
      document.getElementById("whenshelf-container").style.display = "block";
      renderShelf();
    };

    // Тизер книжной полки внизу
    document.getElementById("bottom-whenshelf-teaser").onclick = function() {
      document.getElementById("view-btn-shelf").click();
      window.scrollTo(0, 0);
    };

    // Переключение режимов полки (По годам / По месяцам)
    document.getElementById("shelf-by-year").onclick = function() {
      shelfMode = "year";
      this.className = "shelf-mode-btn active";
      document.getElementById("shelf-by-month").className = "shelf-mode-btn";
      renderShelf();
    };

    document.getElementById("shelf-by-month").onclick = function() {
      shelfMode = "month";
      this.className = "shelf-mode-btn active";
      document.getElementById("shelf-by-year").className = "shelf-mode-btn";
      renderShelf();
    };

    // Сброс фильтра полки
    document.getElementById("btn-reset-shelf-filter").onclick = function() {
      activeShelfFilter = null;
      document.getElementById("shelf-active-filter-bar").style.display = "none";
      renderMemoriesList();
      document.getElementById("view-btn-list").click();
    };

    // Настроение в модалке воспоминания
    var moodButtons = document.querySelectorAll(".mood-choice");
    for (var j = 0; j < moodButtons.length; j++) {
      moodButtons[j].onclick = function() {
        for (var k = 0; k < moodButtons.length; k++) {
          moodButtons[k].className = "mood-choice";
        }
        this.className = "mood-choice active";
        selectedMood = this.getAttribute("data-mood");
      };
    }

    // Закрытие модалок
    document.getElementById("btn-close-memory-modal").onclick = function() {
      document.getElementById("modal-memory").style.display = "none";
    };
    document.getElementById("btn-close-reader").onclick = function() {
      document.getElementById("modal-reader").style.display = "none";
    };

    // Сохранение воспоминания
    document.getElementById("btn-save-memory").onclick = function() {
      saveMemoryFromModal();
    };

    // Удаление воспоминания
    document.getElementById("btn-delete-memory").onclick = function() {
      var editId = document.getElementById("memory-edit-id").value;
      if (editId && confirm("Удалить это воспоминание?")) {
        deleteMemory(editId);
        document.getElementById("modal-memory").style.display = "none";
        renderAll();
        showAlert("Воспоминание удалено");
      }
    };

    // Фото загрузка с компрессией под iPhone 4s
    document.getElementById("memory-photo-input").onchange = function(e) {
      var file = e.target.files[0];
      if (file) {
        compressImage(file, function(base64) {
          currentPhotoBase64 = base64;
          var prev = document.getElementById("memory-photo-preview");
          prev.src = base64;
          document.getElementById("memory-photo-preview-wrap").style.display = "block";
          document.getElementById("btn-remove-photo").style.display = "block";
        });
      }
    };

    document.getElementById("btn-remove-photo").onclick = function() {
      currentPhotoBase64 = "";
      document.getElementById("memory-photo-preview").src = "";
      document.getElementById("memory-photo-preview-wrap").style.display = "none";
      this.style.display = "none";
    };

    // Last.fm поиск топ-трека за выбранный день
    document.getElementById("btn-fetch-lastfm").onclick = function() {
      fetchLastFmTopTrack();
    };

    // Сохранение настроек
    document.getElementById("btn-save-settings").onclick = function() {
      appData.profile.name = document.getElementById("setting-profile-name").value || "Илюша";
      appData.profile.reminder_time = document.getElementById("setting-reminder-time").value || "21:00";
      appData.settings.lastfm_user = document.getElementById("setting-lastfm-user").value;
      appData.settings.lastfm_key = document.getElementById("setting-lastfm-key").value || "b25b959554ed76058ac220b0b2e13d21";
      saveDataToStorage();
      renderAll();
      showAlert("Настройки сохранены");
    };

    // Экспорт бэкапа в ZIP (или JSON-файл)
    document.getElementById("btn-export-zip").onclick = function() {
      exportJSONBackup();
    };

    // Импорт бэкапа через файл
    document.getElementById("input-import-zip").onchange = function(e) {
      var file = e.target.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function(evt) {
          try {
            var parsed = JSON.parse(evt.target.result);
            if (parsed.memories) {
              appData = parsed;
              saveDataToStorage();
              renderAll();
              showAlert("Бэкап успешно загружен!");
            } else {
              showAlert("Неверный формат бэкапа Whengram");
            }
          } catch (err) {
            showAlert("Ошибка чтения файла JSON");
          }
        };
        reader.readAsText(file);
      }
    };

    // Текстовый импорт/экспорт для iOS 6.1.3 буфера
    document.getElementById("btn-copy-manifest").onclick = function() {
      var ta = document.getElementById("backup-json-textarea");
      ta.value = JSON.stringify(appData, null, 2);
      ta.select();
      showAlert("Код скопирован в поле ниже");
    };

    document.getElementById("btn-import-manifest-text").onclick = function() {
      var text = document.getElementById("backup-json-textarea").value;
      try {
        var parsed = JSON.parse(text);
        if (parsed.memories) {
          appData = parsed;
          saveDataToStorage();
          renderAll();
          showAlert("Импорт выполнен успешно!");
        } else {
          showAlert("Ошибка: нет данных memories");
        }
      } catch (e) {
        showAlert("Ошибка JSON синтаксиса");
      }
    };

    // Поиск по воспоминаниям и вехам
    document.getElementById("memories-search-input").oninput = function() {
      renderMemoriesList();
    };
    document.getElementById("memories-mood-filter").onchange = function() {
      renderMemoriesList();
    };
  }

  // Переключение вкладок
  function switchTab(tabName) {
    currentTab = tabName;
    var views = document.querySelectorAll(".tab-view");
    for (var i = 0; i < views.length; i++) {
      views[i].className = "tab-view";
    }
    var target = document.getElementById("tab-_" + tabName) || document.getElementById("tab-" + tabName);
    if (target) target.className = "tab-view active";

    var tabButtons = document.querySelectorAll(".tab-item");
    for (var j = 0; j < tabButtons.length; j++) {
      if (tabButtons[j].getAttribute("data-tab") === tabName) {
        tabButtons[j].className = "tab-item active";
      } else {
        tabButtons[j].className = "tab-item";
      }
    }
    window.scrollTo(0, 0);
  }

  // Рендер всех блоков приложения
  function renderAll() {
    // Профиль
    document.getElementById("setting-profile-name").value = appData.profile.name || "Илюша";
    document.getElementById("setting-reminder-time").value = appData.profile.reminder_time || "21:00";
    document.getElementById("setting-lastfm-user").value = appData.settings.lastfm_user || "";
    document.getElementById("setting-lastfm-key").value = appData.settings.lastfm_key || "";
    document.getElementById("home-greeting-name").innerText = (appData.profile.name || "ИЛЮША").toUpperCase();

    renderHomeToday();
    renderWhenWeek();
    renderWhenLogCounters();
    renderMemoriesList();
  }

  // Получить сегодняшнюю дату в формате YYYY-MM-DD
  function getTodayDateString() {
    var d = new Date();
    var year = d.getFullYear();
    var month = d.getMonth() + 1;
    var day = d.getDate();
    return year + "-" + (month < 10 ? "0" + month : month) + "-" + (day < 10 ? "0" + day : day);
  }

  // Рендер главного экрана (сегодняшняя запись)
  function renderHomeToday() {
    var todayStr = getTodayDateString();
    var todayMem = null;
    for (var i = 0; i < appData.memories.length; i++) {
      if (appData.memories[i].date === todayStr) {
        todayMem = appData.memories[i];
        break;
      }
    }

    var promptCard = document.getElementById("home-prompt-card");
    var todayCard = document.getElementById("home-today-card");

    if (todayMem) {
      promptCard.style.display = "none";
      todayCard.style.display = "block";

      var moodEl = document.getElementById("today-card-mood");
      moodEl.innerText = "● " + getMoodName(todayMem.mood);
      moodEl.className = "mood-pill mood-" + (todayMem.mood || "positive");

      var photoWrap = document.getElementById("today-card-photo-wrap");
      if (todayMem.imageUri) {
        document.getElementById("today-card-photo").src = todayMem.imageUri;
        photoWrap.style.display = "block";
      } else {
        photoWrap.style.display = "none";
      }

      document.getElementById("today-card-text").innerText = todayMem.text;
      document.getElementById("today-card-time").innerText = formatTime(todayMem.created_at);

      // Кнопка редактирования сегодняшней записи
      document.getElementById("btn-edit-today").onclick = function() {
        openMemoryModal(todayMem);
      };

      // Проверка Last.fm трека в заметке
      renderLastFmInCard(todayMem.text, "today-lastfm-box");
    } else {
      promptCard.style.display = "block";
      todayCard.style.display = "none";
    }
  }

  // Полоска WHENWEEK (текущая неделя ПН-ВС)
  function renderWhenWeek() {
    var strip = document.getElementById("whenweek-strip");
    strip.innerHTML = "";

    var curr = new Date();
    var day = curr.getDay();
    var diff = curr.getDate() - day + (day === 0 ? -6 : 1); // Понедельник
    var monday = new Date(curr.setDate(diff));

    var daysShort = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
    var recordedCount = 0;
    var todayStr = getTodayDateString();

    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      var year = d.getFullYear();
      var month = d.getMonth() + 1;
      var dayNum = d.getDate();
      var dateStr = year + "-" + (month < 10 ? "0" + month : month) + "-" + (dayNum < 10 ? "0" + dayNum : dayNum);

      var hasMem = false;
      for (var m = 0; m < appData.memories.length; m++) {
        if (appData.memories[m].date === dateStr) {
          hasMem = true;
          recordedCount++;
          break;
        }
      }

      var slot = document.createElement("div");
      slot.className = "week-day-slot";
      if (dateStr === todayStr) slot.className += " is-today";
      if (hasMem) slot.className += " has-memory";

      slot.innerHTML =
        '<span class="week-day-name">' + daysShort[i] + '</span>' +
        '<span class="week-day-num">' + dayNum + '</span>' +
        '<span class="week-day-dot"></span>';

      (function(targetDate) {
        slot.onclick = function() {
          // Открыть создание или просмотр на эту дату
          var existing = null;
          for (var k = 0; k < appData.memories.length; k++) {
            if (appData.memories[k].date === targetDate) {
              existing = appData.memories[k];
              break;
            }
          }
          if (existing) {
            openReaderModal(existing);
          } else {
            openMemoryModal(null, targetDate);
          }
        };
      })(dateStr);

      strip.appendChild(slot);
    }

    document.getElementById("whenweek-count").innerText = "ЗАПИСАНО: " + recordedCount + " / 7";
  }

  // Механические счётчики WHENLOG (Flip-Clock)
  function renderWhenLogCounters() {
    var memCount = appData.memories.length;
    var evCount = appData.events.length;

    // Считаем номер дня в году для 2026
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    var diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
    var dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

    setFlipDigits("flip-memories", memCount);
    setFlipDigits("flip-events", evCount);
    setFlipDigits("flip-day-of-year", dayOfYear);
  }

  function setFlipDigits(containerId, number) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var str = "" + number;
    if (str.length === 1) str = "00" + str;
    else if (str.length === 2) str = "0" + str;

    var html = "";
    for (var i = 0; i < str.length; i++) {
      html += '<span class="flip-digit">' + str.charAt(i) + '</span>';
    }
    container.innerHTML = html;
  }

  // Рендер списка воспоминаний (вкладка Воспоминания)
  function renderMemoriesList() {
    var container = document.getElementById("memories-list-container");
    container.innerHTML = "";

    var query = document.getElementById("memories-search-input").value.toLowerCase();
    var moodFilter = document.getElementById("memories-mood-filter").value;

    var filtered = [];
    for (var i = 0; i < appData.memories.length; i++) {
      var m = appData.memories[i];
      var matchQuery = !query || m.text.toLowerCase().indexOf(query) !== -1 || m.date.indexOf(query) !== -1;
      var matchMood = moodFilter === "all" || (moodFilter === "photo" && m.imageUri) || m.mood === moodFilter;
      var matchShelf = !activeShelfFilter || m.date.indexOf(activeShelfFilter) === 0;

      if (matchQuery && matchMood && matchShelf) {
        filtered.push(m);
      }
    }

    // Сортируем от новых к старым
    filtered.sort(function(a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state-box"><p class="empty-sub">Воспоминаний пока нет</p></div>';
      return;
    }

    // Группируем по месяцам (например ОКТЯБРЬ 2026)
    var monthsMap = {};
    var monthNames = ["ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ", "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ"];

    for (var j = 0; j < filtered.length; j++) {
      var mem = filtered[j];
      var parts = mem.date.split("-");
      var yr = parts[0];
      var mo = parseInt(parts[1], 10) - 1;
      var key = yr + "-" + (mo < 10 ? "0" + mo : mo);
      var title = monthNames[mo] + " " + yr;

      if (!monthsMap[key]) {
        monthsMap[key] = { title: title, items: [] };
      }
      monthsMap[key].items.push(mem);
    }

    for (var keyName in monthsMap) {
      if (monthsMap.hasOwnProperty(keyName)) {
        var group = monthsMap[keyName];
        var groupDiv = document.createElement("div");
        groupDiv.className = "month-group";

        groupDiv.innerHTML =
          '<div class="month-group-header">' +
            '<span class="month-group-name">' + group.title + '</span>' +
            '<span class="month-group-count">' + group.items.length + ' ВОСП.</span>' +
          '</div>';

        for (var k = 0; k < group.items.length; k++) {
          var item = group.items[k];
          var rowCard = document.createElement("div");
          rowCard.className = "memory-row-card";

          var dateParts = item.date.split("-");
          var dayNum = dateParts[2];

          var thumbHtml = item.imageUri ? '<div class="memory-row-thumb"><img src="' + item.imageUri + '"></div>' : '';

          rowCard.innerHTML =
            '<div class="memory-row-date">' +
              '<span class="memory-day-num">' + dayNum + '</span>' +
              '<span class="memory-weekday-short">' + getWeekdayShort(item.date) + '</span>' +
            '</div>' +
            thumbHtml +
            '<div class="memory-row-body">' +
              '<p class="memory-row-text">' + escapeHtml(item.text) + '</p>' +
              getSongSnippetHtml(item.text) +
            '</div>';

          (function(mObj) {
            rowCard.onclick = function() {
              openReaderModal(mObj);
            };
          })(item);

          groupDiv.appendChild(rowCard);
        }
        container.appendChild(groupDiv);
      }
    }
  }

  // Рендер деревянной полки iBooks (WHENSHELF)
  function renderShelf() {
    var shelfContainer = document.getElementById("ibooks-wooden-shelf");
    shelfContainer.innerHTML = "";

    var groupMap = {};

    for (var i = 0; i < appData.memories.length; i++) {
      var m = appData.memories[i];
      var parts = m.date.split("-");
      var yr = parts[0];
      var mo = parts[1];

      var key = shelfMode === "year" ? yr : (yr + "-" + mo);
      if (!groupMap[key]) {
        groupMap[key] = { key: key, year: yr, month: mo, count: 0 };
      }
      groupMap[key].count++;
    }

    var keys = [];
    for (var k in groupMap) {
      if (groupMap.hasOwnProperty(k)) keys.push(k);
    }
    keys.sort().reverse(); // Свежие книги первыми

    if (keys.length === 0) {
      shelfContainer.innerHTML = '<div class="empty-state-box"><p class="empty-sub">Полка пока пуста</p></div>';
      return;
    }

    // Формируем ярусы по 3 книги на полке
    for (var tierIdx = 0; tierIdx < keys.length; tierIdx += 3) {
      var tierDiv = document.createElement("div");
      tierDiv.className = "ibooks-tier";

      for (var b = tierIdx; b < tierIdx + 3 && b < keys.length; b++) {
        var bookData = groupMap[keys[b]];
        var bookEl = document.createElement("div");

        // Чередуем стили переплётов (терракотовый, изумрудный, синий)
        var coverClass = "book-terracotta";
        if (b % 3 === 1) coverClass = "book-emerald";
        if (b % 3 === 2) coverClass = "book-navy";

        bookEl.className = "ibooks-book " + coverClass;

        if (shelfMode === "year") {
          bookEl.innerHTML =
            '<span class="book-year-title">' + bookData.year + '</span>' +
            '<span class="book-count-badge">' + bookData.count + ' ЗАПИСЕЙ</span>';
        } else {
          var monthNamesFull = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
          var moName = monthNamesFull[parseInt(bookData.month, 10) - 1] || bookData.month;
          bookEl.innerHTML =
            '<span class="book-year-title">' + bookData.year + '</span>' +
            '<span class="book-month-title">' + moName + '</span>' +
            '<span class="book-count-badge">' + bookData.count + ' ЗАП.</span>';
        }

        (function(filterKey, isYear) {
          bookEl.onclick = function() {
            activeShelfFilter = filterKey;
            document.getElementById("shelf-active-filter-bar").style.display = "block";
            document.getElementById("shelf-filter-title").innerText = "Книга: " + filterKey;
            document.getElementById("view-btn-list").click();
            renderMemoriesList();
          };
        })(bookData.key, shelfMode === "year");

        tierDiv.appendChild(bookEl);
      }
      shelfContainer.appendChild(tierDiv);
    }
  }

  // Модальное окно создания / редактирования воспоминания
  function openMemoryModal(memObj, presetDate) {
    var modal = document.getElementById("modal-memory");
    modal.style.display = "block";

    var dateInput = document.getElementById("memory-date-input");
    var textInput = document.getElementById("memory-text-input");
    var idInput = document.getElementById("memory-edit-id");
    var deleteWrap = document.getElementById("memory-delete-wrap");

    if (memObj) {
      idInput.value = memObj.id;
      dateInput.value = memObj.date;
      textInput.value = memObj.text;
      selectedMood = memObj.mood || "positive";
      currentPhotoBase64 = memObj.imageUri || "";

      if (currentPhotoBase64) {
        document.getElementById("memory-photo-preview").src = currentPhotoBase64;
        document.getElementById("memory-photo-preview-wrap").style.display = "block";
        document.getElementById("btn-remove-photo").style.display = "block";
      } else {
        document.getElementById("memory-photo-preview-wrap").style.display = "none";
        document.getElementById("btn-remove-photo").style.display = "none";
      }
      deleteWrap.style.display = "block";
    } else {
      idInput.value = "";
      dateInput.value = presetDate || getTodayDateString();
      textInput.value = "";
      selectedMood = "positive";
      currentPhotoBase64 = "";
      document.getElementById("memory-photo-preview-wrap").style.display = "none";
      document.getElementById("btn-remove-photo").style.display = "none";
      deleteWrap.style.display = "none";
    }

    // Обновляем визуальный выбор настроения
    var moodButtons = document.querySelectorAll(".mood-choice");
    for (var i = 0; i < moodButtons.length; i++) {
      if (moodButtons[i].getAttribute("data-mood") === selectedMood) {
        moodButtons[i].className = "mood-choice active";
      } else {
        moodButtons[i].className = "mood-choice";
      }
    }
    document.getElementById("memory-lastfm-preview").innerHTML = '<span class="lastfm-empty-hint">Нажми «Найти топ-трек» для интеграции с Last.fm</span>';
  }

  // Сохранение воспоминания из модалки
  function saveMemoryFromModal() {
    var id = document.getElementById("memory-edit-id").value;
    var dateVal = document.getElementById("memory-date-input").value;
    var textVal = document.getElementById("memory-text-input").value;

    if (!textVal.trim() && !currentPhotoBase64) {
      showAlert("Напишите хоть пару слов или добавьте фото");
      return;
    }

    // Проверяем, прикреплён ли трек Last.fm из полей
    var songTitle = document.getElementById("memory-song-title").value;
    var songArtist = document.getElementById("memory-song-artist").value;
    if (songTitle && songArtist) {
      textVal += "\n\n🎵 Саундтрек дня: " + songArtist + " — " + songTitle;
    }

    if (id) {
      // Редактирование существующей
      for (var i = 0; i < appData.memories.length; i++) {
        if (appData.memories[i].id === id) {
          appData.memories[i].date = dateVal;
          appData.memories[i].text = textVal;
          appData.memories[i].mood = selectedMood;
          appData.memories[i].imageUri = currentPhotoBase64;
          appData.memories[i].updated_at = new Date().toISOString();
          break;
        }
      }
    } else {
      // Новая запись
      var newMem = {
        id: generateUUID(),
        date: dateVal,
        text: textVal,
        mood: selectedMood,
        imageUri: currentPhotoBase64,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      appData.memories.push(newMem);
    }

    saveDataToStorage();
    document.getElementById("modal-memory").style.display = "none";
    renderAll();
    showAlert("Воспоминание сохранено!");
  }

  function deleteMemory(id) {
    var newList = [];
    for (var i = 0; i < appData.memories.length; i++) {
      if (appData.memories[i].id !== id) {
        newList.push(appData.memories[i]);
      }
    }
    appData.memories = newList;
    saveDataToStorage();
  }

  // Модальное окно чтения («Пережить заново»)
  function openReaderModal(memObj) {
    var modal = document.getElementById("modal-reader");
    modal.style.display = "block";

    document.getElementById("reader-weekday").innerText = getWeekdayFull(memObj.date) + " • " + formatTime(memObj.created_at);
    document.getElementById("reader-full-date").innerText = formatDateFull(memObj.date);
    document.getElementById("reader-day-of-year").innerText = "Запись Whengram";

    var moodEl = document.getElementById("reader-mood-badge");
    moodEl.innerText = "● " + getMoodName(memObj.mood);
    moodEl.className = "mood-pill mood-" + (memObj.mood || "positive");

    var photoWrap = document.getElementById("reader-photo-wrap");
    if (memObj.imageUri) {
      document.getElementById("reader-photo-img").src = memObj.imageUri;
      photoWrap.style.display = "block";
    } else {
      photoWrap.style.display = "none";
    }

    // Убираем из текста сырую строчку Last.fm, если она там есть, и выводим красиво через плеер
    var cleanText = memObj.text;
    var lastFmIndex = cleanText.indexOf("🎵 Саундтрек дня:");
    if (lastFmIndex !== -1) {
      cleanText = cleanText.substring(0, lastFmIndex).trim();
    }
    document.getElementById("reader-text-body").innerText = cleanText;

    renderLastFmInCard(memObj.text, "reader-lastfm-box");

    document.getElementById("btn-reader-edit").onclick = function() {
      modal.style.display = "none";
      openMemoryModal(memObj);
    };
  }

  // Интеграция с Last.fm API
  function fetchLastFmTopTrack() {
    var user = appData.settings.lastfm_user;
    var apiKey = appData.settings.lastfm_key || "b25b959554ed76058ac220b0b2e13d21";
    var dateVal = document.getElementById("memory-date-input").value;

    if (!user) {
      showAlert("Укажи свой ник Last.fm в Настройках!");
      switchTab("settings");
      return;
    }

    showAlert("Запрос топ-трека с Last.fm...");

    // Вычисляем таймстампы начала и конца выбранного дня
    var startDay = new Date(dateVal + "T00:00:00");
    var endDay = new Date(dateVal + "T23:59:59");
    var fromTs = Math.floor(startDay.getTime() / 1000);
    var toTs = Math.floor(endDay.getTime() / 1000);

    var url = "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=" + encodeURIComponent(user) +
              "&api_key=" + apiKey + "&from=" + fromTs + "&to=" + toTs + "&limit=50&format=json";

    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            var data = JSON.parse(xhr.responseText);
            var tracks = data.recenttracks && data.recenttracks.track;
            if (tracks) {
              if (!Array.isArray(tracks)) tracks = [tracks];
              if (tracks.length > 0) {
                var topTrack = tracks[0]; // Самый свежий/первый прослушанный за день
                var songName = topTrack.name;
                var artistName = topTrack.artist["#text"];
                var albumCover = "";
                if (topTrack.image && topTrack.image.length > 0) {
                  albumCover = topTrack.image[2]["#text"] || topTrack.image[0]["#text"];
                }

                document.getElementById("memory-song-title").value = songName;
                document.getElementById("memory-song-artist").value = artistName;

                document.getElementById("memory-lastfm-preview").innerHTML =
                  '<div class="lastfm-cassette">' +
                    '<div class="cassette-info" style="padding-right:0">' +
                      '<span class="cassette-badge">ТОП-ТРЕК ЗА ДЕНЬ</span>' +
                      '<span class="cassette-song">' + escapeHtml(songName) + '</span>' +
                      '<span class="cassette-artist">' + escapeHtml(artistName) + '</span>' +
                    '</div>' +
                  '</div>';
                showAlert("Трек успешно найден!");
                return;
              }
            }
            showAlert("За этот день скробблов на Last.fm не найдено");
          } catch (e) {
            showAlert("Ошибка обработки ответа Last.fm");
          }
        } else {
          showAlert("Ошибка соединения с Last.fm");
        }
      }
    };
    xhr.send();
  }

  // Отрисовка плеера Last.fm в карточке, если в тексте есть трек
  function renderLastFmInCard(text, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var marker = "🎵 Саундтрек дня:";
    var idx = text.indexOf(marker);
    if (idx !== -1) {
      var songLine = text.substring(idx + marker.length).trim();
      container.innerHTML =
        '<div class="cassette-cover-wrap">' +
          '<div class="cassette-vinyl-disc">&#9673;</div>' +
        '</div>' +
        '<div class="cassette-info">' +
          '<span class="cassette-badge">САУНДТРЕК ДНЯ</span>' +
          '<span class="cassette-song">' + escapeHtml(songLine) + '</span>' +
          '<span class="cassette-artist">Last.fm Scrobble</span>' +
        '</div>';
      container.style.display = "block";
    } else {
      container.style.display = "none";
    }
  }

  // Извлечение короткой строки трека для списка
  function getSongSnippetHtml(text) {
    var marker = "🎵 Саундтрек дня:";
    var idx = text.indexOf(marker);
    if (idx !== -1) {
      var songLine = text.substring(idx + marker.length).trim();
      return '<span class="memory-row-song">🎵 ' + escapeHtml(songLine) + '</span>';
    }
    return '';
  }

  // Авто-компрессор фотографий через Canvas под Retina экран iPhone 4s (экономия памяти)
  function compressImage(file, callback) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement("canvas");
        var MAX_WIDTH = 800;
        var MAX_HEIGHT = 800;
        var width = img.width;
        var height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        var dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Экспорт бэкапа в JSON файл
  function exportJSONBackup() {
    var jsonStr = JSON.stringify(appData, null, 2);
    var blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);

    var a = document.createElement("a");
    a.href = url;
    a.download = "whengram-backup-" + getTodayDateString() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showAlert("Бэкап скачан на устройство");
  }

  // Вспомогательные функции
  function getMoodName(mood) {
    if (mood === "neutral") return "РОВНО";
    if (mood === "negative") return "ТЯЖЕЛО";
    return "ХОРОШО";
  }

  function formatTime(isoStr) {
    if (!isoStr) return "21:00";
    var d = new Date(isoStr);
    var h = d.getHours();
    var m = d.getMinutes();
    return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
  }

  function formatDateFull(dateStr) {
    var parts = dateStr.split("-");
    var months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
    var moName = months[parseInt(parts[1], 10) - 1] || parts[1];
    return parseInt(parts[2], 10) + " " + moName + " " + parts[0] + " г.";
  }

  function getWeekdayShort(dateStr) {
    var days = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];
    var d = new Date(dateStr);
    return days[d.getDay()] || "";
  }

  function getWeekdayFull(dateStr) {
    var days = ["ВОСКРЕСЕНЬЕ", "ПОНЕДЕЛЬНИК", "ВТОРНИК", "СРЕДА", "ЧТВЕРГ", "ПЯТНИЦА", "СУББОТА"];
    var d = new Date(dateStr);
    return days[d.getDay()] || "";
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp.").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Всплывающее уведомление (HUD в стиле iOS 6)
  function showAlert(text) {
    var hud = document.getElementById("ios6-hud");
    var hudText = document.getElementById("ios6-hud-text");
    hudText.innerText = text;
    hud.style.display = "block";
    setTimeout(function() {
      hud.style.display = "none";
    }, 2200);
  }

})();
