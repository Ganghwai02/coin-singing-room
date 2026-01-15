let player;
let currentSongId = null;

// 유튜브 API 초기화
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%', width: '100%',
        videoId: 'dQw4w9WgXcQ',
        playerVars: { 'autoplay': 0, 'controls': 0, 'showinfo': 0, 'rel': 0 },
    });
}

// 가사 싱크 시작
async function startLyrics(sid) {
    const data = await KaraokeAPI.getLyrics(sid);
    let time = 0;
    const timer = setInterval(() => {
        time++;
        const sync = data.sync_data.find(s => s.time === time);
        if (sync) {
            document.getElementById('lyricCurrent').innerText = sync.text;
        }
        if (time > 20) { // 샘플 종료 시간
            clearInterval(timer);
            player.stopVideo();
            document.getElementById('lyricCurrent').innerText = "곡 종료 - 점수를 제출하세요!";
        }
    }, 1000);
}

// 메인 재생 함수
async function playNextSong() {
    try {
        const data = await KaraokeAPI.playNext();
        currentSongId = data.song_id;
        
        // 상단 정보 업데이트
        document.getElementById('statusTitle').innerText = "재생 중: " + data.title;
        document.getElementById('remainCount').innerText = data.remaining_plays;

        // 유튜브 영상 재생
        if (data.video_url) {
            const videoId = data.video_url.split('v=')[1];
            player.loadVideoById(videoId);
        }
        startLyrics(data.song_id);
    } catch (e) {
        alert("예약된 곡이 없습니다!");
    }
}