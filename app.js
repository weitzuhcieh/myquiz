(function () {
  const state = {
    lessons: window.LESSONS.map((lesson) => ({
      ...lesson,
      items: lesson.items.map((item, index) => ({
        ...item,
        id: `${lesson.id}-${index + 1}`,
        userAnswer: "",
        recognizedText: "",
        isCorrect: null,
        isRevealed: false,
        feedback: ""
      }))
    })),
    currentLessonId: window.LESSONS[0] ? window.LESSONS[0].id : null,
    currentItemId: null
  };

  const lessonList = document.getElementById("lesson-list");
  const lessonTitle = document.getElementById("lesson-title");
  const lessonDescription = document.getElementById("lesson-description");
  const questionList = document.getElementById("question-list");
  const scoreLabel = document.getElementById("score-label");
  const handwritingDialog = document.getElementById("handwriting-dialog");
  const dialogTitle = document.getElementById("dialog-title");
  const dialogPrompt = document.getElementById("dialog-prompt");
  const fallbackInput = document.getElementById("fallback-input");
  const questionTemplate = document.getElementById("question-template");
  const canvas = document.getElementById("handwriting-canvas");
  const canvasContext = canvas.getContext("2d");

  let drawing = false;
  let hasInk = false;

  setupCanvas();
  bindEvents();
  render();

  function bindEvents() {
    document.getElementById("close-handwriting-button").addEventListener("click", closeHandwritingDialog);
    document.getElementById("clear-canvas-button").addEventListener("click", clearCanvas);
    document.getElementById("submit-answer-button").addEventListener("click", submitHandwriting);
  }

  function render() {
    renderLessonList();
    renderLesson();
  }

  function renderLessonList() {
    lessonList.innerHTML = "";

    state.lessons.forEach((lesson) => {
      const button = document.createElement("button");
      button.className = `lesson-button${lesson.id === state.currentLessonId ? " is-active" : ""}`;
      button.type = "button";
      button.innerHTML = `<strong>${lesson.name}</strong><span>${lesson.items.length} 題</span>`;
      button.addEventListener("click", () => {
        state.currentLessonId = lesson.id;
        render();
      });
      lessonList.appendChild(button);
    });
  }

  function renderLesson() {
    const lesson = getCurrentLesson();
    if (!lesson) {
      lessonTitle.textContent = "找不到課程";
      lessonDescription.textContent = "";
      questionList.innerHTML = "";
      scoreLabel.textContent = "0 / 0";
      return;
    }

    lessonTitle.textContent = lesson.name;
    lessonDescription.textContent = lesson.description;
    questionList.innerHTML = "";

    const completedCount = lesson.items.filter((item) => item.isCorrect !== null || item.isRevealed).length;
    scoreLabel.textContent = `${completedCount} / ${lesson.items.length}`;

    lesson.items.forEach((item, index) => {
      const fragment = questionTemplate.content.cloneNode(true);
      const card = fragment.querySelector(".question-card");
      const indexEl = fragment.querySelector(".question-index");
      const statusEl = fragment.querySelector(".question-status");
      const textEl = fragment.querySelector(".question-text");
      const hintEl = fragment.querySelector(".question-hint");
      const blankButton = fragment.querySelector(".blank-button");
      const showAnswerButton = fragment.querySelector(".show-answer-button");
      const feedbackEl = fragment.querySelector(".question-feedback");

      indexEl.textContent = `第 ${index + 1} 題`;
      textEl.innerHTML = buildSentenceMarkup(item);
      hintEl.textContent = `注音提示：${item.hint || "無"}`;

      const displayText = item.userAnswer || "點我手寫";
      blankButton.textContent = displayText;
      blankButton.classList.toggle("is-filled", Boolean(item.userAnswer));
      blankButton.addEventListener("click", () => openHandwritingDialog(item));

      showAnswerButton.addEventListener("click", () => revealAnswer(item.id));

      if (item.isRevealed) {
        card.classList.add("is-revealed");
        statusEl.textContent = "已顯示答案";
        feedbackEl.textContent = `正確答案：${item.answer}`;
      } else if (item.isCorrect === true) {
        card.classList.add("is-correct");
        statusEl.textContent = "已作答";
        feedbackEl.textContent = item.feedback || `你填入的是：${item.userAnswer}`;
      } else if (item.isCorrect === false) {
        card.classList.add("is-incorrect");
        statusEl.textContent = "已作答";
        feedbackEl.textContent = item.feedback || `你填入的是：${item.userAnswer}`;
      }

      questionList.appendChild(fragment);
    });
  }

  function buildSentenceMarkup(item) {
    const safeText = escapeHtml(item.text);
    const safeAnswer = escapeHtml(item.answer);
    const hint = escapeHtml(item.hint || "");
    const blankText = item.userAnswer ? escapeHtml(item.userAnswer) : "＿＿";
    const replacement = `<span class="blank-inline blank-ruby"><ruby>${blankText}<rt>${hint}</rt></ruby></span>`;
    return safeText.includes(safeAnswer)
      ? safeText.replace(safeAnswer, replacement)
      : `${safeText} ${replacement}`;
  }

  function openHandwritingDialog(item) {
    state.currentItemId = item.id;
    dialogTitle.textContent = `請寫出：${item.answer}`;
    dialogPrompt.textContent = item.text;
    fallbackInput.value = item.userAnswer || "";
    clearCanvas();
    handwritingDialog.hidden = false;
  }

  function revealAnswer(itemId) {
    const item = findItemById(itemId);
    item.isRevealed = true;
    item.userAnswer = item.answer;
    item.recognizedText = item.answer;
    item.isCorrect = true;
    item.feedback = `這題答案是 ${item.answer}`;
    renderLesson();
  }

  async function submitHandwriting() {
    const item = findItemById(state.currentItemId);
    if (!item) {
      return;
    }

    if (!hasInk && !fallbackInput.value.trim()) {
      item.feedback = "請先手寫，或在下方補打一個字再送出。";
      renderLesson();
      return;
    }

    const fallbackText = fallbackInput.value.trim();
    item.userAnswer = fallbackText || "已手寫作答";
    item.recognizedText = "";
    item.isCorrect = true;
    item.feedback = "已記錄作答，請按「顯示答案」人工核對。";
    item.isRevealed = false;
    closeHandwritingDialog();
    renderLesson();
  }

  function setupCanvas() {
    clearCanvas();

    const getPoint = (event) => {
      const rect = canvas.getBoundingClientRect();
      const source = event.touches?.[0] || event;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (source.clientX - rect.left) * scaleX,
        y: (source.clientY - rect.top) * scaleY
      };
    };

    const startStroke = (event) => {
      event.preventDefault();
      drawing = true;
      hasInk = true;
      const point = getPoint(event);
      canvasContext.beginPath();
      canvasContext.moveTo(point.x, point.y);
    };

    const moveStroke = (event) => {
      if (!drawing) {
        return;
      }

      event.preventDefault();
      const point = getPoint(event);
      canvasContext.lineTo(point.x, point.y);
      canvasContext.stroke();
    };

    const endStroke = () => {
      drawing = false;
      canvasContext.closePath();
    };

    canvas.addEventListener("pointerdown", startStroke);
    canvas.addEventListener("pointermove", moveStroke);
    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointerleave", endStroke);
    canvas.addEventListener("mousedown", startStroke);
    canvas.addEventListener("mousemove", moveStroke);
    canvas.addEventListener("mouseup", endStroke);
    canvas.addEventListener("touchstart", startStroke, { passive: false });
    canvas.addEventListener("touchmove", moveStroke, { passive: false });
    canvas.addEventListener("touchend", endStroke);
  }

  function clearCanvas() {
    canvasContext.fillStyle = "#ffffff";
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);
    canvasContext.lineWidth = 26;
    canvasContext.lineCap = "round";
    canvasContext.lineJoin = "round";
    canvasContext.strokeStyle = "#1d2730";
    hasInk = false;
  }

  function closeHandwritingDialog() {
    handwritingDialog.hidden = true;
  }

  function getCurrentLesson() {
    return state.lessons.find((lesson) => lesson.id === state.currentLessonId) || null;
  }

  function findItemById(itemId) {
    for (const lesson of state.lessons) {
      const item = lesson.items.find((entry) => entry.id === itemId);
      if (item) {
        return item;
      }
    }
    return null;
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
