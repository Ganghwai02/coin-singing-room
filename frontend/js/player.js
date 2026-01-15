let isAdsEnabled = true; // 플랜에 따라 변경

async function startKaraoke() {
    try {
        const data = await KaraokeAPI.playNext();
        
        // 1. 광고 제거 로직 (유료 플랜 체크)
        if (data.remaining_plays === 999) { // 유료 플랜
            isAdsEnabled = false;
            document.getElementById('ad-banner').style.display = 'none';
        } else {
            showRandomAd();
        }

        // 2. AI 보컬 코칭 UI (연간 프리미엄 전용)
        if (data.has_vocal_coaching) {
            document.getElementById('ai-coach-panel').classList.remove('hidden');
        }

        // 3. HD 뮤직비디오 세팅
        if (data.is_hd) {
            player.setPlaybackQuality('hd1080');
        }

        renderPlayer(data);
    } catch (err) {
        alert(err.detail);
    }
}

async function checkUserStatus() {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("로그인이 필요한 서비스입니다.");
        location.href = "auth.html";
        return;
    }

    // 백엔드에서 내 정보 가져오기
    const response = await fetch("http://127.0.0.1:8000/api/auth/me", {
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
        const user = await response.json();
        console.log("현재 유저 정보:", user);
        
        // 사장님 기획: 프리미엄이 아니면 광고 로직 실행
        if (!user.is_premium && !user.is_monthly) {
            setupAds(); 
        } else {
            document.getElementById('ad-banner').style.display = 'none';
            alert(`${user.username}님, 프리미엄 혜택이 적용 중입니다!`);
        }
    }
}

// 페이지 로드 시 바로 실행
window.onload = checkUserStatus;

// 오디오 컨텍스트 설정 (음향 효과용)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const mainGainNode = audioCtx.createGain(); // 음량 조절용

// 🎹 1. 음량 조절 기능
function setVolume(value) {
    mainGainNode.gain.value = value; // 0.0 ~ 1.0
    console.log(`Volume: ${value * 100}%`);
}

// 🎹 2. 음정(키) 조절 기능 (Pitch Shift)
// 유튜브 플레이어 자체의 재생 속도를 미세하게 조절하거나 
// 별도의 오디오 프로세서를 사용합니다.
function setPitch(playbackRate) {
    // 1.0이 기본, 0.9는 낮은 키, 1.1은 높은 키
    player.setPlaybackRate(playbackRate);
    console.log(`Pitch Rate: ${playbackRate}`);
}

// 🎹 3. 에코(Delay) 효과
function setEcho(delayTime) {
    const delay = audioCtx.createDelay();
    delay.delayTime.value = delayTime; // 0.1 ~ 0.5초 사이 추천
    
    const feedback = audioCtx.createGain();
    feedback.gain.value = 0.4; // 에코가 반복되는 정도
    
    delay.connect(feedback);
    feedback.connect(delay);
    // 실제 오디오 소스와 연결하는 로직이 추가로 필요합니다.
}


function setupAds() {
    const playBtn = document.getElementById('play-btn'); // 노래 시작 버튼
    playBtn.onclick = function() {
        const overlay = document.getElementById('ad-overlay');
        const timerEl = document.getElementById('ad-timer');
        overlay.style.display = 'block';
        
        let count = 5;
        const interval = setInterval(() => {
            count--;
            timerEl.innerText = count;
            if (count <= 0) {
                clearInterval(interval);
                overlay.style.display = 'none';
                startKaraoke(); // 실제 노래 시작 함수
            }
        }, 1000);
    };
}