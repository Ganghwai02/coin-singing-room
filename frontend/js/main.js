// [1. 상태 관리 데이터]
let userPlan = localStorage.getItem("userPlan") || "free";
let remainSongs = (userPlan === "premium") ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
let reservationQueue = [];
let currentVolume = 0;
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

// [차트 데이터]
let charts = [
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
let scoreInterval;
let mediaRecorder, audioChunks = [];

// [2. 페이지 로드]
window.onload = () => {
    const savedNick = localStorage.getItem("nickname");
    if (!savedNick) { window.location.href = "auth.html"; return; }
    
    document.getElementById("display-name").innerText = savedNick;
    renderCharts();
    updateUI();
    
    document.getElementById("main-search-input")?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") manualSearch();
    });
};

// [3. 기능 함수들]
function renderCharts() {
    const chartList = document.getElementById("chart-list");
    if(!chartList) return;
    chartList.innerHTML = charts.map((song, index) => {
        const isFav = favorites.includes(`${song.artist} ${song.title}`);
        return `
            <div class="chart-card">
                <div class="rank-num">${index + 1}</div>
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                </div>
                <div class="card-btns">
                    <span class="fav-icon" onclick="toggleFavorite('${song.artist} ${song.title}')" style="cursor:pointer; font-size:20px; margin-right:12px; vertical-align: middle;">
                        ${isFav ? '❤️' : '🤍'}
                    </span>
                    <button class="btn-direct" onclick="playNow('${song.artist} ${song.title}')" style="margin-right:5px; background:var(--ss-pink); color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold;">바로부르기</button>
                    <button class="btn-reserve" onclick="addToQueue('${song.artist} ${song.title}')" style="background:#444; color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer;">예약</button>
                </div>
            </div>
        `;
    }).join('');
}

// [혹시 playNow 함수가 없다면 이것도 추가해 주세요]
function playNow(name) {
    if (userPlan === "free" && remainSongs <= 0) return alert("😭 무료 곡을 모두 사용하셨습니다!");
    
    // 예약 목록 맨 앞에 넣고 바로 시작
    reservationQueue.unshift(name);
    startNextSong();
}

function renderFavorites() {
    const favList = document.getElementById("fav-list");
    if (!favList) return;

    if (favorites.length === 0) {
        favList.innerHTML = '<div style="color:#888; padding:20px;">아직 추가된 애창곡이 없습니다. ❤️를 눌러보세요!</div>';
        return;
    }

    // favorites 배열에는 "가수 제목" 문자열이 들어있으므로 이를 카드로 만듭니다.
    favList.innerHTML = favorites.map((songName) => {
        // "가수 제목" 형태를 분리해서 표시 (단순 표시용)
        const [artist, ...titleParts] = songName.split(' ');
        const title = titleParts.join(' ');

        return `
            <div class="chart-card">
                <div class="song-info">
                    <div class="song-title">${title || songName}</div>
                    <div class="song-artist">${artist}</div>
                </div>
                <div class="card-btns">
                    <span onclick="toggleFavorite('${songName}')" style="cursor:pointer; font-size:20px; margin-right:10px;">❤️</span>
                    <button class="btn-reserve" onclick="addToQueue('${songName}')">예약</button>
                </div>
            </div>
        `;
    }).join('');
}

// [애창곡 토글 기능]
function toggleFavorite(songName) {
    const index = favorites.indexOf(songName);
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(songName);
    }
    localStorage.setItem("favorites", JSON.stringify(favorites));
    renderCharts();
    renderFavorites(); // 즐겨찾기 탭도 업데이트
}

function addToQueue(name) {
    reservationQueue.push(name);
    updateQueueUI();
}

function updateQueueUI() {
    const list = document.getElementById("reserve-list");
    if (!list) return;
    list.innerHTML = reservationQueue.length === 0 
        ? '<div class="reserve-item">곡을 예약해주세요</div>' 
        : reservationQueue.map(s => `<div class="reserve-item">🎵 ${s}</div>`).join('');
}

// [4. 노래 시작 핵심 로직]
function startNextSong() {
    if (reservationQueue.length === 0) return alert("예약된 노래가 없습니다!");
    if (userPlan === "free" && remainSongs <= 0) return alert("😭 무료 곡을 모두 사용하셨습니다!");

    const song = reservationQueue.shift();
    if (userPlan === "free") { 
        remainSongs--; 
        localStorage.setItem("remainSongs", remainSongs); 
    }
    
    updateUI(); 
    updateQueueUI();
    
    document.getElementById("karaoke-view").style.display = "flex";

    if (userPlan === "free") {
        document.getElementById("yt-player").innerHTML = `
            <div id="ad-layer" style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#000; color:white;">
                <div style="border:3px solid var(--ss-pink); padding:30px; border-radius:20px; text-align:center;">
                    <div style="color:var(--ss-pink); font-weight:bold;">NOW LOADING...</div>
                    <div id="ad-timer" style="font-size:50px; font-weight:900; color:var(--ss-pink); margin:10px 0;">5</div>
                    <p>광고 후 노래가 시작됩니다.</p>
                </div>
            </div>
        `;

        let timeLeft = 5;
        const adInterval = setInterval(() => {
            timeLeft--;
            if(document.getElementById("ad-timer")) document.getElementById("ad-timer").innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(adInterval);
                loadYoutubeVideo(song);
            }
        }, 1000);
    } else {
        loadYoutubeVideo(song);
    }

    startVisualizer(); 
    setupScore();
}

function loadYoutubeVideo(song) {
    const searchQuery = encodeURIComponent(song + " 노래방");
    const youtubeSearchUrl = `https://www.youtube.com/embed/videoseries?listType=search&list=${searchQuery}&autoplay=1`;

    document.getElementById("yt-player").innerHTML = `
        <div style="width:100%; height:100%; position:relative; background:#000; border-radius:15px; overflow:hidden;">
            <div style="position:absolute; top:20px; right:20px; background:rgba(255, 0, 123, 0.8); color:white; padding:8px 15px; border-radius:12px; font-weight:bold; z-index:100; border:1px solid white; font-size:14px;">
                남은 곡: ${remainSongs}
            </div>
            
            <div style="position:absolute; top:0; width:100%; background:rgba(0,0,0,0.7); color:white; padding:8px; text-align:center; font-size:14px; z-index:10;">
                🎤 ${song}
            </div>
            
            <iframe src="${youtubeSearchUrl}" style="width:100%; height:100%; border:none;" allow="autoplay; encrypted-media" allowfullscreen></iframe>
            
            <div style="position:absolute; bottom:20px; right:20px; display:flex; gap:10px; z-index:20;">
                ${userPlan === 'premium' ? `
                    <button id="rec-btn" onclick="toggleRecording()" style="padding:10px 20px; background:red; color:white; border:none; border-radius:30px; cursor:pointer; font-weight:bold;">🔴 녹음 시작</button>
                    <button onclick="changeTheme()" style="padding:10px 20px; background:#444; color:white; border:none; border-radius:30px; cursor:pointer;">🎨 테마변경</button>
                ` : ''}
            </div>
        </div>
    `;
}

// [5. 점수 및 마이크 로직]
function setupScore() {
    currentScoreValue = 0; 
    if(scoreInterval) clearInterval(scoreInterval);
    scoreInterval = setInterval(() => {
        if (currentVolume > 30) {
            currentScoreValue += Math.floor(Math.random() * 5) + 1;
            if (currentScoreValue > 100) currentScoreValue = 100;
            // 노래 중엔 화면에 점수 갱신 안 함 (사용자 요청)
        }
    }, 1500);
}

function exitKaraoke() {
    document.getElementById("yt-player").innerHTML = "";
    clearInterval(scoreInterval);
    cancelAnimationFrame(animationId);
    if(audioCtx) { audioCtx.close(); audioCtx = null; }
    
    // 종료 버튼 누를 때 계산된 점수 전달
    showResult(currentScoreValue);
}

function showResult(score) {
    const scoreEl = document.getElementById("final-score");
    const modalEl = document.getElementById("score-modal");
    
    scoreEl.innerText = score;
    let comment = "아쉬운 실력이네요! 🔥";
    
    // 점수에 따른 화려한 연출
    if (score >= 90) {
        comment = "🎊 가수 데뷔하세요! 완벽한 무대였습니다! 🎊";
        modalEl.style.background = "rgba(125, 42, 232, 0.9)"; // 보라색 배경
        scoreEl.style.color = "#ff007b";
        scoreEl.style.textShadow = "0 0 30px white";
    } else if (score >= 80) {
        comment = "올~ 좀 치시는데요? 👍";
        modalEl.style.background = "rgba(0, 0, 0, 0.9)";
        scoreEl.style.color = "white";
    }

    document.getElementById("score-comment").innerText = comment;
    modalEl.style.display = "flex";
}

function closeScore() {
    document.getElementById("score-modal").style.display = "none";
    document.getElementById("karaoke-view").style.display = "none";
}

// [6. 유틸리티 함수들]
async function startVisualizer() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        analyser.fftSize = 64; 
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        canvas = document.getElementById("visualizer");
        canvasCtx = canvas.getContext("2d");

        function draw() {
            animationId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            currentVolume = sum / dataArray.length;

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            let x = 0;
            const barWidth = (canvas.width / dataArray.length) * 2.5;
            for(let i = 0; i < dataArray.length; i++) {
                let barHeight = dataArray[i] / 1.5;
                canvasCtx.fillStyle = currentVolume > 50 ? `rgb(255, 255, 0)` : getComputedStyle(document.documentElement).getPropertyValue('--ss-pink'); 
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 4, barHeight);
                x += barWidth;
            }
        }
        draw();
    } catch (err) { console.warn("마이크 접근 실패:", err); }
}

function updateUI() {
    const isPremium = (userPlan === "premium");
    const songEl = document.getElementById("remain-songs-val");
    if(songEl) songEl.innerText = isPremium ? "∞" : remainSongs;
}

function changeTab(el, tabId) {
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    el.classList.add('active');
    
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    const targetSection = document.getElementById('section-' + tabId);
    if(targetSection) targetSection.classList.add('active');

    // [추가] 애창곡 탭을 누를 때만 리스트를 새로 그립니다.
    if (tabId === 'favs') {
        renderFavorites();
    }
}

function manualSearch() {
    const input = document.getElementById("main-search-input");
    if (input.value.trim()) { addToQueue(input.value.trim()); input.value = ""; }
}

function doLogout() { if(confirm("로그아웃 하시겠습니까?")) { localStorage.removeItem("nickname"); window.location.href = "auth.html"; } }

async function toggleRecording() {
    const btn = document.getElementById("rec-btn");
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'SingStar_Rec.wav'; a.click();
            };
            mediaRecorder.start();
            btn.innerText = "⏹️ 중지/저장"; btn.style.background = "black";
        } catch (err) { alert("마이크 확인!"); }
    } else {
        mediaRecorder.stop(); btn.innerText = "🔴 녹음 시작"; btn.style.background = "red";
    }
}