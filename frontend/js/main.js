// [1. 전역 상태 관리]
window.userPlan = localStorage.getItem("userPlan") || "free";
window.remainSongs = (window.userPlan === "premium") ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
window.reservationQueue = [];
window.favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

let currentVolume = 0;
let currentScoreValue = 0;
let audioCtx, analyser, dataArray, canvasCtx, animationId, scoreInterval;
let ytPlayer; // 유튜브 API 인스턴스 저장용

// [데이터] 유튜브 ID 업데이트 완료
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

// [2. 초기화 및 외부 스크립트 로드]
window.onload = () => {
    // 유튜브 IFrame API 스크립트 동적 로드 (보안 우회 핵심)
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    const savedNick = localStorage.getItem("nickname") || "가수님";
    const displayEl = document.getElementById("display-name");
    const editNickInput = document.getElementById("edit-nickname");

    if (displayEl) displayEl.innerText = savedNick;
    if (editNickInput) editNickInput.value = savedNick;

    const saveBtn = document.querySelector("#section-profile button");
    if (saveBtn) saveBtn.onclick = window.saveNickname;

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

// [3. 유튜브 재생 시스템 - API 방식 적용]
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

    // API 방식용 레이아웃 생성
    ytContainer.innerHTML = `
        <div class="karaoke-screen-wrapper" style="position:relative; width:100%; height:100%; background:#000;">
            <div style="position:absolute; top:0; left:0; width:100%; height:60px; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:space-between; padding:0 30px; z-index:1000;">
                <div style="color:white; display:flex; align-items:center;">
                    <span style="color:#00f2fe; font-weight:bold; margin-right:15px;">PLAYING</span>
                    <span style="font-size:18px;">${songTitle}</span>
                </div>
                <div style="color:#ffe600; font-size:32px; font-weight:900;">${formattedRemain}</div>
            </div>
            
            <div id="player-api-target"></div>

            <div style="position:absolute; bottom:30px; right:30px; z-index:1000;">
                <button onclick="window.exitKaraoke()" style="background:#ff4b2b; color:white; border:none; padding:12px 24px; border-radius:30px; font-weight:bold; cursor:pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">노래 종료</button>
            </div>
        </div>
    `;

    // 유튜브 API를 사용하여 플레이어 생성 (보안 파라미터 최적화)
    ytPlayer = new YT.Player('player-api-target', {
        height: '100%',
        width: '100%',
        videoId: songData.youtubeId,
        playerVars: {
            'autoplay': 1,
            'controls': 0,
            'rel': 0,
            'enablejsapi': 1,
            'origin': window.location.origin
        },
        events: {
            'onReady': (event) => event.target.playVideo(),
            'onError': (e) => {
                console.error("재생 에러 발생:", e.data);
                if(e.data === 150 || e.data === 101) {
                    alert("이 영상은 임베딩이 차단되었습니다. 다른 주소로 접속하거나 배포가 필요합니다.");
                }
            }
        }
    });

    window.startVisualizer();
    window.setupScore();
};

// [4. 종료 로직]
window.exitKaraoke = function() {
    const ytContainer = document.getElementById("yt-player");
    if(ytPlayer && ytPlayer.destroy) ytPlayer.destroy(); // 플레이어 인스턴스 파괴
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