(function() {
  var STORAGE_KEY = "whengram_ios6_leather_v2";

  var appData = null;
  var photoCache = {};
  var webSqlDb = null;
  
  var currentTab = "home";
  var selectedMood = "positive";
  var currentMemoryPhotoData = "";
  var currentEventPhotoData = "";
  var activeShelfFilter = null;

  var MONTHS_RU_UPPER = ["ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ", "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ"];
  var MONTHS_RU_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

  window.onload = function() {
    initWebSQL(function() {
      loadAppState();
      initEventListeners();
      renderAll();
    });
  };

  function initWebSQL(callback) {
    try {
      if (window.openDatabase) {
        webSqlDb = window.openDatabase("WhengramDB", "1.0", "Photos", 45 * 1024 * 1024);
        webSqlDb.transaction(function(tx) {
          tx.executeSql("CREATE TABLE IF NOT EXISTS photos (uri TEXT PRIMARY KEY, data TEXT)");
          tx.executeSql("SELECT uri, data FROM photos", [], function(tx2, res) {
            for (var i=0; i<res.rows.length; i++) photoCache[res.rows.item(i).uri] = res.rows.item(i).data;
            callback();
          }, function() { callback(); });
        });
      } else { callback(); }
    } catch(e) { callback(); }
  }

  function savePhotoToDB(uri, b64) {
    if (!uri || !b64) return;
    photoCache[uri] = b64;
    if (webSqlDb) webSqlDb.transaction(function(tx) { tx.executeSql("INSERT OR REPLACE INTO photos (uri, data) VALUES (?, ?)", [uri, b64]); });
  }
  function getPhoto(uri) { return photoCache[uri] || ""; }

  function loadAppState() {
    try { var r = localStorage.getItem(STORAGE_KEY); appData = r ? JSON.parse(r) : { memories:[], events:[], profile:{name:"Илюша"}, settings:{lastfm_user:""} }; } 
    catch(e) { appData = { memories:[], events:[], profile:{name:"Илюша"}, settings:{lastfm_user:""} }; }
    if (!appData.memories) appData.memories = [];
    if (!appData.events) appData.events = [];
    if (!appData.profile) appData.profile = { name:"Илюша" };
  }
  function saveAppState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); } catch(e) { showHud("Память заполнена!"); } }

  function initEventListeners() {
    // Безопасный клик по вкладкам (обход бага SVG в iOS 6)
    var tabs = document.querySelectorAll(".tab-btn");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener("touchstart", function(e) {
        var target = e.target;
        while(target && target.className && typeof target.className.indexOf === "function" && target.className.indexOf("tab-btn") === -1) {
          target = target.parentNode;
        }
        if (target && target.getAttribute) switchTab(target.getAttribute("data-tab"));
      }, false);
    }

    var btnNew = document.getElementById("navbar-btn-new");
    if (btnNew) btnNew.onclick = function() { currentTab === "events" ? openEventModal() : openMemoryModal(null); };
    
    var btnWrite = document.getElementById("btn-write-today");
    if (btnWrite) btnWrite.onclick = function() { openMemoryModal(null, getTodayISO()); };
    
    var btnQuickAdd = document.getElementById("whenweek-quick-add");
    if (btnQuickAdd) btnQuickAdd.onclick = function() { openMemoryModal(null, getTodayISO()); };

    var env = document.getElementById("on-this-day-widget");
    if (env) env.onclick = function() { var m = findMemory(this.getAttribute("data-target-date")); if (m) openReaderModal(m); };

    var tm = document.getElementById("btn-time-machine");
    if (tm) tm.onclick = function() {
      if (appData.memories.length === 0) return showHud("Пусто");
      openReaderModal(appData.memories[Math.floor(Math.random() * appData.memories.length)]);
    };

    // Настройки
    var btnSaveSet = document.getElementById("btn-save-settings");
    if (btnSaveSet) btnSaveSet.onclick = function() {
      appData.profile.name = document.getElementById("setting-profile-name").value || "Илюша";
      appData.settings.lastfm_user = document.getElementById("setting-lastfm-user").value;
      saveAppState(); renderAll(); showHud("Сохранено");
    };

    // Модалка записи
    document.getElementById("btn-close-memory-modal").onclick = function() { addClass(document.getElementById("modal-memory"), "hidden"); };
    document.getElementById("btn-save-memory").onclick = saveMemory;
    var mb = document.querySelectorAll(".mood-btn");
    for (var m=0; m<mb.length; m++) mb[m].onclick = function() {
      for(var k=0; k<mb.length; k++) removeClass(mb[k], "active");
      addClass(this, "active"); selectedMood = this.getAttribute("data-mood");
    };
    
    document.getElementById("memory-photo-input").onchange = function(e) {
      if (!e.target.files[0]) return;
      compress(e.target.files[0], function(b64) {
        currentMemoryPhotoData = b64;
        document.getElementById("memory-photo-preview").src = b64;
        removeClass(document.getElementById("memory-photo-preview"), "hidden");
        removeClass(document.getElementById("btn-remove-photo"), "hidden");
      });
    };
    document.getElementById("btn-remove-photo").onclick = function() {
      currentMemoryPhotoData = ""; addClass(document.getElementById("memory-photo-preview"), "hidden"); addClass(this, "hidden");
    };

    // JSONP Last.fm
    document.getElementById("btn-fetch-lastfm").onclick = fetchLastFmJSONP;

    // Читалка
    document.getElementById("btn-close-reader").onclick = function() { stopAudio(); addClass(document.getElementById("modal-reader"), "hidden"); };
    
    // Бэкапы (Текст)
    document.getElementById("btn-export-code").onclick = function() {
      var ta = document.getElementById("backup-json-textarea");
      ta.value = JSON.stringify(appData);
      showHud("Скопируй код выше");
    };
    document.getElementById("btn-import-code").onclick = function() {
      try {
        var d = JSON.parse(document.getElementById("backup-json-textarea").value);
        if (d.memories) { appData = d; saveAppState(); renderAll(); showHud("Загружено!"); }
      } catch(e) { showHud("Ошибка кода"); }
    };
  }

  function switchTab(tab) {
    currentTab = tab;
    var v = document.querySelectorAll(".tab-view"), b = document.querySelectorAll(".tab-btn");
    for(var i=0; i<v.length; i++) addClass(v[i], "hidden");
    for(var j=0; j<b.length; j++) removeClass(b[j], "active");
    removeClass(document.getElementById("tab-"+tab), "hidden");
    
    for(var k=0; k<b.length; k++) {
      if(b[k].getAttribute("data-tab") === tab) addClass(b[k], "active");
    }
    
    var t = document.getElementById("navbar-title"), btn = document.getElementById("navbar-btn-new"), cap = document.getElementById("navbar-btn-capsule");
    if(tab==="home"){ t.innerText="WHENGRAM"; removeClass(btn,"hidden"); removeClass(cap,"hidden"); }
    else if(tab==="memories"){ t.innerText="ВОСПОМИНАНИЯ"; removeClass(btn,"hidden"); addClass(cap,"hidden"); }
    else if(tab==="events"){ t.innerText="ВЕХИ"; removeClass(btn,"hidden"); addClass(cap,"hidden"); }
    else { t.innerText="НАСТРОЙКИ"; addClass(btn,"hidden"); addClass(cap,"hidden"); }
    window.scrollTo(0,0);
  }

  function renderAll() {
    var today = getTodayISO();
    document.getElementById("home-greeting-name").innerText = (appData.profile.name || "ИЛЮША").toUpperCase();
    
    var p = today.split("-");
    document.getElementById("home-current-date").innerText = getDayName(today) + ", " + parseInt(p[2],10) + " " + MONTHS_RU_UPPER[parseInt(p[1],10)-1] + " " + p[0] + " Г.";
    document.getElementById("home-day-number").innerText = "№ " + getDayOfYear(today);

    renderOnThisDay(today);

    var tMem = findMemory(today);
    var pCard = document.getElementById("home-prompt-card"), tCard = document.getElementById("home-today-card");
    if (tMem) {
      addClass(pCard, "hidden"); removeClass(tCard, "hidden");
      document.getElementById("today-card-mood").innerText = (tMem.mood==="negative"?"ТЯЖЕЛО":tMem.mood==="neutral"?"РОВНО":"ХОРОШО");
      var img = getPhoto(tMem.imageUri);
      if(img) { document.getElementById("today-card-photo").src=img; removeClass(document.getElementById("today-card-photo-wrap"), "hidden"); }
      else addClass(document.getElementById("today-card-photo-wrap"), "hidden");
      
      var sp = splitTextAndSong(tMem.text);
      document.getElementById("today-card-text").innerText = sp.txt;
      renderLFWidget(sp.song, "today-lastfm-box");
      document.getElementById("btn-edit-today").onclick = function(){ openMemoryModal(tMem); };
    } else {
      removeClass(pCard, "hidden"); addClass(tCard, "hidden");
    }

    renderCalendar(today);
    renderFlips(getDayOfYear(today));
    
    document.getElementById("setting-profile-name").value = appData.profile.name || "Илюша";
    document.getElementById("setting-lastfm-user").value = appData.settings.lastfm_user || "";
  }

  function renderOnThisDay(today) {
    var env = document.getElementById("on-this-day-widget");
    var mDay = today.substring(4);
    var y = parseInt(today.split("-")[0],10), f = null, a = 0;
    for(var i=0; i<appData.memories.length; i++) {
      if(appData.memories[i].date && appData.memories[i].date !== today && appData.memories[i].date.indexOf(mDay) !== -1) {
        f = appData.memories[i]; a = y - parseInt(f.date.split("-")[0],10); break;
      }
    }
    if (f) {
      env.setAttribute("data-target-date", f.date);
      document.getElementById("env-date-subtitle").innerText = a + " г. назад вы что-то записали...";
      removeClass(env, "hidden");
    } else addClass(env, "hidden");
  }

  function renderCalendar(today) {
    var s = document.getElementById("whenweek-strip"); s.innerHTML = "";
    var now = new Date(), dw = now.getDay(), df = now.getDate()-dw+(dw===0?-6:1), mon = new Date(now.getFullYear(), now.getMonth(), df);
    var l = ["П","В","С","Ч","П","С","В"], c = 0;
    document.getElementById("whenweek-month-label").innerText = "WHENWEEK • " + MONTHS_RU_UPPER[mon.getMonth()];
    for(var i=0; i<7; i++) {
      var d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate()+i), iso = dateToISO(d), m = findMemory(iso);
      if(m) c++;
      var btn = document.createElement("div");
      btn.className = "cal-square" + (iso===today?" is-today":"") + (m?" has-mem":"");
      btn.innerHTML = '<span class="cal-sq-day">'+l[i]+'</span><span class="cal-sq-num">'+d.getDate()+'</span><div class="cal-sq-dot"></div>';
      (function(ti, ex) { btn.onclick = function(){ if(ex) openReaderModal(ex); else openMemoryModal(null, ti); }; })(iso, m);
      s.appendChild(btn);
    }
    document.getElementById("whenweek-count").innerText = "ЗАПИСАНО: "+c+"/7";
  }

  function renderFlips(doy) {
    drawFlip("flip-memories", appData.memories.length); drawFlip("flip-events", appData.events.length); drawFlip("flip-day-of-year", doy);
  }
  function drawFlip(id, v) {
    var el = document.getElementById(id); if(!el) return;
    var s = ""+(v||0); while(s.length<3) s="0"+s; var h="";
    for(var i=0;i<s.length;i++) h+='<span class="flip-digit">'+s.charAt(i)+'</span>'; el.innerHTML=h;
  }

  function fetchLastFmJSONP() {
    var u = document.getElementById("setting-lastfm-user").value || appData.settings.lastfm_user;
    if(!u) return showHud("Укажите ник Last.fm");
    showHud("Ищем трек...");
    var iso = document.getElementById("memory-date-input").value || getTodayISO(), p = iso.split("-");
    var fTs = Math.floor(new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10), 0,0,0).getTime()/1000);
    var tTs = Math.floor(new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10), 23,59,59).getTime()/1000);
    var cb = "lf_" + new Date().getTime();
    
    window[cb] = function(r) {
      try{ delete window[cb]; }catch(e){}
      var l = r&&r.recenttracks&&r.recenttracks.track;
      if(!l) return showHud("Нет скробблов");
      if(!(l instanceof Array)) l=[l];
      var cnt={}, max=0, bst=null;
      for(var i=0;i<l.length;i++){
        var t=l[i], tn=(t.name||"").trim(), an=(t.artist&&(t.artist["#text"]||t.artist.name)||"").trim();
        if(!tn || (t["@attr"]&&t["@attr"].nowplaying==="true")) continue;
        var cv=(t.image&&t.image.length)?t.image[t.image.length-1]["#text"]:"";
        var k = an+"|"+tn;
        if(!cnt[k]) cnt[k]={a:an, t:tn, p:0, c:cv};
        cnt[k].p++; if(cnt[k].p>max) { max=cnt[k].p; bst=cnt[k]; }
      }
      if(!bst) return showHud("Нет скробблов");
      document.getElementById("memory-song-title").value = bst.t; document.getElementById("memory-song-artist").value = bst.a;
      document.getElementById("memory-song-plays").value = bst.p; document.getElementById("memory-song-cover").value = bst.c;
      document.getElementById("memory-lastfm-preview").innerHTML = '<div style="color:#d94e28;font-weight:bold;">ТОП-ТРЕК (↻ '+bst.p+')</div><div style="font-size:12px;color:#222;margin-top:2px;">'+escape(bst.a+" — "+bst.t)+'</div>';
      showHud("Трек найден!");
    };
    var scr = document.createElement("script");
    scr.src = "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user="+encodeURIComponent(u)+"&api_key=b25b959554ed76058ac220b0b2e13d21&from="+fTs+"&to="+tTs+"&limit=200&format=json&callback="+cb;
    document.body.appendChild(scr);
  }

  function renderLFWidget(song, cid) {
    var b = document.getElementById(cid); if(!b) return;
    if(!song || (!song.t && !song.a)) return addClass(b, "hidden");
    removeClass(b, "hidden");
    var c = song.c ? '<img src="'+song.c+'" style="width:100%;height:100%;object-fit:cover;">' : '<div style="line-height:38px;text-align:center;color:#ff6b3b;">&#9835;</div>';
    b.innerHTML = '<div class="lf-cover">'+c+'</div><div class="lf-info"><span class="lf-badge">САУНДТРЕК ДНЯ</span><span class="lf-title">'+escape(song.t)+'</span><span class="lf-artist">'+escape(song.a)+'</span></div><div class="lf-play-btn" id="'+cid+'_play">&#9654;</div>';
    var pB = document.getElementById(cid+"_play");
    if(pB) pB.onclick = function(e){ if(e&&e.stopPropagation)e.stopPropagation(); playiTunes(song, pB); };
  }

  function playiTunes(s, btn) {
    var au = document.getElementById("lastfm-audio-preview");
    if(!au.paused && au.getAttribute("data-k")===s.t) { au.pause(); btn.innerHTML="&#9654;"; return; }
    au.play(); btn.innerHTML="&#8987;";
    var cb = "it_"+new Date().getTime();
    window[cb] = function(r) {
      try{ delete window[cb]; }catch(e){}
      if(r&&r.results&&r.results.length>0&&r.results[0].previewUrl) {
        au.src = r.results[0].previewUrl; au.setAttribute("data-k", s.t); au.play();
        btn.innerHTML = "&#9632;"; au.onended = function(){ btn.innerHTML="&#9654;"; };
      } else { btn.innerHTML="&#9654;"; showHud("Не найдено в iTunes"); }
    };
    var scr = document.createElement("script");
    scr.src = "https://itunes.apple.com/search?term="+encodeURIComponent(s.a+" "+s.t)+"&media=music&limit=1&callback="+cb;
    document.body.appendChild(scr);
  }

  function stopAudio() { var a=document.getElementById("lastfm-audio-preview"); if(a&&!a.paused) a.pause(); }

  function splitTextAndSong(txt) {
    txt=txt||""; var m="🎵 Саундтрек дня:", i=txt.indexOf(m), s=null;
    if(i!==-1) {
      var l=txt.substring(i+m.length).trim(); txt=txt.substring(0,i).trim();
      var p=l.match(/\(прослушано:\s*(\d+)\s*раз\)/i), cl=l.replace(/\s*\(прослушано:\s*\d+\s*раз\)/i,""), pt=cl.split(" — ");
      s = { a:pt[0]||"Last.fm", t:pt.slice(1).join(" — ")||cl, p:p?p[1]:"", c:"" };
    }
    return { txt: txt, song: s };
  }

  function openMemoryModal(m, d) {
    removeClass(document.getElementById("modal-memory"), "hidden");
    var id=document.getElementById("memory-edit-id"), dt=document.getElementById("memory-date-input"), txt=document.getElementById("memory-text-input"), st=document.getElementById("memory-song-title"), sa=document.getElementById("memory-song-artist"), sp=document.getElementById("memory-song-plays"), sc=document.getElementById("memory-song-cover");
    if(m) {
      id.value=m.id; dt.value=m.date; selectedMood=m.mood||"positive";
      var p=splitTextAndSong(m.text); txt.value=p.txt;
      if(p.song){ st.value=p.song.t; sa.value=p.song.a; sp.value=p.song.p; sc.value=p.song.c; document.getElementById("memory-lastfm-preview").innerHTML='<div style="font-weight:bold;color:#d94e28">ТОП-ТРЕК</div><div style="font-size:12px;color:#222;">'+escape(p.song.a+" — "+p.song.t)+'</div>'; }
      currentMemoryPhotoData = getPhoto(m.imageUri); currentMemoryPhotoName = m.imageUri||"";
      if(currentMemoryPhotoData) { document.getElementById("memory-photo-preview").src=currentMemoryPhotoData; removeClass(document.getElementById("memory-photo-preview"), "hidden"); removeClass(document.getElementById("btn-remove-photo"), "hidden"); }
      removeClass(document.getElementById("memory-delete-wrap"), "hidden");
    } else {
      id.value=""; dt.value=d||getTodayISO(); txt.value=""; selectedMood="positive"; st.value=""; sa.value=""; sp.value=""; sc.value="";
      document.getElementById("memory-lastfm-preview").innerText="Трек не выбран";
      currentMemoryPhotoData=""; currentMemoryPhotoName="";
      addClass(document.getElementById("memory-photo-preview"), "hidden"); addClass(document.getElementById("btn-remove-photo"), "hidden"); addClass(document.getElementById("memory-delete-wrap"), "hidden");
    }
    var b=document.querySelectorAll(".mood-btn"); for(var j=0;j<b.length;j++) b[j].className=b[j].getAttribute("data-mood")===selectedMood?"mood-btn active":"mood-btn";
  }

  function saveMemory() {
    var id=document.getElementById("memory-edit-id").value, dt=document.getElementById("memory-date-input").value||getTodayISO(), txt=document.getElementById("memory-text-input").value.trim(), t=document.getElementById("memory-song-title").value.trim(), a=document.getElementById("memory-song-artist").value.trim();
    if(!txt && !currentMemoryPhotoData && !t) return showHud("Пусто");
    var fTxt = txt;
    if(t||a) { var pl=document.getElementById("memory-song-plays").value; fTxt = txt+(txt?"\n\n":"")+"🎵 Саундтрек дня: "+(a||"?")+" — "+(t||"?")+(pl?" (прослушано: "+pl+" раз)":""); }
    if(currentMemoryPhotoData) { if(!currentMemoryPhotoName) currentMemoryPhotoName="img_"+new Date().getTime()+".jpg"; savePhotoToDB(currentMemoryPhotoName, currentMemoryPhotoData); }
    var n = new Date().toISOString();
    if(id){ for(var i=0;i<appData.memories.length;i++){ if(appData.memories[i].id===id){ appData.memories[i].date=dt; appData.memories[i].text=fTxt; appData.memories[i].mood=selectedMood; appData.memories[i].imageUri=currentMemoryPhotoName; break; } } }
    else appData.memories.push({id:makeUUID(), text:fTxt, mood:selectedMood, date:dt, imageUri:currentMemoryPhotoName, created_at:n});
    saveAppState(); addClass(document.getElementById("modal-memory"), "hidden"); renderAll(); showHud("Сохранено!");
  }

  function openReaderModal(m) {
    removeClass(document.getElementById("modal-reader"), "hidden");
    var p = m.date.split("-"); document.getElementById("reader-full-date").innerText = parseInt(p[2],10)+" "+(MONTHS_RU_UPPER[parseInt(p[1],10)-1]||p[1])+" "+p[0]+" Г.";
    document.getElementById("reader-mood-badge").innerText = m.mood==="negative"?"ТЯЖЕЛО":m.mood==="neutral"?"РОВНО":"ХОРОШО";
    var img = getPhoto(m.imageUri);
    if(img){ document.getElementById("reader-photo-img").src=img; removeClass(document.getElementById("reader-photo-wrap"), "hidden"); }
    else addClass(document.getElementById("reader-photo-wrap"), "hidden");
    var sp = splitTextAndSong(m.text); document.getElementById("reader-text-body").innerText = sp.txt;
    renderLFWidget(sp.song, "reader-lastfm-box");
    document.getElementById("btn-reader-edit").onclick = function(){ stopAudio(); addClass(document.getElementById("modal-reader"), "hidden"); openMemoryModal(m); };
  }

  function compress(f, cb) {
    var r=new FileReader();
    r.onload=function(e){ var i=new Image(); i.onload=function(){ var c=document.createElement("canvas"), x=c.getContext("2d"), w=i.width, h=i.height, m=800; if(w>h&&w>m){h=Math.round(h*(m/w));w=m;} else if(h>=w&&h>m){w=Math.round(w*(m/h));h=m;} c.width=w; c.height=h; x.drawImage(i,0,0,w,h); cb(c.toDataURL("image/jpeg",0.8)); }; i.src=e.target.result; };
    r.readAsDataURL(f);
  }

  function findMemory(d) { for(var i=0;i<appData.memories.length;i++) if(appData.memories[i].date===d) return appData.memories[i]; return null; }
  function deleteMemoryById(id) { var n=[]; for(var i=0;i<appData.memories.length;i++) if(appData.memories[i].id!==id) n.push(appData.memories[i]); appData.memories=n; saveAppState(); }
  function getTodayISO() { var d=new Date(); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function dateToISO(d) { return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function pad(n) { return n<10?"0"+n:n; }
  function getDayOfYear(iso) { var p=iso.split("-"); return Math.floor((new Date(p[0],p[1]-1,p[2])-new Date(p[0],0,0))/864e5); }
  function getDayName(iso) { var p=iso.split("-"); return ["ВОСКРЕСЕНЬЕ","ПОНЕДЕЛЬНИК","ВТОРНИК","СРЕДА","ЧЕТВЕРГ","ПЯТНИЦА","СУББОТА"][new Date(p[0],p[1]-1,p[2]).getDay()]; }
  function escape(s) { return (""+s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function addClass(e,c) { if(e&&e.className.indexOf(c)===-1) e.className=(e.className+" "+c).trim(); }
  function removeClass(e,c) { if(e) e.className=e.className.replace(new RegExp("(\\s|^)"+c+"(\\s|$)","g")," ").trim(); }
  function makeUUID() { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==="x"?r:(r&0x3|0x8)).toString(16);}); }
  
  var ht=null;
  function showHud(m) { var h=document.getElementById("ios6-hud"); document.getElementById("ios6-hud-text").innerText=m; removeClass(h,"hidden"); if(ht) clearTimeout(ht); ht=setTimeout(function(){ addClass(h,"hidden"); }, 2000); }
})();
