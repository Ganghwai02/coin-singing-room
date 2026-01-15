let remainSongs = 3;
let userPlan = "free";
let reservationQueue = [];

const charts = [
    {title: "에피소드", artist: "이무진"},
    {title: "Love Wins All", artist: "아이유"},
    {title: "밤양갱", artist: "비비"},
    {title: "Hype Boy", artist: "NewJeans"},
    {title: "Seven", artist: "Jungkook"}
];

document.addEventListener("DOMContentLoaded", () => {
    if (!localStorage.getItem("token")) {
        location.href = "auth.html";
        return;
    }
    const savedName = localStorage.getItem("nickname") || "가수님";
    document.getElementById("edit-nickname").value = savedName;
    renderChart();
    updateUI();
});

function changeTab(element, sectionId) {
    document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
    element.classList.add('active');
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`section-${sectionId}`).classList.add('active');
}

function renderChart() {
    const list = document.getElementById("chart-list");
    list.innerHTML = charts.map((c, i) => `
        <div class="chart-card">
            <div style="font-size:20px; font-weight:bold; color:var(--ss-pink); width:40px;">${i+1}</div>
            <div style="flex:1"><b>${c.title}</b><br><small>${c.artist}</small></div>
            <button class="btn-sing" onclick="addToQueue('${c.artist} ${c.title}')">예약</button>
        </div>
    `).join('');
}

function handleSearch(e) {
    if (e.key === 'Enter') {
        const q = e.target.value;
        if(q) { addToQueue(q); e.target.value = ""; }
    }
}

function addToQueue(songName) {
    reservationQueue.push(songName);
    updateQueueUI();
    alert(`'${songName}' 예약 완료!`);
}

function updateQueueUI() {
    const list = document.getElementById("reserve-list");
    list.innerHTML = reservationQueue.length === 0 ? '<div class="reserve-item">곡을 예약해주세요</div>' : 
        reservationQueue.map((s, i) => `<div class="reserve-item">${i+1}. ${s}</div>`).join('');
}

function startNextSong() {
    if(reservationQueue.length === 0) return alert("예약된 노래가 없습니다!");
    if(userPlan === "free" && remainSongs <= 0) return alert("곡이 부족합니다. 충전해주세요!");

    const song = reservationQueue.shift();
    updateQueueUI();
    if(userPlan === "free") remainSongs--;
    updateUI();

    document.getElementById("karaoke-view").style.display = "flex";

    // 검색어에서 특수문자를 제거하고 최적화합니다.
    const cleanSongName = song.replace(/[#?&%]/g, '');
    const searchQuery = encodeURIComponent(cleanSongName + " 노래방 karaoke");

    // [핵심] listType=search는 막히는 경우가 많아 '검색 결과로 바로 연결'하는 주소를 사용합니다.
    // 또한 사용자의 클릭(startNextSong 실행)에 의해 호출되므로 autoplay가 더 잘 작동합니다.
    const ytIframe = `
        <iframe 
            width="100%" 
            height="100%" 
            src="https://www.youtube.com/embed?listType=search&list=${searchQuery}&autoplay=1&mute=0" 
            title="SingStar Player" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowfullscreen>
        </iframe>`;

    document.getElementById("yt-player").innerHTML = ytIframe;

    // 점수 오버레이 (15초 후)
    setTimeout(() => {
        document.getElementById("final-score").innerText = Math.floor(Math.random() * 16) + 85;
        document.getElementById("score-overlay").style.display = "block";
    }, 15000);
}

function updateUI() {
    const name = localStorage.getItem("nickname") || "가수님";
    const displayRemain = userPlan === "free" ? remainSongs : "무제한";
    document.getElementById("display-name").innerText = name;
    document.getElementById("remain-songs-val").innerText = displayRemain;
    document.getElementById("karaoke-remain-val").innerText = displayRemain;
    document.getElementById("user-status").innerText = userPlan === "free" ? "FREE MEMBER" : "PREMIUM MEMBER";
}

function updateNickname() {
    const n = document.getElementById("edit-nickname").value;
    if(n) { localStorage.setItem("nickname", n); updateUI(); alert("변경됨!"); }
}

function upgradePlan() {
    // 1. 초기화
    const IMP = window.IMP; 
    IMP.init("imp74441366"); // 테스트용 가맹점 식별코드

    if(confirm("프리미엄 멤버십(월 99,000원)을 결제하시겠습니까?")) {
        // 2. 결제창 호출
        IMP.request_pay({
            pg: "html5_inicis",           // 결제창 방식 (KG이니시스)
            pay_method: "card",           // 결제 수단
            merchant_uid: "order_" + new Date().getTime(), // 주문번호
            name: "SingStar 프리미엄 정기권",
            amount: 100,                  // 테스트를 위해 100원만 설정 (실제 9900원 가능)
            buyer_email: "test@user.com",
            buyer_name: localStorage.getItem("nickname") || "가수님",
        }, function (rsp) {
            if (rsp.success) {
                // 결제 성공 시
                alert("결제가 완료되었습니다! 이제 무제한으로 즐기세요.");
                userPlan = "premium";
                updateUI();
                
                // 실제 서비스라면 여기서 서버(FastAPI)에 결제 정보를 보내야 합니다.
            } else {
                // 결제 실패 시
                alert("결제에 실패했습니다: " + rsp.error_msg);
            }
        });
    }
}

// 랜덤 결제 알림 생성기
function showRandomPurchase() {
    const locations = ["서울", "부산", "경기", "인천", "광주", "대구", "제주", "해외"];
    const names = ["김*수", "이*희", "박*준", "최*아", "SingKing", "노래천재"];
    
    const randomLoc = locations[Math.floor(Math.random() * locations.length)];
    const randomName = names[Math.floor(Math.random() * names.length)];
    
    const toast = document.getElementById("purchase-toast");
    document.getElementById("toast-user").innerText = `${randomLoc}의 ${randomName}님`;
    
    // 팝업 등장
    toast.style.display = "flex";
    setTimeout(() => { toast.style.display = "none"; }, 4000); // 4초 후 사라짐
}

// 15초마다 랜덤하게 알림 띄우기 (결제 유도)
setInterval(() => {
    if(Math.random() > 0.5) showRandomPurchase();
}, 15000);

function closeScore() { document.getElementById("score-overlay").style.display = "none"; }
function exitKaraoke() { document.getElementById("karaoke-view").style.display = "none"; document.getElementById("yt-player").innerHTML = ""; }
function doLogout() { localStorage.clear(); location.href = "auth.html"; }
function deleteAccount() { if(confirm("탈퇴?")) doLogout(); }