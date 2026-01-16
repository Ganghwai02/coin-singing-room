// [1. 상태 관리 데이터]
let userPlan = localStorage.getItem("userPlan") || "free";
let remainSongs = (userPlan === "premium") ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
let reservationQueue = [];
let currentVolume = 0;
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let currentScoreValue = 0;
let currentKey = 0; 

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
        if (isPremium) {
            userCard.style.background = "linear-gradient(135deg, #7d2ae8, #ff007b, #FFD700)";
            userCard.style.boxShadow = "0 10px 30px rgba(255, 215, 0, 0.3)";
        } else {
            userCard.style.background = "linear-gradient(135deg, #7d2ae8, #ff007b)";
            userCard.style.boxShadow = "0 15px 30px rgba(0,0,0,0.4)";
        }
    }
}

// [4. 기능 구현]

// 🎲 랜덤 추천
function luckyDraw() {
    const randomIndex = Math.floor(Math.random() * charts.length);
    const selected = charts[randomIndex];
    if(confirm(`🎲 추천곡: [ ${selected.artist} - ${selected.title} ]\n지금 바로 예약할까요?`)) {
        addToQueue(`${selected.artist} ${selected.title}`);
    }
}

// [결제 기능 연동 - 통합 버전]
function upgradePlan() {
    const IMP = window.IMP; 
    IMP.init("imp74433100"); // 포트원 테스트 가맹점 코드

    if(confirm("VIP 프리미엄(무제한 곡 이용)으로 업그레이드 하시겠습니까?")) {
        IMP.request_pay({
            pg: "html5_inicis", 
            pay_method: "card",
            merchant_uid: "order_" + new Date().getTime(),
            name: "SingStar VIP 프리미엄",
            amount: 9900, 
            buyer_email: "test@singstar.com",
            buyer_name: localStorage.getItem("nickname") || "사용자",
            buyer_tel: "010-1234-5678",
        }, function (rsp) {
            if (rsp.success) {
                localStorage.setItem("userPlan", "premium");
                userPlan = "premium";
                updateUI();
                alert("결제가 완료되었습니다! 이제 무제한으로 즐기세요! 🎙️✨");
                changeTab(document.querySelector('.nav-menu li:nth-child(3)'), 'billing');
            } else {
                alert("결제에 실패했습니다. 에러: " + rsp.error_msg);
            }
        });
    }
}

// 👤 닉네임 변경
function updateNickname() {
    const input = document.getElementById("edit-nickname");
    const newNick = input?.value.trim();
    if(!newNick) return alert("변경할 닉네임을 입력해주세요!");
    
    localStorage.setItem("nickname", newNick);
    document.getElementById("display-name").innerText = newNick;
    input.value = "";
    alert("닉네임이 성공적으로 변경되었습니다! ✨");
}

function manualSearch() {
    const input = document.getElementById("main-search-input");
    const val = input?.value.trim();
    if(val) {
        addToQueue(val);
        input.value = "";
    }
}

// [5. 차트 렌더링]
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

// [6. 노래방 실행 로직]
function playNow(name) {
    if (userPlan === "free" && remainSongs <= 0) return alert("😭 무료 곡을 모두 소진하셨습니다. 멤버십을 이용해보세요!");
    reservationQueue.unshift(name);
    startNextSong();
}

function addToQueue(name) {
    reservationQueue.push(name);
    updateQueueUI();
    if(reservationQueue.length === 1) alert(`'${name}' 예약 완료! '다음 곡 시작'을 눌러주세요.`);
}

function updateQueueUI() {
    const list = document.getElementById("reserve-list");
    if (!list) return;
    if (reservationQueue.length === 0) {
        list.innerHTML = '<div class="reserve-item" style="opacity:0.5; text-align:center;">예약된 노래가 없습니다.</div>';
    } else {
        list.innerHTML = reservationQueue.map((s, i) => `<div class="reserve-item">${i+1}. ${s}</div>`).join('');
    }
}

function startNextSong() {
    if (reservationQueue.length === 0) return alert("예약된 노래가 없습니다!");
    
    if (userPlan === "free") {
        let songs = parseInt(localStorage.getItem("remainSongs") || 3);
        if (songs <= 0) return alert("😭 무료 곡 소진!");
        songs--;
        localStorage.setItem("remainSongs", songs);
        remainSongs = songs;
    }

    const song = reservationQueue.shift();
    updateUI();
    updateQueueUI();
    
    document.getElementById("karaoke-view").style.display = "flex";
    
    if (userPlan === "free") {
        document.getElementById("yt-player").innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#111; color:white;">
                <p style="color:var(--ss-pink);">무료 회원은 광고 시청 후 시작됩니다.</p>
                <h1 id="ad-timer" style="font-size:80px;">5</h1>
            </div>`;
        let t = 5;
        const adInt = setInterval(() => {
            t--;
            if(document.getElementById("ad-timer")) document.getElementById("ad-timer").innerText = t;
            if(t <= 0) { clearInterval(adInt); loadYoutubeVideo(song); }
        }, 1000);
    } else {
        loadYoutubeVideo(song);
    }

    startVisualizer();
    setupScore();
}

function loadYoutubeVideo(song) {
    const q = encodeURIComponent(song + " 노래방");
    const ytContainer = document.getElementById("yt-player");
    if(ytContainer) {
        ytContainer.innerHTML = `
            <iframe id="yt-frame" 
                src="https://www.youtube.com/embed/videoseries?listType=search&list=${q}&autoplay=1&enablejsapi=1" 
                style="width:100%; height:100%; border:none;" 
                allow="autoplay; encrypted-media" 
                allowfullscreen></iframe>`;
    }
}

// [7. 특수 기능]
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
        alert("🌈 클럽 모드 가동!");
    }
}

function changeKey(val) {
    currentKey += val;
    const keyValEl = document.getElementById("key-val");
    if(keyValEl) keyValEl.innerText = (currentKey > 0 ? "+" : "") + currentKey;
}

// [8. 점수 및 시각화]
function setupScore() {
    currentScoreValue = 0;
    const liveScoreEl = document.getElementById("live-score");
    if(scoreInterval) clearInterval(scoreInterval);
    
    scoreInterval = setInterval(() => {
        if (currentVolume > 20) {
            currentScoreValue += Math.floor(Math.random() * 5) + 1;
            if (currentScoreValue > 100) currentScoreValue = 100;
            if (liveScoreEl) liveScoreEl.innerText = currentScoreValue;
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
        
        analyser.fftSize = 128;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        canvas = document.getElementById("visualizer");
        if(!canvas) return;
        canvasCtx = canvas.getContext("2d");
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        const draw = () => {
            animationId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            currentVolume = sum / dataArray.length;
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            const barWidth = (canvas.width / dataArray.length) * 2;
            let x = 0;
            for(let i = 0; i < dataArray.length; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height;
                canvasCtx.fillStyle = `hsl(${280 + (i * 2)}, 100%, 60%)`;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
                x += barWidth;
            }
        };
        draw();
    } catch (e) { console.error("마이크 연결 실패:", e); }
}

// [9. 종료 및 모달]
function exitKaraoke() {
    document.getElementById("yt-player").innerHTML = "";
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
    const commentEl = document.getElementById("score-comment");
    if(commentEl) {
        if(displayScore >= 90) commentEl.innerText = "가수 데뷔하셔도 되겠는데요? 🎤";
        else if(displayScore >= 70) commentEl.innerText = "와우! 정말 잘 부르시네요! 🔥";
        else commentEl.innerText = "즐거웠으면 된 거죠! 한 곡 더? 😊";
    }
}

function closeScore() {
    document.getElementById("score-modal").style.display = "none";
    document.getElementById("karaoke-view").style.display = "none";
    if(document.getElementById("live-score")) document.getElementById("live-score").innerText = "0";
    currentKey = 0; 
}

function changeTab(el, tabId) {
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    const targetSection = document.getElementById('section-' + tabId);
    if(targetSection) targetSection.classList.add('active');
    if(tabId === 'favs') renderFavorites();
}

function renderFavorites() {
    const favList = document.getElementById("fav-list");
    if(!favList) return;
    if(favorites.length === 0) {
        favList.innerHTML = `<p style="text-align:center; opacity:0.5; padding:50px;">아직 추가된 애창곡이 없습니다.</p>`;
        return;
    }
    favList.innerHTML = favorites.map(songName => {
        const parts = songName.split(' ');
        const artist = parts[0];
        const title = parts.slice(1).join(' ');
        return `
            <div class="chart-card">
                <div class="song-info">
                    <div class="song-title">${title}</div>
                    <div class="song-artist">${artist}</div>
                </div>
                <div class="card-btns">
                    <span onclick="toggleFavorite('${songName}')" style="cursor:pointer; font-size:20px; margin-right:12px;">❤️</span>
                    <button class="btn-direct" onclick="playNow('${songName}')">부르기</button>
                    <button class="btn-reserve" onclick="addToQueue('${songName}')">예약</button>
                </div>
            </div>`;
    }).join('');
}

function toggleFavorite(songName) {
    const index = favorites.indexOf(songName);
    if (index > -1) { favorites.splice(index, 1); } 
    else { favorites.push(songName); }
    localStorage.setItem("favorites", JSON.stringify(favorites));
    renderCharts();
    renderFavorites(); 
}

function doLogout() {
    if(confirm("정말 로그아웃 하시겠습니까?")) {
        localStorage.removeItem("nickname");
        window.location.href = "auth.html";
    }
}