window.userPlan = localStorage.getItem("userPlan") || "free";
window.remainSongs = (window.userPlan === "premium") ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
window.reservationQueue = [];
window.favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

let currentAudio = null;
let currentVolume = 0;
let currentScoreValue = 0;
let currentKey = 0;
let audioCtx, analyser, dataArray, canvas, canvasCtx, animationId, scoreInterval;
let isClubOn = false;
let clubInterval = null;

const charts = [
    { title: "[TJ노래방] 에피소드 - 이무진", artist: "이무진" },
    { title: "[TJ노래방] Love wins all - IU", artist: "아이유" },
    { title: "[TJ노래방] 밤양갱 - 비비(BIBI)", artist: "비비" },
    { title: "[TJ노래방] Hype boy - NewJeans", artist: "NewJeans" },
    { title: "[TJ노래방] Seven(Clean Ver.) - 정국(Feat.Latto)", artist: "정국" },
    { title: "[TJ노래방  MR Live] 첫만남은계획대로되지않아 - TWS(투어스)", artist: "TWS" },
    { title: "[TJ노래방] Super Lady - (여자)아이들", artist: "(여자)아이들" },
    { title: "[TJ노래방] To. X - 태연(TAEYEON)", artist: "태연" },
    { title: "[TJ노래방] Love 119 - RIIZE", artist: "RIIZE" },
    { title: "[TJ노래방] Perfect Night - LE SSERAFIM(르세라핌)", artist: "LE SSERAFIM" },
    { title: "[TJ노래방] Drama - 에스파(aespa)", artist: "aespa" },
    { title: "[TJ노래방] 헤어지자말해요 - 박재정", artist: "박재정" },
    { title: "[TJ노래방] I AM - IVE(아이브)", artist: "IVE" },
    { title: "[TJ노래방] Ditto - NewJeans", artist: "NewJeans" },
    { title: "[TJ노래방] 응급실(쾌걸춘향OST) - izi", artist: "izi" },
    { title: "[TJ노래방] 가시 - 버즈", artist: "버즈" },
    { title: "[TJ노래방] 체념 - 빅마마", artist: "빅마마" },
    { title: "[TJ노래방] 소주한잔 - 임창정", artist: "임창정" },
    { title: "[TJ노래방] Welcome to the Show - 데이식스(DAY6)", artist: "DAY6" },
    { title: "[TJ노래방] 한페이지가될수있게 - 데이식스(DAY6)", artist: "DAY6" }
];

// [2. 초기화]
window.onload = () => {
    const savedNick = localStorage.getItem("nickname");
    if (!savedNick) { window.location.href = "auth.html"; return; }
    
    const displayEl = document.getElementById("display-name");
    if (displayEl) displayEl.innerText = savedNick;
    
    const editNickInput = document.getElementById("edit-nickname");
    if (editNickInput) editNickInput.value = savedNick;

    window.renderCharts();
    window.updateUI();
    window.updateQueueUI();
};

// [3. 탭 전환]
window.changeTab = function(el, tabName) {
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    if (el) el.classList.add('active');
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    const sectionId = tabName === 'home' ? 'section-home' : tabName === 'favs' ? 'section-favs' : tabName === 'billing' ? 'section-billing' : tabName === 'profile' ? 'section-profile' : '';
    const targetSection = document.getElementById(sectionId);
    if (targetSection) targetSection.classList.add('active');
    if (tabName === 'home') window.renderCharts();
    if (tabName === 'favs') window.renderFavorites();
};

// [4. 재생 시스템 및 파일 경로 로직]
window.playNow = function(name) {
    if (window.userPlan === "free" && window.remainSongs <= 0) return alert("😭 무료 곡을 모두 소진하셨습니다.");
    window.reservationQueue.unshift(name); // 가장 앞에 추가
    window.startNextSong();
};

window.startNextSong = function() {
    if (window.reservationQueue.length === 0) return alert("예약된 곡이 없습니다.");
    
    const songTitle = window.reservationQueue.shift();
    window.updateQueueUI();
    
    if (window.userPlan === "free" && window.remainSongs > 0) {
        window.remainSongs--;
        localStorage.setItem("remainSongs", window.remainSongs);
        window.updateUI();
    }

    currentKey = 0;
    const keyValEl = document.getElementById("key-val");
    if (keyValEl) keyValEl.innerText = "0";

    document.getElementById("karaoke-view").style.display = "flex";
    const ytContainer = document.getElementById("yt-player");
    const formattedRemain = (window.remainSongs === "∞") ? "∞곡" : window.remainSongs.toString().padStart(2, '0') + "곡";

    ytContainer.innerHTML = `
        <div class="karaoke-screen-wrapper" style="position:relative; width:100%; height:100%; background:#000;">
            <div style="position:absolute; top:0; left:0; width:100%; height:60px; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:space-between; padding:0 30px; z-index:1000;">
                <div style="color:white; display:flex; align-items:center;">
                    <span style="color:#00f2fe; font-weight:bold; margin-right:15px; font-size:18px;">PLAYING</span>
                    <span style="font-size:20px; font-weight:bold;">${songTitle}</span>
                </div>
                <div style="color:#ffe600; font-size:42px; font-weight:900;">${formattedRemain}</div>
            </div>
            <video id="main-video" autoplay style="width:100%; height:100%; object-fit:contain; background:#000;"></video>
            <div id="lyrics-layer" style="position:absolute; bottom:12%; left:0; width:100%; z-index:100; text-align:center;">
                <div id="current-lyric-text" style="font-size:32px; font-weight:bold; color:white; text-shadow: 2px 2px 5px #000;">🎤 노래 시작!</div>
            </div>
        </div>
    `;

    currentAudio = document.getElementById("main-video");
    
    // 파일명 유연하게 매칭 (띄어쓰기 2칸인 경우 등 대비)
    const base = songTitle.trim();
    const cleanBase = base.replace(/\s+/g, ' '); // 연속된 공백을 하나로

    const paths = [
        `mp4/${base} TJ Karaoke 720p.mp4`,
        `mp4/${cleanBase} TJ Karaoke 720p.mp4`,
        `mp4/${base} TJ Karaoke.mp4`,
        `mp4/${base}.mp4`
    ];

    let attempt = 0;
    const tryNext = () => {
        if (attempt < paths.length) {
            console.log("파일 시도 중:", paths[attempt]);
            currentAudio.src = paths[attempt];
            attempt++;
        } else {
            document.getElementById("current-lyric-text").innerHTML = `<span style="color:red">❌ 파일을 찾을 수 없습니다.</span><br><small style="font-size:14px; color:#ccc;">파일명 확인: ${base}</small>`;
        }
    };

    currentAudio.onerror = tryNext;
    tryNext();

    currentAudio.onended = () => window.exitKaraoke();
    window.startVisualizer();
    window.setupScore();
};

// [5. 추천 기능 수정]
window.luckyDraw = function() {
    const randomIndex = Math.floor(Math.random() * charts.length);
    const selected = charts[randomIndex];
    
    // 팝업 후 바로 노래 화면으로 넘어가도록 playNow 호출
    if(confirm(`🎲 추천곡: [ ${selected.title} ]\n지금 바로 부를까요?`)) { 
        window.playNow(selected.title); 
    } else {
        window.addToQueue(selected.title);
        alert("예약 목록에 추가되었습니다. ✅");
    }
};

// [6. UI 및 기능 나머지]
window.renderCharts = function() {
    const list = document.getElementById("chart-list");
    if(!list) return;
    list.innerHTML = charts.map((song, index) => {
        const isFav = window.favorites.includes(song.title);
        return `<div class="chart-card">
            <div class="rank-num">${index + 1}</div>
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-artist">${song.artist}</div>
            </div>
            <div class="card-btns">
                <span onclick="window.toggleFavorite('${song.title}')" style="cursor:pointer; font-size:20px; margin-right:10px;">${isFav ? '❤️' : '🤍'}</span>
                <button class="btn-direct" onclick="window.playNow('${song.title}')">부르기</button>
                <button class="btn-reserve" onclick="window.addToQueue('${song.title}')">예약</button>
            </div>
        </div>`;
    }).join('');
};

window.renderFavorites = function() {
    const list = document.getElementById("fav-list");
    if(!list) return;
    const favSongs = charts.filter(song => window.favorites.includes(song.title));
    if (favSongs.length === 0) {
        list.innerHTML = "<div style='color:#ccc; padding:50px; text-align:center;'>❤️ 애창곡이 비어있습니다.</div>";
        return;
    }
    list.innerHTML = favSongs.map(song => `
        <div class="chart-card">
            <div class="rank-num">⭐</div>
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-artist">${song.artist}</div>
            </div>
            <div class="card-btns">
                <span onclick="window.toggleFavorite('${song.title}')" style="cursor:pointer; font-size:20px; margin-right:10px;">❤️</span>
                <button class="btn-direct" onclick="window.playNow('${song.title}')">부르기</button>
                <button class="btn-reserve" onclick="window.addToQueue('${song.title}')">예약</button>
            </div>
        </div>`).join('');
};

window.upgradePlan = function() {
    if (window.userPlan === "premium") return alert("이미 프리미엄 멤버입니다! 💎");
    if (confirm("VIP 프리미엄으로 결제하시겠습니까?")) {
        window.userPlan = "premium";
        window.remainSongs = "∞";
        localStorage.setItem("userPlan", "premium");
        localStorage.setItem("remainSongs", "∞");
        window.updateUI();
        window.renderCharts();
        alert("프리미엄 결제 완료! 🎉");
    }
};

window.updateNickname = function() {
    const newNick = document.getElementById("edit-nickname").value.trim();
    if (!newNick) return alert("닉네임을 입력하세요.");
    localStorage.setItem("nickname", newNick);
    document.getElementById("display-name").innerText = newNick;
    alert("변경되었습니다! ✨");
};

window.doLogout = function() {
    if (confirm("로그아웃 하시겠습니까?")) {
        localStorage.removeItem("nickname");
        window.location.href = "auth.html";
    }
};

window.updateUI = function() {
    const songEl = document.getElementById("remain-songs-val");
    if (songEl) songEl.innerText = window.remainSongs;
    const statusEl = document.getElementById("user-status");
    if (statusEl) statusEl.innerText = (window.userPlan === "premium" ? "💎 PREMIUM MEMBER" : "FREE MEMBER");
};

window.updateQueueUI = function() {
    const list = document.getElementById("reserve-list");
    if (list) list.innerHTML = window.reservationQueue.length === 0 ? "" : window.reservationQueue.map((s, i) => `<div class="reserve-item">${i+1}. ${s}</div>`).join('');
};

window.addToQueue = function(name) {
    window.reservationQueue.push(name);
    window.updateQueueUI();
};

window.toggleFavorite = function(songName) {
    const index = window.favorites.indexOf(songName);
    if (index > -1) window.favorites.splice(index, 1); 
    else window.favorites.push(songName);
    localStorage.setItem("favorites", JSON.stringify(window.favorites));
    const favSection = document.getElementById("section-favs");
    if(favSection && favSection.classList.contains("active")) window.renderFavorites();
    else window.renderCharts();
};

window.changeKey = function(val) {
    currentKey += val;
    const keyValEl = document.getElementById("key-val");
    if (keyValEl) keyValEl.innerText = (currentKey > 0 ? "+" : "") + currentKey;
};

window.toggleClubMode = function() {
    const view = document.getElementById("karaoke-view");
    isClubOn = !isClubOn;
    if (isClubOn) {
        clubInterval = setInterval(() => {
            const color = ["#ff007b", "#7d2ae8", "#00f2fe", "#ffe600"][Math.floor(Math.random()*4)];
            view.style.boxShadow = `inset 0 0 100px ${color}`;
        }, 150);
    } else {
        clearInterval(clubInterval);
        view.style.boxShadow = "none";
    }
};

window.startVisualizer = async function() {
    try {
        if (!audioCtx) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;
            dataArray = new Uint8Array(analyser.frequencyBinCount);
        }
        canvas = document.getElementById("visualizer");
        if(canvas) {
            canvasCtx = canvas.getContext("2d");
            const draw = () => {
                animationId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(dataArray);
                let sum = 0; for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
                currentVolume = sum / dataArray.length;
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                for(let i = 0; i < dataArray.length; i++) {
                    canvasCtx.fillStyle = `hsl(${280 + i}, 100%, 50%)`;
                    canvasCtx.fillRect(i * 3, canvas.height - (dataArray[i]/2), 2, dataArray[i]/2);
                }
            };
            draw();
        }
    } catch (e) { console.log("마이크 연결 실패"); }
};

window.setupScore = function() {
    currentScoreValue = 0;
    if(scoreInterval) clearInterval(scoreInterval);
    scoreInterval = setInterval(() => { if (currentVolume > 40) currentScoreValue += 1; }, 1000);
};

window.exitKaraoke = function() {
    if(currentAudio) { currentAudio.pause(); currentAudio.src = ""; }
    if(isClubOn) window.toggleClubMode(); 
    document.getElementById("karaoke-view").style.display = "none";
    cancelAnimationFrame(animationId);
    window.showResult(currentScoreValue);
};

window.showResult = function(score) {
    const finalScoreEl = document.getElementById("final-score");
    const scoreModal = document.getElementById("score-modal");
    let displayScore = score < 50 ? score + 60 : (score > 100 ? 100 : score);
    if(finalScoreEl) finalScoreEl.innerText = displayScore;
    if(scoreModal) scoreModal.style.display = "flex";
};

window.closeScore = function() { document.getElementById("score-modal").style.display = "none"; };