// [1. 전역 상태 관리]
window.userPlan = localStorage.getItem("userPlan") || "free";
window.remainSongs = (window.userPlan === "premium") ? "∞" : parseInt(localStorage.getItem("remainSongs") || 3);
window.reservationQueue = [];
window.favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

let currentVolume = 0;
let currentScoreValue = 0;
let currentKey = 0;
let audioCtx, analyser, dataArray, animationId, scoreInterval;
let ytPlayer = null;

// [데이터] 인기 차트 리스트
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

// [3. 초기화 시스템]
window.onload = () => {
    // 닉네임 설정
    const savedNick = localStorage.getItem("nickname") || "SingStar!";
    document.getElementById("display-name").innerText = savedNick;
    document.getElementById("edit-nickname").value = savedNick === "SingStar!" ? "" : savedNick;

    // 요금제 UI 반영
    if (window.userPlan === "premium") {
        document.getElementById("user-status").innerText = "VIP PREMIUM MEMBER";
        document.getElementById("user-status").style.color = "yellow";
        document.getElementById("user-card-ui").style.background = "linear-gradient(135deg, #FFD700, #FF8C00)";
    }

    window.renderCharts();
    window.updateUI();
};

// [4. 사이드바 및 메뉴 관련 함수]

// 메뉴 탭 전환 (HTML의 changeTab)
window.changeTab = function(el, tabName) {
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    el.classList.add('active');

    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById('section-' + tabName).classList.add('active');

    if(tabName === 'favs') window.renderFavorites();
};

// 랜덤 추천 (HTML의 luckyDraw)
window.luckyDraw = function() {
    const randomSong = charts[Math.floor(Math.random() * charts.length)];
    alert(`🎲 행운의 추천 곡: ${randomSong.title}\n불러보시겠어요?`);
    window.playNow(randomSong.title);
};

// 결제 시스템 (HTML의 upgradePlan)
window.upgradePlan = function() {
    if(confirm("💎 VIP 프리미엄으로 업그레이드 하시겠습니까?\n모든 곡을 무제한으로 부를 수 있습니다.")) {
        localStorage.setItem("userPlan", "premium");
        alert("축하합니다! VIP 멤버십이 활성화되었습니다.");
        location.reload();
    }
};

// 닉네임 변경 (HTML의 updateNickname)
window.updateNickname = function() {
    const newNick = document.getElementById("edit-nickname").value.trim();
    if(!newNick) return alert("변경할 닉네임을 입력해 주세요.");
    localStorage.setItem("nickname", newNick);
    document.getElementById("display-name").innerText = newNick;
    alert("✨ 닉네임이 성공적으로 변경되었습니다.");
};

window.doLogout = function() {
    if(confirm("정말 로그아웃 하시겠습니까? 데이터가 초기화됩니다.")) {
        localStorage.clear();
        location.reload();
    }
};

// [5. 재생 및 컨트롤러 엔진]

window.playNow = function(name) {
    if (window.userPlan === "free" && window.remainSongs <= 0) {
        return alert("😭 남은 곡 수가 없습니다! 프리미엄을 결제해 보세요.");
    }
    window.reservationQueue.unshift(name);
    window.startNextSong();
};

window.addToQueue = function(name) {
    window.reservationQueue.push(name);
    window.updateQueueUI();
    alert(`✅ '${name}' 곡이 예약되었습니다.`);
};

window.startNextSong = function() {
    if (window.reservationQueue.length === 0) return alert("예약된 곡이 없습니다.");
    
    const songTitle = window.reservationQueue.shift();
    const songData = charts.find(s => s.title === songTitle);
    
    window.updateQueueUI();

    // 곡 차감
    if (window.userPlan === "free") {
        window.remainSongs--;
        localStorage.setItem("remainSongs", window.remainSongs);
        window.updateUI();
    }

    // 노래방 화면 열기
    document.getElementById("karaoke-view").style.display = "flex";
    const ytContainer = document.getElementById("yt-player");
    ytContainer.innerHTML = '<div id="player-api-target"></div>';

    ytPlayer = new YT.Player('player-api-target', {
        height: '100%', width: '100%', videoId: songData.youtubeId,
        playerVars: { 'autoplay': 1, 'controls': 1, 'origin': window.location.origin },
        events: { 'onReady': (e) => e.target.playVideo() }
    });

    // 컨트롤러 초기화
    currentKey = 0;
    document.getElementById("key-val").innerText = "0";
    window.startVisualizer();
    window.setupScore();
};

// 키 조절 (HTML의 changeKey)
window.changeKey = function(val) {
    currentKey += val;
    document.getElementById("key-val").innerText = currentKey > 0 ? "+" + currentKey : currentKey;
};

// 클럽 조명 (HTML의 toggleClubMode)
window.toggleClubMode = function() {
    const view = document.getElementById("karaoke-view");
    if (view.classList.contains("club-on")) {
        view.classList.remove("club-on");
        view.style.background = "#000";
    } else {
        view.classList.add("club-on");
        alert("🕺 클럽 조명 가동!");
        // 조명 효과 (깜빡임)
        let colors = ["#1a0033", "#000033", "#330000", "#003300", "#000"];
        let i = 0;
        const disco = setInterval(() => {
            if(!view.classList.contains("club-on")) { clearInterval(disco); return; }
            view.style.background = colors[i % colors.length];
            i++;
        }, 300);
    }
};

window.exitKaraoke = function() {
    if(ytPlayer && ytPlayer.destroy) ytPlayer.destroy();
    document.getElementById("karaoke-view").style.display = "none";
    document.getElementById("karaoke-view").classList.remove("club-on");
    cancelAnimationFrame(animationId);
    if(scoreInterval) clearInterval(scoreInterval);
    window.showResult(currentScoreValue);
};

// [6. UI 렌더링 및 부가기능]

window.renderCharts = function() {
    const list = document.getElementById("chart-list");
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
    const favSongs = charts.filter(song => window.favorites.includes(song.title));
    list.innerHTML = favSongs.length === 0 ? "<div style='color:#ccc; padding:50px; text-align:center;'>❤️ 애창곡이 없습니다.</div>" : 
        favSongs.map(song => `<div class="chart-card">
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

window.toggleFavorite = function(songName) {
    const index = window.favorites.indexOf(songName);
    if (index > -1) window.favorites.splice(index, 1); 
    else window.favorites.push(songName);
    localStorage.setItem("favorites", JSON.stringify(window.favorites));
    window.renderCharts();
    window.renderFavorites();
};

window.updateUI = function() {
    document.getElementById("remain-songs-val").innerText = window.remainSongs;
};

window.updateQueueUI = function() {
    document.getElementById("reserve-list").innerHTML = window.reservationQueue.map((s, i) => `<div class="reserve-item">${i+1}. ${s}</div>`).join('');
};

window.setupScore = function() {
    currentScoreValue = 0;
    scoreInterval = setInterval(() => { if (currentVolume > 40) currentScoreValue += 1; }, 1000);
};

window.showResult = function(score) {
    let displayScore = score < 10 ? Math.floor(Math.random()*15)+80 : Math.min(score + 85, 100);
    document.getElementById("final-score").innerText = displayScore;
    document.getElementById("score-modal").style.display = "flex";
};

window.closeScore = function() { document.getElementById("score-modal").style.display = "none"; };

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
    } catch (e) { console.log("마이크 접근 거부"); }
};

window.shareToKatalk = function() {
    const score = document.getElementById("final-score").innerText;
    Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
            title: '🎤 SingStar 점수 발표!',
            description: `방금 부른 노래 점수는 ${score}점입니다!`,
            imageUrl: 'https://cdn-icons-png.flaticon.com/512/3059/3059551.png',
            link: { mobileWebUrl: window.location.href, webUrl: window.location.href },
        }
    });
};