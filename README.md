# Jev AI × Tonal.js — Neo-Soul RAG 화성학 코드 진행 스튜디오

`Tonal.js` 화성학 연산, `inbm001/progressions` 네오소울 코퍼스(857곡, 11,695 전이) **RAG(Retrieval-Augmented Generation)**, 그리고 TypeSafe AI의 **Jev (`@typesafe-ai/sdk` System One)** 확률적 의사결정(`choice`, `score`, `noul`)을 결합한 코드 진행 생성 스튜디오입니다.

## 주요 기능
- **감정(방향) × Jev 확률(깊이) 레이더 UI**:
  - 4방위 감정 축(12시 설렘·확장 / 3시 긴장·추진력 / 6시 애절함·몽환 / 9시 평온·안식)과 Jev 선택 확률 깊이를 레이더에 시각화
  - 마우스 오버 시 즉시 코드 보이싱 청음 및 화성학 규칙·성부 진행 점수·실제 등장한 네오소울 곡(유튜브 쇼츠 링크) 확인
- **시작 코드(SLOT 1)부터 직접 선택 & 키보드 숫자키(`1`~`8`) 슬롯 연주**:
  - 시작 코드부터 자유롭게 선택 가능하며, 키보드 숫자키 `1`~`8`로 각 슬롯 즉시 연주 (`Space` 전체 자동 재생)
- **Jev RAG (`jev-rag-grounding` 스킬 포함)**:
  - `.claude/skills/jev-rag-grounding/SKILL.md` 및 `.agents/skills/jev-rag-grounding/SKILL.md` 내장
- **사이트 내 AI 화성학 채팅 & 실시간 토큰 사용량 모니터**

## 실행 방법
```bash
npm install
cp .env.example .env
# .env 파일에 VITE_TYPESAFE_API_KEY 입력
npm run dev
```
