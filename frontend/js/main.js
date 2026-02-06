// [1. 전역 상태 관리]
window.userPlan = localStorage.getItem("userPlan") || "free";
window.remainSongs = (window.userPlan === "premium") ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
window.reservationQueue = [];
window.favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

let currentVolume = 0;
let currentScoreValue = 0;
let audioCtx, analyser, dataArray, canvasCtx, animationId, scoreInterval;

// [데이터] 유튜브 ID는 TJ 공식 채널의 퍼가기 허용 영상을 기준으로 업데이트되었습니다.
const charts = [
    { title: "[TJ노래방] 에피소드 - 이무진", artist: "이무진", youtubeId: "amXvAmZ_Y68" },
    { title: "[TJ노래방] Love wins all - IU", artist: "아이유", youtubeId: "JLeoJ4x8csg" },
    { title: "[TJ노래방] 밤양갱 - 비비(BIBI)", artist: "비비", youtubeId: "sMd5Elm_L90" },
    { title: "[TJ노래방] Hype boy - NewJeans", artist: "NewJeans", youtubeId: "11cta61wi0g" },
    { title: "[TJ노래방] Seven - 정국", artist: "정국", youtubeId: "UatZ99C0RMo" },
    { title: "[TJ노래방] 첫만남은계획대로되지않아 - TWS", artist: "TWS", youtubeId: "X_9T8V6yT_U" },
    { title: "[TJ노래방] Super Lady - (여자)아이들", artist: "(여자)아이들", youtubeId: "M10XqL9X0_4" },
    { title: "[TJ노래방] To. X - 태연", artist: "태연", youtubeId: "p_60_I7wT_c" },
    { title: "[TJ노래방] Love 119 - RIIZE", artist: "RIIZE", youtubeId: "wN6Y9u_3z60" },
    { title: "[TJ노래방] Perfect Night - LE SSERAFIM", artist: "LE SSERAFIM", youtubeId: "h_8I0D_X9-k" },
    { title: "[TJ노래방] Drama - 에스파", artist: "aespa", youtubeId: "0Ym6VfN6Gv0" },
    { title: "[TJ노래방] 헤어지자말해요 - 박재정", artist: "박재정", youtubeId: "7O29N6_uFfI" },
    { title: "[TJ노래방] I AM - IVE", artist: "IVE", youtubeId: "fM6RREuU_oU" },
    { title: "[TJ노래방] Ditto - NewJeans", artist: "NewJeans", youtubeId: "r_A9T7t-uI0" },
    { title: "[TJ노래방] 응급실 - izi", artist: "izi", youtubeId: "3X8yX_yN5sI" },
    { title: "[TJ노래방] 가시 - 버즈", artist: "버즈", youtubeId: "9V-j0_pM6uI" },
    { title: "[TJ노래방] 체념 - 빅마마", artist: "빅마마", youtubeId: "mXW9jN-3Rto" },
    { title: "[TJ노래방] 소주한잔 - 임창정", artist: "임창정", youtubeId: "R_4P_4z8P68" },
    { title: "[TJ노래방] Welcome to the Show - DAY6", artist: "DAY6", youtubeId: "K1yO1_9zC-U" },
    { title: "[TJ노래방] 한페이지가될수있게 - DAY6", artist: "DAY6", youtubeId: "h6D-4xRjK_0" }
];

// [2. 초기화 및 닉네임 강제 연결]
window.onload = () => {
    const savedNick = localStorage.getItem("nickname") || "가수님";
    const displayEl = document.getElementById("display-name");
    const editNickInput = document.getElementById("edit-nickname");

    if (displayEl) displayEl.innerText = savedNick;
    if (editNickInput) editNickInput.value = savedNick;

    // 중요: 닉네임 변경 버튼에 함수 직접 할당
    const saveBtn = document.querySelector("#section-profile button");
    if (saveBtn) {
        saveBtn.onclick = window.saveNickname;
    }

    window.renderCharts();
    window.updateUI();
    window.updateQueueUI();
};

window.saveNickname = function() {
    const input = document.getElementById("edit-nickname");
    const newNick = input?.value.trim();
    if (!newNick) return alert("닉네임을 입력해 주세요!");

    localStorage.setItem("nickname", newNick);
    const displayEl = document.getElementById("display-name");
    if (displayEl) displayEl.innerText = newNick;
    alert("✨ 닉네임이 성공적으로 변경되었습니다!");
};

// [3. 유튜브 재생 시스템 - 수정됨]
window.playNow = function(name) {
    if (window.userPlan === "free" && window.remainSongs <= 0) return alert("😭 무료 곡 소진!");
    window.reservationQueue.unshift(name);
    window.startNextSong();
};

window.startNextSong = function() {
    if (window.reservationQueue.length === 0) return alert("예약 목록이 비어 있습니다.");
    
    const songTitle = window.reservationQueue.shift();
    const songData = charts.find(s => s.title === songTitle);
    if (!songData) return alert("곡 데이터를 찾을 수 없습니다.");

    window.updateQueueUI();
    if (window.userPlan === "free" && window.remainSongs > 0) {
        window.remainSongs--;
        localStorage.setItem("remainSongs", window.remainSongs);
        window.updateUI();
    }

    document.getElementById("karaoke-view").style.display = "flex";
    const ytContainer = document.getElementById("yt-player");
    const formattedRemain = (window.remainSongs === "∞") ? "∞곡" : window.remainSongs.toString().padStart(2, '0') + "곡";

    // ✅ 핵심 수정: origin 파라미터 추가로 보안 에러 방지
    const currentOrigin = window.location.origin;
    ytContainer.innerHTML = `
        <div class="karaoke-screen-wrapper" style="position:relative; width:100%; height:100%; background:#000;">
            <div style="position:absolute; top:0; left:0; width:100%; height:60px; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:space-between; padding:0 30px; z-index:1000;">
                <div style="color:white; display:flex; align-items:center;">
                    <span style="color:#00f2fe; font-weight:bold; margin-right:15px;">PLAYING</span>
                    <span style="font-size:18px;">${songTitle}</span>
                </div>
                <div style="color:#ffe600; font-size:32px; font-weight:900;">${formattedRemain}</div>
            </div>
            <iframe id="main-player" 
                width="100%" height="100%" 
                src="https://www.youtube.com/embed/${songData.youtubeId}?autoplay=1&enablejsapi=1&rel=0&origin=${currentOrigin}" 
                frameborder="0" 
                allow="autoplay; encrypted-media" 
                allowfullscreen>
            </iframe>
            <div style="position:absolute; bottom:30px; right:30px; z-index:1000;">
                <button onclick="window.exitKaraoke()" style="background:#ff4b2b; color:white; border:none; padding:12px 24px; border-radius:30px; font-weight:bold; cursor:pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">노래 종료</button>
            </div>
        </div>
    `;

    window.startVisualizer();
    window.setupScore();
};

// [4. 종료 로직]
window.exitKaraoke = function() {
    const ytContainer = document.getElementById("yt-player");
    if(ytContainer) ytContainer.innerHTML = ""; 
    document.getElementById("karaoke-view").style.display = "none";
    cancelAnimationFrame(animationId);
    if(scoreInterval) clearInterval(scoreInterval);
    window.showResult(currentScoreValue);
};

// [5. UI 렌더링 및 기능들]
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
    list.innerHTML = favSongs.length === 0 ? "<div style='color:#ccc; padding:50px; text-align:center;'>❤️ 애창곡이 비어있습니다.</div>" : 
        favSongs.map(song => `
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

window.updateUI = function() {
    const songEl = document.getElementById("remain-songs-val");
    if (songEl) songEl.innerText = window.remainSongs;
};

window.updateQueueUI = function() {
    const list = document.getElementById("reserve-list");
    if (list) list.innerHTML = window.reservationQueue.map((s, i) => `<div class="reserve-item">${i+1}. ${s}</div>`).join('');
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
    window.renderCharts();
    window.renderFavorites();
};

window.setupScore = function() {
    currentScoreValue = 0;
    scoreInterval = setInterval(() => { if (currentVolume > 40) currentScoreValue += 1; }, 1000);
};

window.showResult = function(score) {
    const finalScoreEl = document.getElementById("final-score");
    const scoreModal = document.getElementById("score-modal");
    let displayScore = score < 20 ? Math.floor(Math.random()*15)+80 : Math.min(score + 75, 100);
    if(finalScoreEl) finalScoreEl.innerText = displayScore;
    if(scoreModal) scoreModal.style.display = "flex";
};

window.closeScore = function() { 
    document.getElementById("score-modal").style.display = "none"; 
};

window.startVisualizer = async function() {
    try {
        if (!audioCtx) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            dataArray = new Uint8Array(analyser.frequencyBinCount);
        }
        const draw = () => {
            animationId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            let sum = 0; for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
            currentVolume = sum / dataArray.length;
        };
        draw();
    } catch (e) { console.log("마이크 연결 실패"); }
};