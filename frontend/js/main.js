// [1. 상태 관리]
let userPlan = localStorage.getItem("userPlan") || "free";
let remainSongs = (userPlan === "premium") ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
let reservationQueue = [];
let currentVolume = 0;
let scoreInterval, audioCtx, analyser, dataArray, canvas, canvasCtx, animationId;

// [데이터]
const charts = [
    { title: "에피소드", artist: "이무진" }, { title: "Love Wins All", artist: "아이유" },
    { title: "밤양갱", artist: "비비" }, { title: "Hype Boy", artist: "NewJeans" },
    { title: "Seven", artist: "Jungkook" }, { title: "Welcome to the Show", artist: "DAY6" },
    { title: "응급실", artist: "izi" }, { title: "가시", artist: "버즈" }
];

window.onload = () => {
    const savedNick = localStorage.getItem("nickname");
    if (!savedNick) { window.location.href = "auth.html"; return; }
    document.getElementById("display-name").innerText = savedNick;
    document.getElementById("edit-nickname").value = savedNick;
    
    renderCharts();
    updateUI();
};

// [탭 전환] - HTML의 'home', 'billing', 'profile'과 일치시킴
function changeTab(el, tabId) {
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    if(el) el.classList.add('active');

    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById('section-' + tabId);
    if(target) target.classList.add('active');
}

// [차트 렌더링]
function renderCharts() {
    const list = document.getElementById("chart-list");
    if(!list) return;
    list.innerHTML = charts.map((s, i) => `
        <div class="chart-card">
            <div class="rank-num">${i + 1}</div>
            <div class="song-info">
                <div class="song-title">${s.title}</div>
                <div class="song-artist">${s.artist}</div>
            </div>
            <div class="card-btns">
                <button class="btn-direct" onclick="playNow('${s.artist} ${s.title}')">바로부르기</button>
                <button class="btn-reserve" onclick="addToQueue('${s.artist} ${s.title}')">예약</button>
            </div>
        </div>
    `).join('');
}

function manualSearch() {
    const input = document.getElementById("main-search-input");
    if(input.value.trim()) {
        addToQueue(input.value.trim());
        input.value = "";
    }
}

function addToQueue(name) {
    reservationQueue.push(name);
    updateQueueUI();
}

function playNow(name) {
    reservationQueue.unshift(name);
    startNextSong();
}

function updateQueueUI() {
    const list = document.getElementById("reserve-list");
    list.innerHTML = reservationQueue.length === 0 ? "곡을 예약해주세요" : reservationQueue.map(s => `<div class="reserve-item">🎵 ${s}</div>`).join('');
}

// [노래 시작 로직]
function startNextSong() {
    if (reservationQueue.length === 0) return alert("예약된 노래가 없습니다!");
    if (userPlan === "free" && remainSongs <= 0) return alert("곡을 모두 사용하셨습니다.");

    const song = reservationQueue.shift();
    if (userPlan === "free") {
        remainSongs--;
        localStorage.setItem("remainSongs", remainSongs);
    }
    updateUI();
    updateQueueUI();
    document.getElementById("karaoke-view").style.display = "flex";
    
    // 유튜브 검색 링크 생성
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(song + " 노래방")}`;
    document.getElementById("yt-player").innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#111;">
            <h2 style="color:var(--ss-pink)">🎤 ${song}</h2>
            <a href="${url}" target="_blank" style="background:red; color:white; padding:20px 40px; border-radius:50px; text-decoration:none; font-weight:bold; margin-top:20px;">유튜브에서 노래 시작</a>
        </div>
    `;
    startVisualizer();
    setupScore();
}

// [점수 및 비주얼라이저]
function setupScore() {
    let currentScore = 0;
    scoreInterval = setInterval(() => {
        if (currentVolume > 50) {
            currentScore += (currentVolume > 80) ? 3 : 1;
            if(currentScore > 100) currentScore = 100;
            document.getElementById("live-score").innerText = currentScore;
        }
    }, 1000);
}

async function startVisualizer() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new AudioContext();
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
            for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
            currentVolume = sum / dataArray.length;
            canvasCtx.clearRect(0,0,canvas.width, canvas.height);
            canvasCtx.fillStyle = '#ff007b';
            dataArray.forEach((v, i) => canvasCtx.fillRect(i*12, canvas.height - v/2, 8, v/2));
        }
        draw();
    } catch(e) {}
}

function exitKaraoke() {
    const score = document.getElementById("live-score").innerText;
    clearInterval(scoreInterval);
    cancelAnimationFrame(animationId);
    if(audioCtx) audioCtx.close();
    document.getElementById("final-score").innerText = score;
    document.getElementById("score-modal").style.display = "flex";
}

function closeScore() {
    document.getElementById("score-modal").style.display = "none";
    document.getElementById("karaoke-view").style.display = "none";
}

function updateUI() {
    document.getElementById("remain-songs-val").innerText = remainSongs;
    document.getElementById("user-status").innerText = (userPlan === "premium") ? "💎 PREMIUM MEMBER" : "FREE MEMBER";
}

function updateNickname() {
    const newNick = document.getElementById("edit-nickname").value;
    localStorage.setItem("nickname", newNick);
    document.getElementById("display-name").innerText = newNick;
    alert("변경되었습니다!");
}

function doLogout() {
    localStorage.removeItem("nickname");
    window.location.href = "auth.html";
}