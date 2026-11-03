(() => {
  "use strict";

  const MAX_LIVES = 4;
  const MAX_HINTS = 4;

  const state = {
    deck: [],
    index: 0,
    lives: MAX_LIVES,
    hintsUsed: 0,
    revealed: [],
    score: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    history: [],
    timerId: null,
    timeLeft: 60,
    roundSeconds: 60,
    soundOn: true,
    busy: false,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  const els = {
    screens: {
      start: $("#screen-start"),
      game: $("#screen-game"),
      result: $("#screen-result"),
    },
    btnStart: $("#btn-start"),
    btnHowto: $("#btn-howto"),
    btnHowtoClose: $("#btn-howto-close"),
    modalHowto: $("#modal-howto"),
    modalSettings: $("#modal-settings"),
    btnSettings: $("#btn-settings"),
    btnSettingsClose: $("#btn-settings-close"),
    btnQuit: $("#btn-quit"),
    settingSound: $("#setting-sound"),
    settingTime: $("#setting-time"),
    timer: $("#timer"),
    hintCount: $("#hint-count"),
    livesCount: $("#lives-count"),
    letterCount: $("#letter-count"),
    clueList: $("#clue-list"),
    letterSlots: $("#letter-slots"),
    livesTrack: $("#lives-track"),
    answerForm: $("#answer-form"),
    answerInput: $("#answer-input"),
    btnHint: $("#btn-hint"),
    btnSkip: $("#btn-skip"),
    score: $("#score"),
    feedback: $("#feedback"),
    feedbackInner: $("#feedback-inner"),
    resultTitle: $("#result-title"),
    resultMessage: $("#result-message"),
    resultScore: $("#result-score"),
    resultCorrect: $("#result-correct"),
    resultStreak: $("#result-streak"),
    reviewList: $("#review-list"),
    btnReplay: $("#btn-replay"),
    btnHome: $("#btn-home"),
  };

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function showScreen(name) {
    Object.values(els.screens).forEach((s) => s.classList.remove("active"));
    els.screens[name].classList.add("active");
  }

  function formatTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function currentWord() {
    return state.deck[state.index];
  }

  function playTone(freq, duration, type = "sine") {
    if (!state.soundOn) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
      setTimeout(() => ctx.close(), (duration + 0.1) * 1000);
    } catch (_) {
      /* ignore */
    }
  }

  function beepCorrect() {
    playTone(523, 0.1);
    setTimeout(() => playTone(659, 0.12), 90);
    setTimeout(() => playTone(784, 0.18), 180);
  }

  function beepSplash() {
    playTone(220, 0.15, "triangle");
    setTimeout(() => playTone(160, 0.25, "sawtooth"), 100);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function startTimer() {
    stopTimer();
    state.timeLeft = state.roundSeconds;
    els.timer.textContent = formatTime(state.timeLeft);
    state.timerId = setInterval(() => {
      state.timeLeft -= 1;
      els.timer.textContent = formatTime(Math.max(0, state.timeLeft));
      if (state.timeLeft <= 0) {
        stopTimer();
        handleTimeout();
      }
    }, 1000);
  }

  function renderLives() {
    els.livesCount.textContent = state.lives;
    els.livesTrack.innerHTML = "";
    for (let i = 0; i < MAX_LIVES; i++) {
      const popped = i >= state.lives;
      const el = document.createElement("div");
      el.className = `life-balloon${popped ? " popped" : ""}`;
      el.innerHTML = `
        <div class="body"></div>
        ${popped ? '<span class="x-mark">✕</span>' : ""}
      `;
      els.livesTrack.appendChild(el);
    }
  }

  function popOneBalloon() {
    const balloons = $$(".life-balloon:not(.popped)");
    const last = balloons[balloons.length - 1];
    if (!last) return;
    last.classList.remove("marked");
    last.classList.add("popped", "pop-anim");
    if (!last.querySelector(".x-mark")) {
      last.insertAdjacentHTML("beforeend", '<span class="x-mark">✕</span>');
    }
  }

  function reddenOneBalloon() {
    const balloons = $$(".life-balloon:not(.popped)");
    const last = balloons[balloons.length - 1];
    if (!last) return false;
    last.classList.add("popped");
    if (!last.querySelector(".x-mark")) {
      last.insertAdjacentHTML("beforeend", '<span class="x-mark">✕</span>');
    }
    state.lives -= 1;
    els.livesCount.textContent = Math.max(0, state.lives);
    return true;
  }

  function renderSlots() {
    const word = currentWord().word;
    els.letterSlots.innerHTML = "";
    for (let i = 0; i < word.length; i++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      if (state.revealed[i]) {
        slot.textContent = word[i];
        slot.classList.add("revealed", "filled");
      } else {
        slot.textContent = "_";
      }
      els.letterSlots.appendChild(slot);
    }
  }

  function renderClues() {
    const entry = currentWord();
    const items = els.clueList.querySelectorAll("li");
    items[0].textContent = entry.clues[0];
    items[1].textContent = entry.clues[1];
    const len = entry.word.length;
    els.letterCount.textContent = `${len} Letter${len === 1 ? "" : "s"}`;
  }

  function updateHud() {
    els.hintCount.textContent = Math.min(state.hintsUsed, MAX_HINTS);
    els.score.textContent = state.score;
    els.btnHint.disabled = state.busy;
  }

  function loadRound() {
    if (state.index >= state.deck.length) {
      const perfect = state.correct === state.deck.length && state.deck.length > 0;
      endGame(perfect ? "cleared" : "finished");
      return;
    }
    state.hintsUsed = 0;
    state.revealed = Array(currentWord().word.length).fill(false);
    state.busy = false;
    els.answerInput.value = "";
    els.answerInput.disabled = false;
    renderClues();
    renderSlots();
    renderLives();
    updateHud();
    startTimer();
    els.answerInput.focus();
  }

  function showFeedback(kind, message) {
    els.feedback.className = `feedback ${kind}`;
    els.feedbackInner.textContent = message;
    els.feedback.classList.remove("hidden");
    return new Promise((resolve) => {
      setTimeout(() => {
        els.feedback.classList.add("hidden");
        resolve();
      }, 900);
    });
  }

  function normalizeAnswer(str) {
    return str.trim().toLowerCase().replace(/[^a-z]/g, "");
  }

  async function handleCorrect() {
    state.busy = true;
    stopTimer();
    const word = currentWord().word;
    state.correct += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    const timeBonus = Math.max(0, state.timeLeft);
    const hintPenalty = state.hintsUsed * 5;
    const gained = Math.max(10, 50 + timeBonus - hintPenalty);
    state.score += gained;
    state.history.push({ word, ok: true, meaning: currentWord().meaning });
    beepCorrect();
    // reveal all letters
    state.revealed = state.revealed.map(() => true);
    renderSlots();
    updateHud();
    await showFeedback("correct", `Nice! +${gained}`);
    state.index += 1;
    loadRound();
  }

  async function loseLife(reason) {
    state.busy = true;
    stopTimer();
    state.streak = 0;
    state.lives -= 1;
    popOneBalloon();
    els.livesCount.textContent = Math.max(0, state.lives);
    beepSplash();
    const word = currentWord().word;
    state.history.push({
      word,
      ok: false,
      meaning: currentWord().meaning,
      reason,
    });
    await showFeedback("splash", reason === "timeout" ? "Time's up! SPLASH!" : "SPLASH!");
    if (state.lives <= 0) {
      endGame("over");
      return;
    }
    state.index += 1;
    loadRound();
  }

  function handleTimeout() {
    if (state.busy) return;
    loseLife("timeout");
  }

  function onSubmit(e) {
    e.preventDefault();
    if (state.busy) return;
    const guess = normalizeAnswer(els.answerInput.value);
    if (!guess) return;
    const answer = normalizeAnswer(currentWord().word);
    if (guess === answer) {
      handleCorrect();
    } else {
      loseLife("wrong");
    }
  }

  async function burstBalloons() {
    $$(".life-balloon").forEach((balloon) => {
      balloon.classList.add("popped", "pop-anim");
      if (!balloon.querySelector(".x-mark")) {
        balloon.insertAdjacentHTML("beforeend", '<span class="x-mark">✕</span>');
      }
    });
    beepSplash();
    const entry = currentWord();
    stopTimer();
    state.history.push({
      word: entry.word,
      ok: false,
      meaning: entry.meaning,
      reason: "hint",
    });
    await showFeedback("splash", "SPLASH!");
    endGame("over");
  }

  async function onHint() {
    if (state.busy) return;

    if ($$(".life-balloon:not(.popped)").length === 0) {
      state.busy = true;
      await burstBalloons();
      return;
    }

    state.busy = true;

    if (state.hintsUsed < MAX_HINTS) {
      const word = currentWord().word;
      const hiddenIndexes = [];
      for (let i = 0; i < word.length; i++) {
        if (!state.revealed[i]) hiddenIndexes.push(i);
      }
      if (hiddenIndexes.length > 0) {
        if (state.hintsUsed === MAX_HINTS - 1) {
          const meaning = currentWord().meaning;
          els.answerInput.placeholder = `Hint: ${meaning}`;
          setTimeout(() => {
            els.answerInput.placeholder = "Type your answer...";
          }, 4000);
        }
        const pick = hiddenIndexes[Math.floor(Math.random() * hiddenIndexes.length)];
        state.revealed[pick] = true;
        state.hintsUsed += 1;
        renderSlots();
      }
    }

    reddenOneBalloon();
    playTone(440, 0.08);
    state.busy = false;
    updateHud();
    els.answerInput.focus();
  }

  function onSkip() {
    if (state.busy) return;
    state.busy = true;
    stopTimer();
    const entry = currentWord();
    state.history.push({
      word: entry.word,
      ok: false,
      meaning: entry.meaning,
      reason: "skip",
    });
    state.index += 1;
    loadRound();
  }

  function endGame(result) {
    stopTimer();
    showScreen("result");

    if (result === "cleared") {
      els.resultTitle.textContent = "All Cleared!";
      els.resultMessage.textContent = "모든 단어를 맞췄어요. 훌륭합니다!";
    } else if (result === "finished") {
      els.resultTitle.textContent = "Round Finished";
      els.resultMessage.textContent = `이번 라운드 종료! ${state.correct}/${state.deck.length}개 맞췄어요.`;
    } else {
      els.resultTitle.textContent = "Game Over!";
      els.resultMessage.textContent = "물풍선이 모두 터졌어요. 다시 도전해 보세요!";
    }

    els.resultScore.textContent = state.score;
    els.resultCorrect.textContent = state.correct;
    els.resultStreak.textContent = state.bestStreak;
    els.reviewList.innerHTML = state.history
      .slice(-12)
      .map(
        (h) =>
          `<li class="${h.ok ? "ok" : "miss"}"><span class="word">${h.word}</span> — ${h.meaning}${
            h.ok ? "" : h.reason === "skip" ? " (skip)" : " ✕"
          }</li>`
      )
      .join("");
  }

  async function fetchApiDeck(count = 8) {
    const res = await fetch(`/api/words?count=${count}`, { cache: "no-store" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API ${res.status}`);
    }
    const data = await res.json();
    const words = Array.isArray(data.words) ? data.words : [];
    const deck = words
      .map((item) => ({
        word: String(item.word || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z]/g, ""),
        clues: [String(item.clues?.[0] || "").trim(), String(item.clues?.[1] || "").trim()],
        meaning: String(item.meaning || "").trim(),
      }))
      .filter((item) => item.word.length >= 4 && item.clues[0] && item.clues[1] && item.meaning);
    return { deck, source: data.source || "api" };
  }

  function setPlayLoading(loading) {
    els.btnStart.disabled = loading;
    els.btnReplay.disabled = loading;
    els.btnStart.textContent = loading ? "Loading..." : "Play";
    els.btnReplay.textContent = loading ? "Loading..." : "Play Again";
  }

  async function startGame() {
    if (state.busy) return;
    setPlayLoading(true);
    let deck = [];
    let source = "local";

    try {
      const result = await fetchApiDeck(8);
      if (result.deck.length) {
        deck = result.deck;
        source = result.source;
      }
    } catch (err) {
      console.warn("API word fetch failed, using local bank:", err.message);
    }

    if (!deck.length) {
      deck = shuffle(WORD_BANK);
      source = "local";
    } else {
      deck = shuffle(deck);
    }

    state.deck = deck;
    state.index = 0;
    state.lives = MAX_LIVES;
    state.hintsUsed = 0;
    state.score = 0;
    state.correct = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.history = [];
    state.busy = false;
    state.roundSeconds = Number(els.settingTime.value) || 60;
    state.soundOn = els.settingSound.checked;
    state.wordSource = source;
    els.answerInput.placeholder = "Type your answer...";
    setPlayLoading(false);
    showScreen("game");
    loadRound();
  }

  function quitToMenu() {
    stopTimer();
    els.modalSettings.classList.add("hidden");
    showScreen("start");
  }

  // Events
  els.btnStart.addEventListener("click", startGame);
  els.btnReplay.addEventListener("click", startGame);
  els.btnHome.addEventListener("click", () => showScreen("start"));
  els.btnHowto.addEventListener("click", () => els.modalHowto.classList.remove("hidden"));
  els.btnHowtoClose.addEventListener("click", () => els.modalHowto.classList.add("hidden"));
  els.btnSettings.addEventListener("click", () => els.modalSettings.classList.remove("hidden"));
  els.btnSettingsClose.addEventListener("click", () => {
    state.roundSeconds = Number(els.settingTime.value) || 60;
    state.soundOn = els.settingSound.checked;
    els.modalSettings.classList.add("hidden");
  });
  els.btnQuit.addEventListener("click", quitToMenu);
  els.answerForm.addEventListener("submit", onSubmit);
  els.btnHint.addEventListener("click", onHint);
  els.btnSkip.addEventListener("click", onSkip);

  els.modalHowto.addEventListener("click", (e) => {
    if (e.target === els.modalHowto) els.modalHowto.classList.add("hidden");
  });
  els.modalSettings.addEventListener("click", (e) => {
    if (e.target === els.modalSettings) els.modalSettings.classList.add("hidden");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      els.modalHowto.classList.add("hidden");
      els.modalSettings.classList.add("hidden");
    }
  });
})();
