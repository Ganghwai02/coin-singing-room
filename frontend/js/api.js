const BASE_URL = "http://127.0.0.1:8000/api";

const AuthAPI = {
    // 회원가입 (플랜 정보 추가)
    async register(username, password, plan) {
        try {
            // 백엔드 엔드포인트: /auth/register?username=...&password=...&plan=...
            const res = await fetch(`${BASE_URL}/auth/register?username=${username}&password=${password}&plan=${plan}`, {
                method: "POST"
            });
            return res.ok;
        } catch (e) {
            console.error("가입 통신 에러:", e);
            return false;
        }
    },

    // 로그인
    async login(username, password) {
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const res = await fetch(`${BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('access_token', res.access_token);
                return true;
            }
            return false;
        } catch (e) {
            console.error("로그인 통신 에러:", e);
            return false;
        }
    }
};


// 내 정보 불러와서 화면에 닉네임 표시하는 함수
async function loadUserProfile() {
  const token = localStorage.getItem('access_token'); // 저장된 토큰 가져오기
  
  if (!token) return;

  try {
    const response = await fetch('http://127.0.0.1:8000/api/users/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const userData = await response.json();
      // DB에서 가져온 nickname 적용 (없으면 username으로 대체)
      document.getElementById('user-nickname').textContent = userData.nickname || userData.username;
    }
  } catch (error) {
    console.error("프로필 정보 로드 실패:", error);
  }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', loadUserProfile);