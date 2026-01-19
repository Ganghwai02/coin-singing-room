# 나만의 코인노래방 구현~~!!(SingStar)
- 주요 기능 (Features)
1. Real-time Scoring: Web Audio API를 통해 마이크 입력 주파수를 분석, 음정 변화와 성량을 체크하여 점수 산정.

2. Visualizer: 캔버스 API를 이용한 실시간 오디오 스펙트럼 시각화.

3. Club Mode: 시각적 몰입감을 높이는 동적 배경 조명 효과.

- 기술 스택 (Tech Stack)
1. Frontend: HTML5, CSS3, JavaScript (ES6+)

2. Audio API: Web Audio API (AnalyserNode)

3. Video: YouTube IFrame API (For Legal Compliance)

## 🎵 음원 저작권 안내

- 저작권 준수 및 리스크 관리 (Legal Compliance)
본 프로젝트는 실제 노래방 서비스와 유사한 사용자 경험을 제공하기 위해 TJ미디어의 콘텐츠를 활용하였습니다. 개발 과정에서 발생할 수 있는 저작권 리스크를 관리하기 위해 다음과 같은 단계를 밟았습니다.

원저작권사 공식 문의: 콘텐츠 사용의 정당성을 확보하기 위해 TJ미디어 제휴 창구를 통해 **'유튜브 콘텐츠 사용 및 포트폴리오 활용 승인'**을 공식 요청하였습니다.

아키텍처 설계의 유연성: > * Plan A: 저작권자의 승인 하에 고화질 로컬 리소스(MP4) 사용.

Plan B (Current): 저작권 리스크를 원천 차단하기 위해, 영상을 직접 배포하지 않고 YouTube IFrame API를 연동하여 원저작권자의 공식 채널 영상을 스트리밍하는 방식으로 아키텍처를 설계하였습니다.

결과: 기술적 구현뿐만 아니라 서비스 운영 시 발생할 수 있는 법적 리스크를 선제적으로 파악하고 대응하는 경험을 쌓았습니다.
