# Guess or Splash

영어 설명 문장 2개로 단어를 추리하는 학습 게임입니다.  
로컬 서버를 켜면 **Gemini**가 TOEIC 수준의 새 문제를 만들어 줍니다.

## 1. API 키 설정

`.env` 예시:

```env
GEMINI_API_KEY=제미나이_키
WORD_ORB_KEY=워드오브_키
```

- Word Orb: [wordorb.ai](https://wordorb.ai) 에서 발급 (`WORD_ORB_KEY`)
- Gemini: [Google AI Studio](https://aistudio.google.com/apikey) 에서 발급

Play 시 **Word Orb(단어 선택) + Gemini(설명/뜻)** 를 사용합니다. Gemini 키가 없으면 로컬 `words.js`로 플레이합니다.

## 2. 서버 실행

**가장 쉬운 방법 (Windows):** `start.bat`을 더블클릭합니다.

또는 PowerShell에서:

```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

Node.js가 있다면:

```bash
npm start
```

## 3. 게임 실행

브라우저에서 [http://127.0.0.1:3000/](http://127.0.0.1:3000/) 을 엽니다.

- Gemini 키는 필수입니다. Word Orb 키는 있으면 단어 선택에만 쓰입니다.
- 키/서버가 없으면 기존 `words.js` 문제로 플레이합니다.

> `index.html`을 파일로 바로 열면 `/api/words` 호출이 되지 않습니다. 반드시 서버로 열어 주세요.
