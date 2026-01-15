// [상태 관리 데이터]
let userPlan = "free";
let remainSongs = 3;
let reservationQueue = [];
let charts = [
    { title: "에피소드", artist: "이무진" },
    { title: "Love Wins All", artist: "아이유" },
    { title: "밤양갱", artist: "비비" },
    { title: "Hype Boy", artist: "NewJeans" },
    { title: "Seven", artist: "Jungkook" },
    { title: "첫 만남은 계획대로 되지 않아", artist: "TWS" }
];

let audioCtx, analyser, dataArray, canvas, canvasCtx, animationId;
let scoreInterval;

window.onload = () => {
    const savedNick = localStorage.getItem("nickname") || "아이유좋아용";
    document.getElementById("display-name").innerText = savedNick;
    renderCharts();
    updateUI();
};

// 1. 차트 & 검색 & 예약 로직 (기존과 동일)
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
            <button class="btn-reserve" onclick="addToQueue('${song.artist} ${song.title}')">예약</button>
        </div>
    `).join('');
}

function showSuggestions(val) {
    const box = document.getElementById("search-suggestions");
    if (!val.trim()) { box.style.display = "none"; return; }
    const matches = charts.filter(s => s.title.includes(val) || s.artist.includes(val));
    if (matches.length > 0) {
        box.innerHTML = matches.map(s => `<div style="padding:15px; border-bottom:1px solid #333; cursor:pointer;" onclick="selectSong('${s.artist} ${s.title}')"><b style="color:var(--ss-pink)">${s.title}</b> - ${s.artist}</div>`).join('');
        box.style.display = "block";
    } else { box.style.display = "none"; }
}

function selectSong(name) {
    document.getElementById("main-search-input").value = name;
    document.getElementById("search-suggestions").style.display = "none";
    addToQueue(name);
}

function addToQueue(name) {
    reservationQueue.push(name);
    updateQueueUI();
}

function updateQueueUI() {
    const list = document.getElementById("reserve-list");
    if (!list) return;
    list.innerHTML = reservationQueue.length === 0 ? '<div class="reserve-item">곡을 예약해주세요</div>' : reservationQueue.map(s => `<div class="reserve-item">🎵 ${s}</div>`).join('');
}

// 2. 노래방 실행 & 실시간 점수 로직
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
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            let x = 0;
            for(let i = 0; i < bufferLength; i++) {
                let barHeight = dataArray[i] / 1.5;
                canvasCtx.fillStyle = `rgb(255, 0, 123)`; 
                canvasCtx.fillRect(x, canvas.height - barHeight, (canvas.width / bufferLength) * 2.5 - 4, barHeight);
                x += (canvas.width / bufferLength) * 2.5;
            }
        }
        draw();
    } catch (err) { console.warn("마이크 실패", err); }
}

function startNextSong() {
    if (reservationQueue.length === 0) return alert("예약된 노래가 없습니다!");
    if (userPlan === "free" && remainSongs <= 0) return alert("곡이 부족합니다!");

    const song = reservationQueue.shift();
    if (userPlan === "free") remainSongs--;
    updateUI();
    updateQueueUI();

    document.getElementById("karaoke-view").style.display = "flex";
    document.getElementById("yt-player").innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(song + " 노래방")}&autoplay=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;

    startVisualizer(); 

    // 🔥 점수 체계 수정: 0 ~ 100점 사이로 나오도록
    let currentScore = 0;
    scoreInterval = setInterval(() => {
        if (currentScore < 95) {
            currentScore += Math.floor(Math.random() * 5); // 조금씩 상승
        } else if (currentScore < 100) {
            if(Math.random() > 0.8) currentScore = 100; // 80% 확률로 100점 도전
        }
        document.getElementById("live-score").innerText = currentScore;
    }, 2000);
}

// 3. 🏆 종료 및 보너스 핵심 로직
function exitKaraoke() {
    const finalScore = parseInt(document.getElementById("live-score").innerText);
    
    // 유튜브 중단
    document.getElementById("yt-player").innerHTML = "";
    
    // 각종 인터벌 및 오디오 정지
    clearInterval(scoreInterval);
    cancelAnimationFrame(animationId);
    if(audioCtx) { audioCtx.close(); audioCtx = null; }

    showResult(finalScore);
}

function showResult(score) {
    document.getElementById("final-score").innerText = score;
    const scoreNum = parseInt(score);
    let comment = "아쉬운 실력이네요! 🔥";
    
    // 🎁 100점 보너스 로직
    if (scoreNum === 100) {
        comment = "🎊 대박! 100점 보너스 1곡 추가! 🎊";
        if (userPlan === "free") {
            remainSongs++; // 곡 수 증가
            updateUI(); // 사이드바 즉시 업데이트
        }
        document.getElementById("final-score").style.color = "gold";
        document.getElementById("final-score").style.textShadow = "0 0 20px gold";
    } else if (scoreNum >= 90) {
        comment = "가수급 실력이시네요! 🎙️";
        document.getElementById("final-score").style.color = "white";
    } else {
        document.getElementById("final-score").style.color = "white";
    }

    document.getElementById("score-comment").innerText = comment;
    document.getElementById("score-modal").style.display = "flex";
}

// 4. 나머지 기능
function closeScore() {
    document.getElementById("score-modal").style.display = "none";
    document.getElementById("karaoke-view").style.display = "none";
    document.getElementById("live-score").innerText = "0";
}

function updateUI() {
    const songEl = document.getElementById("remain-songs-val");
    if(songEl) songEl.innerText = remainSongs;
    const statusEl = document.getElementById("user-status");
    if(statusEl) statusEl.innerText = userPlan.toUpperCase() + " MEMBER";
}

function changeTab(el, tabId) {
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById('section-' + tabId).classList.add('active');
}

function upgradePlan() {
    if(confirm("VIP 연간권을 결제하시겠습니까?")) {
        userPlan = "premium";
        remainSongs = "∞";
        updateUI();
        alert("결제 완료! 이제 무제한입니다.");
    }
}

function updateNickname() {
    const newNick = document.getElementById("edit-nickname").value;
    if(!newNick) return;
    localStorage.setItem("nickname", newNick);
    document.getElementById("display-name").innerText = newNick;
    alert("변경 완료!");
}

function changeKey(val) {
    const el = document.getElementById("key-val");
    let current = parseInt(el.innerText);
    current += val;
    if(current > 6) current = 6;
    if(current < -6) current = -6;
    el.innerText = current;
}