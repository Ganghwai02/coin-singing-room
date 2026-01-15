// 백엔드 서버 주소 설정 (포트 번호 확인!)
const BASE_URL = "http://127.0.0.1:8000/api";
const AUTH_BASE = `${BASE_URL}/auth`;
const SONG_BASE = `${BASE_URL}/songs`;

const AuthAPI = {
    /**
     * 회원가입 기능
     * @param {string} username - 사용자 아이디
     * @param {string} password - 비밀번호
     * @param {string} plan - 선택한 요금제 (free, monthly, premium)
     */
    async register(username, password, plan) {
        try {
            const res = await fetch(`${AUTH_BASE}/register?username=${username}&password=${password}&plan=${plan}`, {
                method: "POST"
            });
            
            if (res.ok) {
                alert(`${plan.toUpperCase()} 플랜으로 가입되었습니다! 로그인해 주세요.`);
                return true;
            } else {
                const err = await res.json();
                alert("가입 실패: " + (err.detail || "알 수 없는 오류"));
                return false;
            }
        } catch (e) {
            console.error("Register Connection Error:", e);
            alert("서버와 통신할 수 없습니다.");
            return false;
        }
    },

    /**
     * 로그인 기능 (422 에러 방지를 위한 Form Data 형식)
     */
    async login(username, password) {
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const res = await fetch(`${AUTH_BASE}/login`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/x-www-form-urlencoded" 
                },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                // JWT 토큰을 브라우저에 저장
                localStorage.setItem("token", data.access_token);
                alert("로그인 성공! SingStar에 오신 것을 환영합니다.");
                location.href = "index.html"; // 메인 화면으로 이동
            } else {
                const err = await res.json();
                alert("로그인 실패: " + (err.detail || "아이디 또는 비밀번호를 확인하세요."));
            }
        } catch (e) {
            console.error("Login Connection Error:", e);
            alert("서버 연결에 실패했습니다.");
        }
    }
};

const KaraokeAPI = {
    /**
     * 유료 회원을 위한 녹음 목록 가져오기 (시뮬레이션)
     */
    async getMyBest() {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("로그인이 필요합니다.");

        // 실제 구현 시 백엔드에 해당 엔드포인트가 있어야 합니다.
        const res = await fetch(`${SONG_BASE}/my-records`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) return await res.json();
        if (res.status === 403) throw new Error("프리미엄 회원 전용 기능입니다.");
        throw new Error("데이터를 불러오지 못했습니다.");
    },

    /**
     * 다음 곡 정보 가져오기 (무료 회원은 광고 로직 포함 가능)
     */
    async playNext() {
        const token = localStorage.getItem("token");
        const headers = token ? { "Authorization": `Bearer ${token}` } : {};

        const res = await fetch(`${SONG_BASE}/next`, { headers });
        if (res.ok) return await res.json();
        throw new Error("곡 정보를 가져올 수 없습니다.");
    }
};