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

async function loadMyRecords() {
    document.getElementById('myPage').style.display = 'block';
    // 백엔드에서 내 기록 가져오기 (api.js에 추가 필요)
    try {
        const records = await KaraokeAPI.getMyBest(); 
        const listDiv = document.getElementById('recordList');
        listDiv.innerHTML = records.map(r => 
            `<div style="margin-bottom:10px; border-bottom:1px solid #333;">
                ${r.title} - <b>${r.score}점</b><br><small>${r.created_at}</small>
            </div>`
        ).join('');
    } catch(e) {
        alert("유료 회원 전용 기능입니다!");
    }
}

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