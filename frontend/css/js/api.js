const API_BASE = "http://127.0.0.1:8000/api/songs";

const KaraokeAPI = {
    // 1. 대기열 예약
    async enqueue(songId) {
        const res = await fetch(`${API_BASE}/${songId}/enqueue`, { method: 'POST' });
        return res.json();
    },

    // 2. 다음 곡 정보 가져오기 (Dequeue)
    async playNext() {
        const res = await fetch(`${API_BASE}/queue/play-next`, { method: 'POST' });
        if (!res.ok) throw new Error("대기열 비었음");
        return res.json();
    },

    // 3. 가사 및 싱크 데이터 가져오기
    async getLyrics(songId) {
        const res = await fetch(`${API_BASE}/${songId}/lyrics`);
        return res.json();
    },

    // 4. 점수 제출 및 보너스 확인
    async finishSong(songId, score) {
        const res = await fetch(`${API_BASE}/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ song_id: songId, score: score })
        });
        return res.json();
    }
};