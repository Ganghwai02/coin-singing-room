// frontend/js/main.js

document.addEventListener("DOMContentLoaded", async () => {
    console.log("메인 페이지 연결 완료!");

    // 1. 로그인 상태 체크
    const token = localStorage.getItem("token");
    if (!token) {
        alert("로그인이 필요합니다!");
        location.href = "auth.html";
        return;
    }

    // 2. 버튼 요소 가져오기 (HTML에 이 ID들이 있어야 합니다)
    const playBtn = document.getElementById("play-btn");     // 노래 시작
    const recordBtn = document.getElementById("record-btn"); // 내 기록
    const logoutBtn = document.getElementById("logout-btn"); // 로그아웃

    // 3. [노래 시작] 버튼 클릭 이벤트
    if (playBtn) {
        playBtn.onclick = () => {
            console.log("노래 시작 버튼 클릭됨");
            
            // 여기에 아까 말한 [무료 유저 5초 광고] 기능을 넣을 자리입니다.
            const isPremium = false; // (나중에 API로 실제 상태 받아오기)
            
            if (!isPremium) {
                alert("무료 회원입니다. 5초 광고 후 노래를 시작합니다!");
                // 광고 함수 실행 (만들어둔 게 있다면)
            } else {
                alert("프리미엄 회원님, 광고 없이 바로 시작합니다!");
            }
        };
    }

    // 4. [내 기록] 버튼 클릭 이벤트
    if (recordBtn) {
        recordBtn.onclick = () => {
            alert("내 녹음 목록 페이지로 이동하거나 데이터를 불러옵니다.");
            // location.href = "mypage.html";
        };
    }

    // 5. [로그아웃] 버튼 클릭 이벤트
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            if (confirm("로그아웃 하시겠습니까?")) {
                localStorage.removeItem("token");
                location.href = "auth.html";
            }
        };
    }
});