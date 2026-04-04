(function () {
  const STORAGE_KEYS = {
    ai: "character-quiz-ai-settings",
    mode: "character-quiz-check-mode"
  };

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
    currentItemId: null,
    checkMode: localStorage.getItem(STORAGE_KEYS.mode) || "ai",
    aiSettings: loadAiSettings()
  };

  const lessonList = document.getElementById("lesson-list");
  const lessonTitle = document.getElementById("lesson-title");
  const lessonDescription = document.getElementById("lesson-description");
  const questionList = document.getElementById("question-list");
  const scoreLabel = document.getElementById("score-label");
  const modeIndicator = document.getElementById("mode-indicator");
  const modeButton = document.getElementById("mode-button");
  const aiSettingsButton = document.getElementById("ai-settings-button");
  const aiSettingsDialog = document.getElementById("ai-settings-dialog");
  const handwritingDialog = document.getElementById("handwriting-dialog");
  const dialogTitle = document.getElementById("dialog-title");
  const dialogPrompt = document.getElementById("dialog-prompt");
  const fallbackInput = document.getElementById("fallback-input");
  const apiEndpointInput = document.getElementById("api-endpoint-input");
  const apiKeyInput = document.getElementById("api-key-input");
  const apiModelInput = document.getElementById("api-model-input");
  const questionTemplate = document.getElementById("question-template");
  const canvas = document.getElementById("handwriting-canvas");
  const canvasContext = canvas.getContext("2d");

  let drawing = false;
  let hasInk = false;

  setupCanvas();
  bindEvents();
  render();

  function bindEvents() {
    modeButton.addEventListener("click", toggleMode);
    aiSettingsButton.addEventListener("click", openAiSettings);
    document.getElementById("close-ai-settings-button").addEventListener("click", closeAiSettings);
    document.getElementById("close-handwriting-button").addEventListener("click", closeHandwritingDialog);
    document.getElementById("save-ai-settings-button").addEventListener("click", saveAiSettings);
    document.getElementById("clear-ai-settings-button").addEventListener("click", clearAiSettings);
    document.getElementById("clear-canvas-button").addEventListener("click", clearCanvas);
    document.getElementById("submit-answer-button").addEventListener("click", submitHandwriting);
  }

  function render() {
    renderLessonList();
    renderLesson();
    updateModeText();
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
      const blankButton = fragment.querySelector(".blank-button");
      const showAnswerButton = fragment.querySelector(".show-answer-button");
      const feedbackEl = fragment.querySelector(".question-feedback");

      indexEl.textContent = `第 ${index + 1} 題`;
      textEl.innerHTML = buildSentenceMarkup(item);

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
        statusEl.textContent = "答對了";
        feedbackEl.textContent = item.feedback || `辨識結果：${item.recognizedText || item.userAnswer}`;
      } else if (item.isCorrect === false) {
        card.classList.add("is-incorrect");
        statusEl.textContent = "再試一次";
        feedbackEl.textContent = item.feedback || `辨識結果：${item.recognizedText || item.userAnswer}，正確答案是 ${item.answer}`;
      }

      questionList.appendChild(fragment);
    });
  }

  function updateModeText() {
    const modeText = state.checkMode === "ai" ? "目前模式：AI 判讀" : "目前模式：人工檢查";
    modeIndicator.textContent = modeText;
    modeButton.textContent = state.checkMode === "ai" ? "切換人工檢查" : "切換 AI 判讀";
  }

  function buildSentenceMarkup(item) {
    const safeText = escapeHtml(item.text);
    const safeAnswer = escapeHtml(item.answer);
    const replacement = `<span class="blank-inline">${item.userAnswer ? escapeHtml(item.userAnswer) : "＿＿"}</span>`;
    return safeText.includes(safeAnswer)
      ? safeText.replace(safeAnswer, replacement)
      : `${safeText} <span class="blank-inline">${item.userAnswer ? escapeHtml(item.userAnswer) : "＿＿"}</span>`;
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
    const imageDataUrl = canvas.toDataURL("image/png");
    let result;

    if (state.checkMode === "ai" && hasAiSettings()) {
      try {
        setSubmittingState(true);
        result = await checkAnswerWithAi(item.answer, imageDataUrl, fallbackText);
      } catch (error) {
        result = {
          recognizedText: fallbackText,
          isCorrect: fallbackText === item.answer,
          feedback: "AI 判讀失敗，已改用補打文字比對。"
        };
      } finally {
        setSubmittingState(false);
      }
    } else {
      result = {
        recognizedText: fallbackText || "未提供補打文字",
        isCorrect: fallbackText === item.answer,
        feedback: fallbackText
          ? `已用補打文字比對。${fallbackText === item.answer ? "答案正確。" : `正確答案是 ${item.answer}。`}`
          : "目前是人工檢查模式，請搭配顯示答案確認。"
      };
    }

    item.userAnswer = result.recognizedText || fallbackText || "手寫作答";
    item.recognizedText = result.recognizedText || "";
    item.isCorrect = Boolean(result.isCorrect);
    item.feedback = result.feedback || "";
    item.isRevealed = false;
    closeHandwritingDialog();
    renderLesson();
  }

  function setSubmittingState(isSubmitting) {
    const button = document.getElementById("submit-answer-button");
    button.disabled = isSubmitting;
    button.textContent = isSubmitting ? "AI 判讀中..." : "送出答案";
  }

  async function checkAnswerWithAi(expectedAnswer, imageDataUrl, fallbackText) {
    const response = await fetch(state.aiSettings.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.aiSettings.apiKey}`
      },
      body: JSON.stringify({
        model: state.aiSettings.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "你是國語生字批改助理。請辨識單一手寫中文答案，並和 expectedAnswer 比對。只回傳 JSON：recognizedText、isCorrect、feedback。feedback 使用繁體中文，簡短即可。"
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `expectedAnswer: ${expectedAnswer}\nfallbackText: ${fallbackText || "無"}\n請只根據手寫圖片辨識；如果看不清楚，可參考 fallbackText。`
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;

    return {
      recognizedText: parsed.recognizedText || fallbackText || "",
      isCorrect: Boolean(parsed.isCorrect),
      feedback: parsed.feedback || ""
    };
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

  function toggleMode() {
    state.checkMode = state.checkMode === "ai" ? "manual" : "ai";
    localStorage.setItem(STORAGE_KEYS.mode, state.checkMode);
    render();
  }

  function openAiSettings() {
    apiEndpointInput.value = state.aiSettings.endpoint;
    apiKeyInput.value = state.aiSettings.apiKey;
    apiModelInput.value = state.aiSettings.model;
    aiSettingsDialog.hidden = false;
  }

  function closeAiSettings() {
    aiSettingsDialog.hidden = true;
  }

  function closeHandwritingDialog() {
    handwritingDialog.hidden = true;
  }

  function saveAiSettings() {
    state.aiSettings = {
      endpoint: apiEndpointInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      model: apiModelInput.value.trim()
    };
    localStorage.setItem(STORAGE_KEYS.ai, JSON.stringify(state.aiSettings));
    closeAiSettings();
    render();
  }

  function clearAiSettings() {
    state.aiSettings = { endpoint: "", apiKey: "", model: "" };
    localStorage.removeItem(STORAGE_KEYS.ai);
    apiEndpointInput.value = "";
    apiKeyInput.value = "";
    apiModelInput.value = "";
    render();
  }

  function loadAiSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.ai)) || { endpoint: "", apiKey: "", model: "" };
    } catch (error) {
      return { endpoint: "", apiKey: "", model: "" };
    }
  }

  function hasAiSettings() {
    return Boolean(state.aiSettings.endpoint && state.aiSettings.apiKey && state.aiSettings.model);
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
