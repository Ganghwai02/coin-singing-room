// [1. 상태 관리 데이터]
let userPlan = localStorage.getItem("userPlan") || "free";
let remainSongs = (userPlan === "premium") ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
let reservationQueue = [];
let currentVolume = 0;

// [차트 데이터]
let charts = [
    { title: "에피소드", artist: "이무진" },
    { title: "Love Wins All", artist: "아이유" },
    { title: "밤양갱", artist: "비비" },
    { title: "Hype Boy", artist: "NewJeans" },
    { title: "Seven", artist: "Jungkook" },
    { title: "첫 만남은 계획대로 되지 않아", artist: "TWS" },
    { title: "Super Lady", artist: "(여자)아이들" },
    { title: "To. X", artist: "태연" },
    { title: "Love 119", artist: "RIIZE" },
    { title: "Perfect Night", artist: "LE SSERAFIM" },
    { title: "Drama", artist: "aespa" },
    { title: "헤어지자 말해요", artist: "박재정" },
    { title: "I AM", artist: "IVE" },
    { title: "Ditto", artist: "NewJeans" },
    { title: "응급실", artist: "izi" },
    { title: "가시", artist: "버즈" },
    { title: "체념", artist: "빅마마" },
    { title: "소주 한 잔", artist: "임창정" },
    { title: "Welcome to the Show", artist: "DAY6" },
    { title: "한 페이지가 될 수 있게", artist: "DAY6" }
];

let audioCtx, analyser, dataArray, canvas, canvasCtx, animationId;
let scoreInterval;
let mediaRecorder, audioChunks = [];

// [2. 페이지 로드 시 실행]
window.onload = () => {
    const savedNick = localStorage.getItem("nickname");
    const savedPlan = localStorage.getItem("userPlan");
    if (!savedNick) { window.location.href = "auth.html"; return; }
    if (savedPlan) userPlan = savedPlan;

    const displayNameEl = document.getElementById("display-name");
    if(displayNameEl) displayNameEl.innerText = savedNick;
    
    renderCharts();
    updateUI();
    
    document.getElementById("main-search-input")?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") manualSearch();
    });
};

// [3. 차트 및 검색 기능]
function renderCharts() {
    const chartList = document.getElementById("chart-list");
    if(!chartList) return;
    chartList.innerHTML = charts.map((song, index) => `
        <div class="chart-card">
            <div class="rank-num">${index + 1}</div>
            <div class="song-info">
                <div class="song-title">${song.title}</div>
                <div class="song-artist">${song.artist}</div>
            </div>
            <div class="card-btns">
                <button class="btn-direct" onclick="playNow('${song.artist} ${song.title}')">바로부르기</button>
                <button class="btn-reserve" onclick="addToQueue('${song.artist} ${song.title}')">예약</button>
            </div>
        </div>
    `).join('');
}

function manualSearch() {
    const input = document.getElementById("main-search-input");
    const val = input.value.trim();
    if (val) {
        addToQueue(val);
        input.value = "";
        alert(`🎵 "${val}" 곡이 예약되었습니다!`);
    }
}

function addToQueue(name) {
    reservationQueue.push(name);
    updateQueueUI();
}

function playNow(name) {
    reservationQueue.unshift(name);
    updateQueueUI();
    startNextSong();
}

function updateQueueUI() {
    const list = document.getElementById("reserve-list");
    if (!list) return;
    list.innerHTML = reservationQueue.length === 0 
        ? '<div class="reserve-item">곡을 예약해주세요</div>' 
        : reservationQueue.map(s => `<div class="reserve-item">🎵 ${s}</div>`).join('');
}

// [4. 노래방 실행 핵심 로직]
function startNextSong() {
    if (reservationQueue.length === 0) return alert("예약된 노래가 없습니다!");
    
    const song = reservationQueue.shift();
    if (userPlan === "free") {
        if (remainSongs <= 0) return alert("😭 무료 곡을 모두 사용하셨습니다!");
        remainSongs--;
        localStorage.setItem("remainSongs", remainSongs);
    }
    
    updateUI();
    updateQueueUI();
    document.getElementById("karaoke-view").style.display = "flex";

    // 광고/준비 화면 먼저 표시
    document.getElementById("yt-player").innerHTML = `
        <div id="ready-layer" style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#111; color:white; text-align:center;">
            <h2 style="color:var(--ss-pink); margin-bottom:10px;">🎤 다음 곡 준비 완료!</h2>
            <p style="font-size:20px; font-weight:bold;">${song}</p>
            <div id="ad-timer" style="font-size:40px; margin:20px 0; color:var(--ss-pink);">5</div>
            <p style="color:#888;">잠시 후 노래 시작 버튼이 나타납니다.</p>
        </div>
    `;

    let timeLeft = 5;
    const adInterval = setInterval(() => {
        timeLeft--;
        const timerEl = document.getElementById("ad-timer");
        if(timerEl) timerEl.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(adInterval);
            showYoutubeLink(song); // 여기서 유튜브 버튼 표시
        }
    }, 1000);

    startVisualizer(); 
    setupScore();
}

// 영상을 새 창으로 연결하는 무적의 함수
function showYoutubeLink(song) {
    const searchQuery = encodeURIComponent(song + " 노래방");
    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;

    document.getElementById("yt-player").innerHTML = `
        <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#000; color:white; border-radius:15px; text-align:center; padding:30px;">
            <div style="font-size:24px; margin-bottom:20px; color:var(--ss-pink); font-weight:bold;">노래방 영상 준비 완료!</div>
            <p style="margin-bottom:30px; font-size:16px; line-height:1.6; color:#ccc;">
                저작권 보호를 위해 영상은 유튜브 새 창에서 실행됩니다.<br>
                <b>[유튜브에서 노래 시작]</b> 버튼 클릭 후, 노래를 부르세요!
            </p>
            
            <a href="${youtubeSearchUrl}" target="_blank" 
               style="text-decoration:none; background:#ff0000; color:white; padding:20px 50px; border-radius:50px; font-size:22px; font-weight:bold; transition:0.3s; box-shadow: 0 0 30px rgba(255,0,0,0.5);">
               📺 유튜브에서 노래 시작하기
            </a>

            <div style="margin-top:40px; display:flex; gap:10px;">
                ${userPlan === 'premium' ? `
                    <button id="rec-btn" onclick="toggleRecording()" style="padding:10px 20px; background:red; color:white; border:none; border-radius:30px; cursor:pointer;">🔴 녹음 시작</button>
                ` : ''}
                <button onclick="exitKaraoke()" style="padding:10px 20px; background:#444; color:white; border:none; border-radius:30px; cursor:pointer;">🎤 노래 종료/점수보기</button>
            </div>
        </div>
    `;
}

// [점수 및 부가 기능]
function setupScore() {
    let currentScore = 0;
    document.getElementById("live-score").innerText = "0";
    if(scoreInterval) clearInterval(scoreInterval);
    scoreInterval = setInterval(() => {
        if (currentVolume > 30) {
            const gain = Math.floor(Math.random() * 5) + 1;
            currentScore += gain;
            if (currentScore > 100) currentScore = 100;
            const scoreEl = document.getElementById("live-score");
            scoreEl.innerText = currentScore;
            scoreEl.style.transform = "scale(1.2)";
            setTimeout(() => scoreEl.style.transform = "scale(1)", 100);
        }
    }, 1500);
}

async function startVisualizer() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 64; 
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        canvas = document.getElementById("visualizer");
        canvasCtx = canvas.getContext("2d");

        function draw() {
            animationId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
            currentVolume = sum / bufferLength;

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            let x = 0;
            const barWidth = (canvas.width / bufferLength) * 2.5;
            for(let i = 0; i < bufferLength; i++) {
                let barHeight = dataArray[i] / 1.5;
                canvasCtx.fillStyle = currentVolume > 50 ? `rgb(255, 255, 0)` : getComputedStyle(document.documentElement).getPropertyValue('--ss-pink'); 
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 4, barHeight);
                x += barWidth;
            }
        }
        draw();
    } catch (err) { console.warn("마이크 접근 실패:", err); }
}

function exitKaraoke() {
    const finalScore = parseInt(document.getElementById("live-score").innerText);
    document.getElementById("yt-player").innerHTML = "";
    clearInterval(scoreInterval);
    cancelAnimationFrame(animationId);
    if(audioCtx) { audioCtx.close(); audioCtx = null; }
    showResult(finalScore);
}

function showResult(score) {
    document.getElementById("final-score").innerText = score;
    const scoreNum = parseInt(score);
    let comment = "아쉬운 실력이네요! 🔥";
    if (scoreNum === 100) comment = "🎊 대박! 100점입니다! 🎊";
    else if (scoreNum >= 90) comment = "가수급 실력이시네요! 🎙️";
    
    document.getElementById("score-comment").innerText = comment;
    document.getElementById("score-modal").style.display = "flex";
}

function closeScore() {
    document.getElementById("score-modal").style.display = "none";
    document.getElementById("karaoke-view").style.display = "none";
}

function updateUI() {
    const isPremium = (userPlan === "premium");
    const songEl = document.getElementById("remain-songs-val");
    if(songEl) songEl.innerText = isPremium ? "∞" : remainSongs;
}

function updateNickname() {
    const input = document.getElementById("edit-nickname");
    const newNick = input.value.trim();
    if(!newNick) return alert("닉네임을 입력해주세요!");
    localStorage.setItem("nickname", newNick);
    document.getElementById("display-name").innerText = newNick;
    alert("🚀 변경 완료!");
}

function doLogout() {
    localStorage.removeItem("nickname");
    window.location.href = "auth.html";
}