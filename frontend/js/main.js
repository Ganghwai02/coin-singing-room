// [1. 전역 상태 관리]
window.userPlan = localStorage.getItem("userPlan") || "free";
// ∞ 표시를 위해 숫자로 변환할 때 예외처리 추가
window.remainSongs = (window.userPlan === "premium") ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
window.reservationQueue = [];
window.favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

let currentVolume = 0;
let currentScoreValue = 0;
let audioCtx, analyser, dataArray, animationId, scoreInterval;
let ytPlayer = null;

// [데이터] 20곡 리스트
const charts = [
    { title: "[TJ노래방] 에피소드 - 이무진", artist: "이무진", youtubeId: "W8eMnbePtbQ" },
    { title: "[TJ노래방] Love wins all - IU", artist: "아이유", youtubeId: "L2vCogmqKQ0" },
    { title: "[TJ노래방] 밤양갱 - 비비(BIBI)", artist: "비비", youtubeId: "yckntxi09C8" },
    { title: "[TJ노래방] Hype boy - NewJeans", artist: "NewJeans", youtubeId: "nTL2KONavNQ" },
    { title: "[TJ노래방] Seven - 정국", artist: "정국", youtubeId: "i2nSERHnNzQ" },
    { title: "[TJ노래방] 첫만남은계획대로되지않아 - TWS", artist: "TWS", youtubeId: "lBz7gjy2lQA" },
    { title: "[TJ노래방] Super Lady - (여자)아이들", artist: "(여자)아이들", youtubeId: "7xRc1Gw3R8E" },
    { title: "[TJ노래방] To. X - 태연", artist: "태연", youtubeId: "HldgzA0cRTI" },
    { title: "[TJ노래방] Love 119 - RIIZE", artist: "RIIZE", youtubeId: "pbRbiJ2U43g" },
    { title: "[TJ노래방] Perfect Night - LE SSERAFIM", artist: "LE SSERAFIM", youtubeId: "HeBwNmCL9pg" },
    { title: "[TJ노래방] Drama - 에스파", artist: "aespa", youtubeId: "WwYWzXOL4aI" },
    { title: "[TJ노래방] 헤어지자말해요 - 박재정", artist: "박재정", youtubeId: "hEQyYQUOBMU" },
    { title: "[TJ노래방] I AM - IVE", artist: "IVE", youtubeId: "WACGS6_8lss" },
    { title: "[TJ노래방] Ditto - NewJeans", artist: "NewJeans", youtubeId: "OVwHRL3IUi8" },
    { title: "[TJ노래방] 응급실 - izi", artist: "izi", youtubeId: "QssOhIB5_g4" },
    { title: "[TJ노래방] 가시 - 버즈", artist: "버즈", youtubeId: "wukKia6CBMw" },
    { title: "[TJ노래방] 체념 - 빅마마", artist: "빅마마", youtubeId: "MMgr01eV_yo" },
    { title: "[TJ노래방] 소주한잔 - 임창정 (여자키)", artist: "임창정", youtubeId: "2ULrwTG1HNw" },
    { title: "[TJ노래방] Welcome to the Show - DAY6", artist: "DAY6", youtubeId: "egNlS05YrMg" },
    { title: "[TJ노래방] 한페이지가될수있게 - DAY6", artist: "DAY6", youtubeId: "J15TV9vUXmI" }
];

// [2. 유튜브 API 동적 로드]
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

window.onYouTubeIframeAPIReady = function() {
    console.log("✅ YouTube API 준비 완료");
};

// [3. 초기화 및 로그인 체크]
window.onload = () => {
    // 페이지 이동 없이 레이어만 조절
    const loginLayer = document.getElementById("login-layer");
    if (localStorage.getItem("isLoggedIn") === "true") {
        if (loginLayer) loginLayer.style.display = "none";
    }

    const savedNick = localStorage.getItem("nickname") || "가수님";
    const displayEl = document.getElementById("display-name");
    if (displayEl) displayEl.innerText = savedNick;

    window.renderCharts();
    window.updateUI();
    window.updateQueueUI();
};

// [로그인/로그아웃 시스템]
window.guestLogin = function() {
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("nickname", "게스트");
    // 곡이 없을 때만 기본 3곡 부여
    if(!localStorage.getItem("remainSongs")) {
        localStorage.setItem("remainSongs", 3);
    }
    location.reload(); 
};

window.doLogout = function() {
    if(confirm("로그아웃 하시겠습니까? 곡 수가 초기화됩니다.")) {
        localStorage.clear();
        location.reload();
    }
};

window.saveNickname = function() {
    const input = document.getElementById("edit-nickname");
    const newNick = input?.value.trim();
    if (!newNick) return alert("닉네임을 입력해 주세요!");
    localStorage.setItem("nickname", newNick);
    document.getElementById("display-name").innerText = newNick;
    alert("✨ 닉네임이 성공적으로 변경되었습니다!");
};

// [4. 재생 시스템]
window.playNow = function(name) {
    if (window.userPlan === "free" && window.remainSongs <= 0) {
        return alert("😭 무료 곡 소진! 로그아웃 후 다시 접속해서 충전하세요.");
    }
    window.reservationQueue.unshift(name);
    window.startNextSong();
};

window.startNextSong = function() {
    if (window.reservationQueue.length === 0) return alert("예약된 곡이 없습니다.");
    
    const songTitle = window.reservationQueue.shift();
    const songData = charts.find(s => s.title === songTitle);
    if (!songData) return;

    window.updateQueueUI();
    
    // 무료 요금제 곡 차감 로직
    if (window.userPlan === "free") {
        let currentSongs = parseInt(localStorage.getItem("remainSongs") || 0);
        if (currentSongs > 0) {
            currentSongs--;
            window.remainSongs = currentSongs;
            localStorage.setItem("remainSongs", currentSongs);
            window.updateUI();
        }
    }

    document.getElementById("karaoke-view").style.display = "flex";
    const ytContainer = document.getElementById("yt-player");
    ytContainer.innerHTML = '<div id="player-api-target"></div>';

    if (ytPlayer && ytPlayer.destroy) {
        try { ytPlayer.destroy(); } catch(e) {}
    }

    // 유튜브 플레이어 생성 (origin 자동 감지 적용)
    ytPlayer = new YT.Player('player-api-target', {
        height: '100%',
        width: '100%',
        videoId: songData.youtubeId,
        playerVars: {
            'autoplay': 1,
            'controls': 1, // 'Video unavailable' 해결을 위해 컨트롤 활성화
            'rel': 0,
            'enablejsapi': 1,
            'origin': window.location.origin // 주소 자동 감지 (중요!)
        },
        events: {
            'onReady': (event) => event.target.playVideo(),
            'onError': (e) => {
                console.error("YT Error:", e.data);
                if(e.data === 101 || e.data === 150) {
                    alert("이 영상은 외부 재생이 차단되었습니다. 다른 곡을 선택해 주세요!");
                    window.exitKaraoke();
                }
            }
        }
    });

    window.startVisualizer();
    window.setupScore();
};

// [5. 종료 및 부가 기능]
window.exitKaraoke = function() {
    if(ytPlayer && ytPlayer.destroy) ytPlayer.destroy();
    document.getElementById("karaoke-view").style.display = "none";
    cancelAnimationFrame(animationId);
    if(scoreInterval) clearInterval(scoreInterval);
    window.showResult(currentScoreValue);
};

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
    let displayScore = score < 10 ? Math.floor(Math.random()*15)+80 : Math.min(score + 85, 100);
    const scoreEl = document.getElementById("final-score");
    if (scoreEl) scoreEl.innerText = displayScore;
    const modal = document.getElementById("score-modal");
    if (modal) modal.style.display = "flex";
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