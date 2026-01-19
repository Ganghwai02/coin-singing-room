let userPlan = localStorage.getItem("userPlan") || "free";
let remainSongs = (userPlan === "premium") ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
let reservationQueue = [];
let currentVolume = 0;
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let currentScoreValue = 0;
let currentKey = 0; 
let currentAudio = null; 
let audioCtx, analyser, dataArray, canvas, canvasCtx, animationId;
let scoreInterval;

// [전역 변수: 조명 제어용]
let isClubOn = false;
let clubInterval = null;

// [1. 차트 데이터]
const charts = [
    { title: "[TJ노래방] 에피소드 - 이무진", artist: "이무진" },
    { title: "[TJ노래방] Love wins all - IU", artist: "아이유" },
    { title: "[TJ노래방] 밤양갱 - 비비(BIBI)", artist: "비비" },
    { title: "[TJ노래방] Hype boy - NewJeans", artist: "NewJeans" },
    { title: "[TJ노래방] Seven(Clean Ver.) - 정국(Feat.Latto)", artist: "정국" },
    { title: "[TJ노래방  MR Live] 첫만남은계획대로되지않아 - TWS(투어스)", artist: "TWS" },
    { title: "[TJ노래방] Super Lady - (여자)아이들", artist: "(여자)아이들" },
    { title: "[TJ노래방] To. X - 태연(TAEYEON)", artist: "태연" },
    { title: "[TJ노래방] Love 119 - RIIZE", artist: "RIIZE" },
    { title: "[TJ노래방] Perfect Night - LE SSERAFIM(르세라핌)", artist: "LE SSERAFIM" },
    { title: "[TJ노래방] Drama - 에스파(aespa)", artist: "aespa" },
    { title: "[TJ노래방] 헤어지자말해요 - 박재정", artist: "박재정" },
    { title: "[TJ노래방] I AM - IVE(아이브)", artist: "IVE" },
    { title: "[TJ노래방] Ditto - NewJeans", artist: "NewJeans" },
    { title: "[TJ노래방] 응급실(쾌걸춘향OST) - izi", artist: "izi" },
    { title: "[TJ노래방] 가시 - 버즈", artist: "버즈" },
    { title: "[TJ노래방] 체념 - 빅마마", artist: "빅마마" },
    { title: "[TJ노래방] 소주한잔 - 임창정", artist: "임창정" },
    { title: "[TJ노래방] Welcome to the Show - 데이식스(DAY6)", artist: "DAY6" },
    { title: "[TJ노래방] 한페이지가될수있게 - 데이식스(DAY6)", artist: "DAY6" }
];

// [2. 가사 데이터베이스]
const songContent = {
    "[TJ노래방] 에피소드 - 이무진": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 13, text: "언제였을까 우리 처음 만난 날" }, { time: 18, text: "기억나니 그날의 공기" }] },
    "[TJ노래방] Love wins all - IU": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 15, text: "Dearest Darling 나의 그대" }, { time: 21, text: "나를 데려가 줄래" }] },
    "[TJ노래방] 밤양갱 - 비비(BIBI)": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 14, text: "떠나는 길에 니가 내게 말했지" }, { time: 18, text: "너는 바라는 게 너무나 많아" }] },
    "[TJ노래방] Hype boy - NewJeans": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 8, text: "Baby, got me looking so crazy" }] },
    "[TJ노래방] Seven(Clean Ver.) - 정국(Feat.Latto)": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 15, text: "Monday Tuesday Wednesday Thursday" }] },
    "[TJ노래방  MR Live] 첫만남은계획대로되지않아 - TWS(투어스)": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 10, text: "거울 속의 내 모습은 너무 어색해" }] },
    "[TJ노래방] Super Lady - (여자)아이들": { lyrics: [{ time: 0, text: "🎵 Super Lady - (여자)아이들" }, { time: 6, text: "Follow me, follow me, follow me" }] },
    "[TJ노래방] To. X - 태연(TAEYEON)": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 8, text: "처음 본 너의 그 눈빛이" }] },
    "[TJ노래방] Love 119 - RIIZE": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 10, text: "어디선가 본 것 같은 눈빛" }] },
    "[TJ노래방] Perfect Night - LE SSERAFIM(르세라핌)": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 7, text: "I'm not looking for a lover" }] },
    "[TJ노래방] Drama - 에스파(aespa)": { lyrics: [{ time: 0, text: "🎵 Drama-ma-ma-ma" }, { time: 9, text: "I bring, I bring all the Drama" }] },
    "[TJ노래방] 헤어지자말해요 - 박재정": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 18, text: "헤어지자 말해요 내가 먼저 말할게" }] },
    "[TJ노래방] I AM - IVE(아이브)": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 12, text: "다른 문을 열어 따라와" }] },
    "[TJ노래방] Ditto - NewJeans": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 15, text: "Stay in the middle Like you a little" }] },
    "[TJ노래방] 응급실(쾌걸춘향OST) - izi": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 20, text: "후회하고 있어요 우리 다투던 그날" }] },
    "[TJ노래방] 가시 - 버즈": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 15, text: "너 없는 지금도 눈부신 하늘과" }] },
    "[TJ노래방] 체념 - 빅마마": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 25, text: "행복해보여 난 네가 참 좋아" }] },
    "[TJ노래방] 소주한잔 - 임창정": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 22, text: "술이 한 잔 생각나는 밤" }] },
    "[TJ노래방] Welcome to the Show - 데이식스(DAY6)": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 12, text: "이게 우리의 시작이야" }] },
    "[TJ노래방] 한페이지가될수있게 - 데이식스(DAY6)": { lyrics: [{ time: 0, text: "🎵 간주 중" }, { time: 10, text: "솔직히 말할게 많이 기다려왔어" }] }
};

// [3. 페이지 초기화]
window.onload = () => {
    const savedNick = localStorage.getItem("nickname");
    if (!savedNick) { window.location.href = "auth.html"; return; }
    document.getElementById("display-name").innerText = savedNick;
    renderCharts();
    updateUI();
    updateQueueUI(); 
};

// [4. 내 정보 관리 및 로그아웃]
function updateNickname() {
    const nickInput = document.getElementById("edit-nickname");
    const newNick = nickInput ? nickInput.value.trim() : "";
    if (!newNick) return alert("변경할 닉네임을 입력해주세요!");
    localStorage.setItem("nickname", newNick);
    document.getElementById("display-name").innerText = newNick;
    alert("닉네임이 변경되었습니다!");
}

function doLogout() {
    if (confirm("안전하게 로그아웃 하시겠습니까?")) {
        localStorage.removeItem("nickname");
        window.location.href = "auth.html";
    }
}

// [5. 멤버십 결제]
function upgradePlan() {
    if (confirm("💎 프리미엄(무제한) 멤버십을 결제하시겠습니까?")) {
        localStorage.setItem("userPlan", "premium");
        userPlan = "premium";
        remainSongs = "∞";
        updateUI();
        alert("결제가 완료되었습니다! 이제 무제한으로 즐기세요.");
    }
}

// [6. 노래 재생 및 종료 로직]
function playNow(name) {
    if (userPlan === "free" && remainSongs <= 0) return alert("😭 무료 곡 소진!");
    reservationQueue.unshift(name);
    startNextSong();
}

function startNextSong() {
    if (reservationQueue.length === 0) return;
    
    if (userPlan === "free" && remainSongs > 0) {
        remainSongs--;
        localStorage.setItem("remainSongs", remainSongs);
        updateUI();
    }

    const songTitle = reservationQueue.shift();
    updateQueueUI();
    
    currentKey = 0;
    const keyValEl = document.getElementById("key-val");
    if (keyValEl) keyValEl.innerText = "0";

    document.getElementById("karaoke-view").style.display = "flex";
    
    const ytContainer = document.getElementById("yt-player");
    ytContainer.innerHTML = `
        <div id="lyrics-box" style="font-size: 36px; font-weight: bold; color: white; text-align: center; text-shadow: 0 0 15px #ff007b; height: 100%; display: flex; align-items: center; justify-content: center; padding: 20px;">
            🎤 노래 준비 중...
        </div>
        <div style="position:absolute; bottom:30px; width:80%; height:8px; background:rgba(255,255,255,0.1); border-radius:10px; left:10%;">
            <div id="song-progress-bar" style="width:0%; height:100%; background:linear-gradient(to right, #ff007b, #7d2ae8); border-radius:10px;"></div>
        </div>
    `;

    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    const fileName = `${songTitle}  TJ Karaoke.mp3`;
    currentAudio = new Audio(encodeURI(`mp3/${fileName}`));
    
    currentAudio.play().catch(e => {
        document.getElementById("lyrics-box").innerText = "파일을 찾을 수 없습니다.";
    });

    const lyricsBox = document.getElementById("lyrics-box");
    const data = songContent[songTitle];

    currentAudio.ontimeupdate = () => {
        const now = currentAudio.currentTime;
        if (data && data.lyrics) {
            const currentLyric = data.lyrics.reduce((prev, curr) => (curr.time <= now ? curr : prev));
            lyricsBox.innerText = currentLyric.text;
        }
        const progressBar = document.getElementById("song-progress-bar");
        if (progressBar) progressBar.style.width = (now / currentAudio.duration) * 100 + "%";
    };

    currentAudio.onended = () => exitKaraoke();
    startVisualizer();
    setupScore();
}

// [7. 음정(Key) 변경 함수]
function changeKey(val) {
    currentKey += val;
    const keyValEl = document.getElementById("key-val");
    if (keyValEl) {
        keyValEl.innerText = (currentKey > 0 ? "+" : "") + currentKey;
    }
    if (currentAudio) {
        currentAudio.playbackRate = 1 + (currentKey * 0.05); 
    }
}

// [8. 랜덤 추천(Lucky Draw) 함수]
function luckyDraw() {
    const randomIndex = Math.floor(Math.random() * charts.length);
    const selected = charts[randomIndex];
    if(confirm(`🎲 추천곡: [ ${selected.title} ]\n지금 바로 예약할까요?`)) {
        addToQueue(selected.title);
    }
}

// [9. 클럽 조명 및 종료 기능]
function toggleClubMode() {
    const view = document.getElementById("karaoke-view");
    isClubOn = !isClubOn;
    
    if (isClubOn) {
        clubInterval = setInterval(() => {
            const color = ["#ff007b", "#7d2ae8", "#00f2fe", "#ffe600"][Math.floor(Math.random()*4)];
            view.style.boxShadow = `inset 0 0 100px ${color}, 0 0 50px ${color}`;
            document.body.style.backgroundColor = color;
        }, 150);
    } else {
        clearInterval(clubInterval);
        view.style.boxShadow = "none";
        document.body.style.backgroundColor = "#0b0915";
    }
}

function exitKaraoke() {
    if(currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    if(isClubOn) toggleClubMode(); 
    
    document.getElementById("karaoke-view").style.display = "none";
    cancelAnimationFrame(animationId);
    showResult(currentScoreValue);
}

// [10. 애창곡 렌더링 함수 (추가)]
function renderFavorites() {
    const favList = document.getElementById("fav-list");
    if (!favList) return;

    if (favorites.length === 0) {
        favList.innerHTML = `<div style="text-align:center; padding:50px; color:#666;">❤️ 등록된 애창곡이 없습니다.<br>차트에서 하트를 눌러보세요!</div>`;
        return;
    }

    favList.innerHTML = favorites.map((songTitle) => {
        const songData = charts.find(c => c.title === songTitle) || { artist: "가수 정보 없음" };
        return `
            <div class="chart-card">
                <div class="song-info">
                    <div class="song-title">${songTitle}</div>
                    <div class="song-artist">${songData.artist}</div>
                </div>
                <div class="card-btns">
                    <span onclick="toggleFavorite('${songTitle}')" style="cursor:pointer; font-size:20px; margin-right:10px;">❤️</span>
                    <button class="btn-direct" onclick="playNow('${songTitle}')">부르기</button>
                    <button class="btn-reserve" onclick="addToQueue('${songTitle}')">예약</button>
                </div>
            </div>`;
    }).join('');
}

// [기타 UI 함수]
function renderCharts() {
    const chartList = document.getElementById("chart-list");
    if(!chartList) return;
    chartList.innerHTML = charts.map((song, index) => {
        const isFav = favorites.includes(song.title);
        return `<div class="chart-card"><div class="rank-num">${index + 1}</div><div class="song-info"><div class="song-title">${song.title}</div><div class="song-artist">${song.artist}</div></div><div class="card-btns"><span onclick="toggleFavorite('${song.title}')" style="cursor:pointer; font-size:20px; margin-right:10px;">${isFav ? '❤️' : '🤍'}</span><button class="btn-direct" onclick="playNow('${song.title}')">부르기</button><button class="btn-reserve" onclick="addToQueue('${song.title}')">예약</button></div></div>`;
    }).join('');
}

function updateUI() {
    const songEl = document.getElementById("remain-songs-val");
    if (songEl) songEl.innerText = remainSongs;
    const statusEl = document.getElementById("user-status");
    if (statusEl) statusEl.innerText = (userPlan === "premium" ? "💎 PREMIUM" : "FREE USER");
}

function updateQueueUI() {
    const list = document.getElementById("reserve-list");
    if (list) list.innerHTML = reservationQueue.length === 0 ? "예약된 노래가 없습니다." : reservationQueue.map((s, i) => `<div class="reserve-item">${i+1}. ${s}</div>`).join('');
}

function addToQueue(name) {
    reservationQueue.push(name);
    updateQueueUI();
}

function toggleFavorite(songName) {
    const index = favorites.indexOf(songName);
    if (index > -1) favorites.splice(index, 1); 
    else favorites.push(songName);
    
    localStorage.setItem("favorites", JSON.stringify(favorites));
    renderCharts();
    renderFavorites(); // 애창곡 목록도 즉시 새로고침
}

function changeTab(el, tabId) {
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById('section-' + tabId).classList.add('active');

    // 애창곡 탭을 누를 때 목록을 다시 그려줌
    if (tabId === 'favs') {
        renderFavorites();
    }
}

function setupScore() {
    currentScoreValue = 0;
    if(scoreInterval) clearInterval(scoreInterval);
    scoreInterval = setInterval(() => { if (currentVolume > 40) currentScoreValue += 1; }, 1000);
}

async function startVisualizer() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        canvas = document.getElementById("visualizer");
        if(canvas) {
            canvasCtx = canvas.getContext("2d");
            const draw = () => {
                animationId = requestAnimationFrame(draw);
                analyser.getByteFrequencyData(dataArray);
                let sum = 0; for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
                currentVolume = sum / dataArray.length;
                canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
                for(let i = 0; i < dataArray.length; i++) {
                    canvasCtx.fillStyle = `hsl(${280 + i}, 100%, 50%)`;
                    canvasCtx.fillRect(i * 3, canvas.height - (dataArray[i]/2), 2, dataArray[i]/2);
                }
            };
            draw();
        }
    } catch (e) { console.log("마이크 연결 실패"); }
}

function showResult(score) {
    const finalScoreEl = document.getElementById("final-score");
    const scoreModal = document.getElementById("score-modal");
    let displayScore = score < 50 ? score + 50 : (score > 100 ? 100 : score);
    if(finalScoreEl) finalScoreEl.innerText = displayScore;
    if(scoreModal) scoreModal.style.display = "flex";
}

function closeScore() { 
    document.getElementById("score-modal").style.display = "none"; 
    currentKey = 0; 
}