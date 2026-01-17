let userPlan = localStorage.getItem("userPlan") || "free";
let remainSongs = (userPlan === "premium") ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
let reservationQueue = [];
let currentVolume = 0;
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let currentScoreValue = 0;
let currentKey = 0; 
let autoExitTimer; // 노래 종료 타이머

// [차트 데이터]
const charts = [
    { title: "에피소드", artist: "이무진" }, { title: "Love Wins All", artist: "아이유" },
    { title: "밤양갱", artist: "비비" }, { title: "Hype Boy", artist: "NewJeans" },
    { title: "Seven", artist: "Jungkook" }, { title: "첫 만남은 계획대로 되지 않아", artist: "TWS" },
    { title: "Super Lady", artist: "(여자)아이들" }, { title: "To. X", artist: "태연" },
    { title: "Love 119", artist: "RIIZE" }, { title: "Perfect Night", artist: "LE SSERAFIM" },
    { title: "Drama", artist: "aespa" }, { title: "헤어지자 말해요", artist: "박재정" },
    { title: "I AM", artist: "IVE" }, { title: "Ditto", artist: "NewJeans" },
    { title: "응급실", artist: "izi" }, { title: "가시", artist: "버즈" },
    { title: "체념", artist: "빅마마" }, { title: "소주 한 잔", artist: "임창정" },
    { title: "Welcome to the Show", artist: "DAY6" }, { title: "한 페이지가 될 수 있게", artist: "DAY6" }
];

let audioCtx, analyser, dataArray, canvas, canvasCtx, animationId;
let scoreInterval, clubModeInterval;

// [2. 페이지 초기화]
window.onload = () => {
    const savedNick = localStorage.getItem("nickname");
    if (!savedNick) { window.location.href = "auth.html"; return; }
    
    document.getElementById("display-name").innerText = savedNick;
    renderCharts();
    updateUI();
    updateQueueUI(); 
    
    const searchInput = document.getElementById("main-search-input");
    if(searchInput) {
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") manualSearch();
        });
    }
};

// [3. 핵심 UI 업데이트]
function updateUI() {
    userPlan = localStorage.getItem("userPlan") || "free";
    const isPremium = (userPlan === "premium");
    const statusEl = document.getElementById("user-status");
    const songEl = document.getElementById("remain-songs-val");
    const userCard = document.getElementById("user-card-ui");

    if (statusEl) {
        statusEl.innerText = isPremium ? "VIP PREMIUM MEMBER" : "FREE MEMBER";
        statusEl.style.color = isPremium ? "#FFD700" : "rgba(255, 255, 255, 0.8)";
    }
    if (songEl) {
        remainSongs = isPremium ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
        songEl.innerText = remainSongs;
    }
    if (userCard) {
        userCard.style.background = isPremium ? "linear-gradient(135deg, #7d2ae8, #ff007b, #FFD700)" : "linear-gradient(135deg, #7d2ae8, #ff007b)";
    }
}

// [4. 기능 버튼 복구 (랜덤추천, 키조절, 클럽모드)]

// 🎲 랜덤 추천 기능
function luckyDraw() {
    const randomIndex = Math.floor(Math.random() * charts.length);
    const selected = charts[randomIndex];
    if(confirm(`🎲 추천곡: [ ${selected.artist} - ${selected.title} ]\n지금 바로 예약할까요?`)) {
        addToQueue(`${selected.artist} ${selected.title}`);
    }
}

// 🎹 음정 키 조절 기능
function changeKey(val) {
    currentKey += val;
    const keyValEl = document.getElementById("key-val");
    if (keyValEl) {
        keyValEl.innerText = (currentKey > 0 ? "+" : "") + currentKey;
    }
}

// 🌈 클럽 조명 모드 기능
function toggleClubMode() {
    if (clubModeInterval) {
        clearInterval(clubModeInterval);
        clubModeInterval = null;
        document.body.style.background = "#0b0915";
    } else {
        clubModeInterval = setInterval(() => {
            const colors = ["#ff007b33", "#7d2ae833", "#00ffcc33", "#ffcc0033", "#0b0915"];
            document.body.style.background = colors[Math.floor(Math.random() * colors.length)];
        }, 300);
        alert("🌈 클럽 모드 가동! 즐겁게 노래하세요!");
    }
}

// [5. 노래방 실행 로직]
function playNow(name) {
    if (userPlan === "free" && remainSongs <= 0) return alert("😭 무료 곡 소진!");
    reservationQueue.unshift(name);
    startNextSong();
}

function startNextSong() {
    if (reservationQueue.length === 0) return alert("예약된 노래가 없습니다!");
    
    if (userPlan === "free") {
        let songs = parseInt(localStorage.getItem("remainSongs") || 3);
        if (songs <= 0) return alert("😭 무료 곡 소진!");
        songs--;
        localStorage.setItem("remainSongs", songs);
        remainSongs = songs;
        updateUI();
    }

    const song = reservationQueue.shift();
    updateQueueUI();
    
    document.getElementById("karaoke-view").style.display = "flex";
    
    const searchQuery = encodeURIComponent(song + " 노래방");
    const ytUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;

    const ytContainer = document.getElementById("yt-player");
    ytContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#161625; color:white; text-align:center; padding:20px;">
            <h2 style="color:#ff007b; margin-bottom:10px;">🎤 '${song}'</h2>
            <p style="opacity:0.8; font-size:14px; margin-bottom:20px;">저작권 보호를 위해 유튜브 새 창에서 노래를 틀어주세요.</p>
            <button onclick="window.open('${ytUrl}', '_blank')" 
                style="padding:15px 30px; background:#ff0000; color:white; border:none; border-radius:30px; font-weight:bold; cursor:pointer; font-size:18px;">
                📺 유튜브 열기
            </button>
            <button onclick="exitKaraoke()" style="margin-top:25px; background:none; border:1px solid #444; color:#666; cursor:pointer; padding:5px 10px; border-radius:5px; font-size:12px;">(노래가 끝났다면 여기를 클릭)</button>
        </div>
    `;

    // 🕒 3분 40초 후 자동 종료 설정
    if(autoExitTimer) clearTimeout(autoExitTimer);
    autoExitTimer = setTimeout(() => {
        if(document.getElementById("karaoke-view").style.display === "flex") {
            exitKaraoke(); 
        }
    }, 220000); 

    window.open(ytUrl, '_blank');
    startVisualizer();
    setupScore();
}

// [6. 점수 및 비주얼라이저]
function setupScore() {
    currentScoreValue = 0;
    if(scoreInterval) clearInterval(scoreInterval);
    scoreInterval = setInterval(() => {
        if (currentVolume > 45) { 
            const bonus = currentVolume > 70 ? 3 : 1; 
            currentScoreValue += Math.floor(Math.random() * 3) + bonus;
            if (currentScoreValue > 100) currentScoreValue = 100;
        }
    }, 1000);
}

async function startVisualizer() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 512;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        canvas = document.getElementById("visualizer");
        if(!canvas) return;
        canvasCtx = canvas.getContext("2d");

        const draw = () => {
            animationId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            let max = 0;
            for(let i = 0; i < dataArray.length; i++) if(dataArray[i] > max) max = dataArray[i];
            currentVolume = (max / 255) * 100; 

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            const barWidth = (canvas.width / dataArray.length) * 2.5;
            let x = 0;
            for(let i = 0; i < dataArray.length; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height;
                canvasCtx.fillStyle = `hsl(${280 + (i * 1.2)}, 100%, ${currentVolume > 15 ? 60 : 30}%)`;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
                x += barWidth;
            }
        };
        draw();
    } catch (e) { console.error("마이크 실패", e); }
}

// [7. 종료 로직]
function exitKaraoke() {
    if(autoExitTimer) clearTimeout(autoExitTimer);
    clearInterval(scoreInterval);
    if(clubModeInterval) { clearInterval(clubModeInterval); clubModeInterval = null; }
    document.body.style.background = "#0b0915";
    cancelAnimationFrame(animationId);
    if(audioCtx) audioCtx.close();
    showResult(currentScoreValue);
}

function showResult(score) {
    const finalScoreEl = document.getElementById("final-score");
    const scoreModal = document.getElementById("score-modal");
    let displayScore = score < 10 ? 0 : (score < 60 ? score + 40 : score);
    if(displayScore > 100) displayScore = 100;
    if(finalScoreEl) finalScoreEl.innerText = displayScore;
    if(scoreModal) scoreModal.style.display = "flex";
}

function closeScore() {
    document.getElementById("score-modal").style.display = "none";
    document.getElementById("karaoke-view").style.display = "none";
    currentKey = 0; // 키 초기화
    const keyValEl = document.getElementById("key-val");
    if(keyValEl) keyValEl.innerText = "0";
}

// [8. 기타 유틸리티]
function manualSearch() {
    const input = document.getElementById("main-search-input");
    const val = input?.value.trim();
    if(val) { addToQueue(val); input.value = ""; }
}

function addToQueue(name) {
    reservationQueue.push(name);
    updateQueueUI();
}

function updateQueueUI() {
    const list = document.getElementById("reserve-list");
    if (!list) return;
    list.innerHTML = reservationQueue.length === 0 ? 
        '<div class="reserve-item" style="opacity:0.5; text-align:center;">예약된 노래가 없습니다.</div>' : 
        reservationQueue.map((s, i) => `<div class="reserve-item">${i+1}. ${s}</div>`).join('');
}

function renderCharts() {
    const chartList = document.getElementById("chart-list");
    if(!chartList) return;
    chartList.innerHTML = charts.map((song, index) => {
        const songName = `${song.artist} ${song.title}`;
        const isFav = favorites.includes(songName);
        return `
            <div class="chart-card">
                <div class="rank-num">${index + 1}</div>
                <div class="song-info">
                    <div class="song-title" style="font-weight:bold;">${song.title}</div>
                    <div class="song-artist" style="font-size:12px; opacity:0.6;">${song.artist}</div>
                </div>
                <div class="card-btns">
                    <span onclick="toggleFavorite('${songName}')" style="cursor:pointer; font-size:20px; margin-right:12px;">
                        ${isFav ? '❤️' : '🤍'}
                    </span>
                    <button class="btn-direct" onclick="playNow('${songName}')">부르기</button>
                    <button class="btn-reserve" onclick="addToQueue('${songName}')">예약</button>
                </div>
            </div>`;
    }).join('');
}

function toggleFavorite(songName) {
    const index = favorites.indexOf(songName);
    if (index > -1) favorites.splice(index, 1); 
    else favorites.push(songName);
    localStorage.setItem("favorites", JSON.stringify(favorites));
    renderCharts();
    if(document.getElementById('section-favs').classList.contains('active')) renderFavorites();
}

function renderFavorites() {
    const favList = document.getElementById("fav-list");
    if(!favList) return;
    favList.innerHTML = favorites.length === 0 ? '<p style="text-align:center; opacity:0.5; padding:50px;">애창곡이 없습니다.</p>' : 
        favorites.map(songName => `<div class="chart-card"><div class="song-info"><div class="song-title">${songName}</div></div><div class="card-btns"><span onclick="toggleFavorite('${songName}')" style="cursor:pointer; font-size:20px; margin-right:12px;">❤️</span><button class="btn-direct" onclick="playNow('${songName}')">부르기</button></div></div>`).join('');
}

function changeTab(el, tabId) {
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById('section-' + tabId).classList.add('active');
    if(tabId === 'favs') renderFavorites();
}