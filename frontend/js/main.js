// [1. 상태 관리 데이터]
let userPlan = localStorage.getItem("userPlan") || "free";
let remainSongs = (userPlan === "premium") ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
let reservationQueue = [];
let currentVolume = 0;

// [차트 데이터 대폭 추가]
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
let mediaRecorder, audioChunks = []; // 녹음용 변수

// [2. 페이지 로드 시 실행]
window.onload = () => {
    const savedNick = localStorage.getItem("nickname");
    const savedPlan = localStorage.getItem("userPlan");
    
    if (!savedNick) {
        window.location.href = "auth.html";
        return; 
    }

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
            <button class="btn-reserve" onclick="addToQueue('${song.artist} ${song.title}')">예약</button>
        </div>
    `).join('');
}

function manualSearch() {
    const input = document.getElementById("main-search-input");
    const val = input.value.trim();
    if (val) {
        addToQueue(val);
        input.value = "";
        document.getElementById("search-suggestions").style.display = "none";
        alert(`🎵 "${val}" 곡이 예약되었습니다!`);
    } else {
        alert("검색어를 입력해주세요!");
    }
}

function showSuggestions(val) {
    const box = document.getElementById("search-suggestions");
    if (!val.trim()) { box.style.display = "none"; return; }
    const matches = charts.filter(s => s.title.includes(val) || s.artist.includes(val));
    if (matches.length > 0) {
        box.innerHTML = matches.map(s => `
            <div style="padding:15px; border-bottom:1px solid #333; cursor:pointer;" onclick="selectSong('${s.artist} ${s.title}')">
                <b style="color:var(--ss-pink)">${s.title}</b> - ${s.artist}
            </div>`).join('');
        box.style.display = "block";
    } else { box.style.display = "none"; }
}

function selectSong(name) {
    const input = document.getElementById("main-search-input");
    if(input) input.value = name;
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
    list.innerHTML = reservationQueue.length === 0 
        ? '<div class="reserve-item">곡을 예약해주세요</div>' 
        : reservationQueue.map(s => `<div class="reserve-item">🎵 ${s}</div>`).join('');
}

// [4. 노래방 실행 로직]
function startNextSong() {
    if (reservationQueue.length === 0) return alert("예약된 노래가 없습니다!");
    if (userPlan === "free" && remainSongs <= 0) {
        return alert("😭 오늘 준비된 곡을 모두 사용하셨습니다! 프리미엄으로 무제한 즐겨보세요.");
    }

    const song = reservationQueue.shift();
    if (userPlan === "free") {
        remainSongs--;
        localStorage.setItem("remainSongs", remainSongs);
    }
    
    updateUI();
    updateQueueUI();

    document.getElementById("karaoke-view").style.display = "flex";

    // 광고 및 로딩 레이어 처리
    if (userPlan === "free") {
        document.getElementById("yt-player").innerHTML = `
            <div id="ad-layer" style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:linear-gradient(135deg, #1a1a1a, #000); color:white; text-align:center;">
                <div style="border:3px solid var(--ss-pink); padding:30px; border-radius:20px; background:rgba(255,255,255,0.05); box-shadow: 0 0 30px rgba(255,0,123,0.3);">
                    <div style="font-size:18px; color:var(--ss-pink); margin-bottom:10px; font-weight:bold;">NOW LOADING...</div>
                    <h2 style="font-size:24px; margin-bottom:20px;">🎤 목소리를 가다듬어 주세요!</h2>
                    <div id="ad-timer" style="font-size:40px; font-weight:900; color:var(--ss-pink);">5</div>
                    <p style="margin-top:15px; color:#888;">무료 요금제는 광고 후 시작됩니다.</p>
                </div>
            </div>
        `;

        let timeLeft = 5;
        const adInterval = setInterval(() => {
            timeLeft--;
            const timerEl = document.getElementById("ad-timer");
            if(timerEl) timerEl.innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(adInterval);
                loadYoutubeVideo(song);
            }
        }, 1000);
    } else {
        loadYoutubeVideo(song); // 프리미엄은 즉시 실행
    }

    startVisualizer(); 
    setupScore();
}

function loadYoutubeVideo(song) {
    const searchQuery = encodeURIComponent(song + " 노래방");
    const youtubeSearchUrl = `https://www.youtube.com/embed/videoseries?listType=search&list=${searchQuery}`;

    document.getElementById("yt-player").innerHTML = `
        <div style="width:100%; height:100%; position:relative; background:#000; border-radius:15px; overflow:hidden; border:2px solid ${userPlan === 'premium' ? 'gold' : 'var(--ss-pink)'};">
            <div style="position:absolute; top:0; width:100%; background:rgba(0,0,0,0.7); color:white; padding:8px; text-align:center; font-size:14px; z-index:10;">
                ${userPlan === 'premium' ? '💎 PREMIUM HD MODE' : '🎵 FREE SD MODE'} : ${song}
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

// [녹음 기능]
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
                const a = document.createElement('a');
                a.href = url;
                a.download = 'SingStar_Recording.wav';
                a.click();
            };
            mediaRecorder.start();
            btn.innerText = "⏹️ 녹음 중지/저장";
            btn.style.background = "black";
        } catch (err) { alert("마이크 연결을 확인해주세요."); }
    } else {
        mediaRecorder.stop();
        btn.innerText = "🔴 녹음 시작";
        btn.style.background = "red";
    }
}

function changeTheme() {
    const colors = ["#ff007b", "#00ffcc", "#ffcc00", "#9900ff", "#ffffff"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    document.documentElement.style.setProperty('--ss-pink', randomColor);
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
    
    if (scoreNum === 100) {
        comment = "🎊 대박! 100점 보너스 1곡 추가! 🎊";
        if (userPlan === "free") { 
            remainSongs++; 
            localStorage.setItem("remainSongs", remainSongs);
            updateUI(); 
        }
        alert("🎆🎇 펑! 펑! 100점 축하드립니다! 🎇🎆");
        document.getElementById("final-score").style.color = "gold";
        document.getElementById("final-score").style.textShadow = "0 0 20px gold";
    } else if (scoreNum >= 90) comment = "가수급 실력이시네요! 🎙️";
    
    document.getElementById("score-comment").innerText = comment;
    document.getElementById("score-modal").style.display = "flex";
}

function closeScore() {
    document.getElementById("score-modal").style.display = "none";
    document.getElementById("karaoke-view").style.display = "none";
    document.getElementById("live-score").innerText = "0";
}

function updateUI() {
    const isPremium = (userPlan === "premium");
    const songEl = document.getElementById("remain-songs-val");
    if(songEl) songEl.innerText = isPremium ? "∞" : remainSongs;

    const premiumButtons = document.querySelectorAll(".btn-premium-only");
    premiumButtons.forEach(btn => {
        if (!isPremium) {
            btn.style.opacity = "0.5";
            btn.style.cursor = "not-allowed";
        } else {
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";
        }
    });
}

function changeTab(el, tabId) {
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    const targetSection = document.getElementById('section-' + tabId);
    if(targetSection) targetSection.classList.add('active');
}

function doLogout() {
    if(!confirm("로그아웃 하시겠습니까?")) return;
    localStorage.removeItem("nickname"); 
    window.location.href = "auth.html"; 
}

function upgradePlan() {
    if(confirm("VIP 연간권을 결제하시겠습니까?")) {
        userPlan = "premium";
        remainSongs = "∞";
        localStorage.setItem("userPlan", "premium"); 
        updateUI();
        alert("결제 완료! 이제 무제한입니다.");
    }
}

function updateNickname() {
    const input = document.getElementById("edit-nickname");
    if(!input) return;
    const newNick = input.value.trim();
    if(!newNick) return alert("닉네임을 입력해주세요!");
    localStorage.setItem("nickname", newNick);
    const displayNameEl = document.getElementById("display-name");
    if(displayNameEl) displayNameEl.innerText = newNick;
    input.value = "";
    alert("🚀 닉네임이 성공적으로 변경되었습니다!");
}