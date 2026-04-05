(function () {
  var state = {
    lessons: [],
    currentLessonId: null
  };

  var lessonList = document.getElementById("lesson-list");
  var lessonPanel = document.querySelector(".lesson-panel");
  var appShell = document.querySelector(".app-shell");
  var lessonTitle = document.getElementById("lesson-title");
  var lessonDescription = document.getElementById("lesson-description");
  var scoreLabel = document.getElementById("score-label");
  var questionStage = document.getElementById("question-stage");
  var reviewStage = document.getElementById("review-stage");
  var questionProgress = document.getElementById("question-progress");
  var questionHint = document.getElementById("question-hint");
  var questionSentence = document.getElementById("question-sentence");
  var charProgress = document.getElementById("char-progress");
  var charLabel = document.getElementById("char-label");
  var reviewList = document.getElementById("review-list");
  var reviewTemplate = document.getElementById("review-template");
  var bankDialog = document.getElementById("bank-dialog");
  var bankTitle = document.getElementById("bank-title");
  var bankList = document.getElementById("bank-list");
  var canvas = document.getElementById("handwriting-canvas");
  var canvasWrap = canvas ? canvas.parentElement : null;
  var canvasContext = canvas ? canvas.getContext("2d") : null;
  var submitButton = document.getElementById("submit-answer-button");
  var submitIconMark = document.getElementById("submit-icon-mark");
  var expandCanvasButton = document.getElementById("expand-canvas-button");
  var expandIconMark = document.getElementById("expand-icon-mark");
  var prevButton = document.getElementById("prev-button");
  var nextButton = document.getElementById("next-button");
  var restartButton = document.getElementById("restart-button");
  var bankButton = document.getElementById("bank-button");
  var closeBankButton = document.getElementById("close-bank-button");
  var clearCanvasButton = document.getElementById("clear-canvas-button");
  var toggleLessonPanelButton = document.getElementById("toggle-lesson-panel");

  var drawing = false;
  var hasInk = false;
  var isCanvasExpanded = false;
  var isLessonPanelCollapsed = true;

  initializeState();
  setupCanvas();
  bindEvents();
  render();

  function initializeState() {
    var sourceLessons = window.LESSONS || [];
    state.lessons = sourceLessons.map(function (lesson) {
      var bankItems = cloneItems(lesson.items, lesson.id);
      return {
        id: lesson.id,
        name: lesson.name,
        description: lesson.description,
        quizCount: lesson.quizCount || lesson.items.length,
        bankItems: bankItems,
        items: buildQuizItems(lesson),
        currentIndex: 0
      };
    });
    state.currentLessonId = state.lessons.length ? state.lessons[0].id : null;
  }

  function bindEvents() {
    if (clearCanvasButton) {
      clearCanvasButton.addEventListener("click", clearCanvas);
    }
    if (toggleLessonPanelButton) {
      toggleLessonPanelButton.addEventListener("click", toggleLessonPanel);
    }
    if (submitButton) {
      submitButton.addEventListener("click", submitCurrentQuestion);
    }
    if (expandCanvasButton) {
      expandCanvasButton.addEventListener("click", toggleCanvasExpand);
    }
    if (restartButton) {
      restartButton.addEventListener("click", restartLesson);
    }
    if (bankButton) {
      bankButton.addEventListener("click", openBankDialog);
    }
    if (closeBankButton) {
      closeBankButton.addEventListener("click", closeBankDialog);
    }
    if (prevButton) {
      prevButton.addEventListener("click", goPrevQuestion);
    }
    if (nextButton) {
      nextButton.addEventListener("click", goNextQuestion);
    }
    if (questionSentence) {
      questionSentence.addEventListener("click", handlePromptClick);
    }
    if (bankDialog) {
      bankDialog.addEventListener("click", function (event) {
        if (event.target === bankDialog) {
          closeBankDialog();
        }
      });
    }
  }

  function render() {
    renderLessonPanelState();
    renderLessonList();
    renderCurrentLesson();
  }

  function renderLessonList() {
    if (!lessonList) { return; }
    lessonList.innerHTML = "";

    state.lessons.forEach(function (lesson) {
      var button = document.createElement("button");
      var doneCount = getDoneCount(lesson);
      var lessonLabel = isLessonPanelCollapsed ? getShortLessonName(lesson.name) : lesson.name;
      button.className = "lesson-button" + (lesson.id === state.currentLessonId ? " is-active" : "");
      button.type = "button";
      button.innerHTML =
        "<strong>" + escapeHtml(lessonLabel) + "</strong>" +
        "<span>" + doneCount + " / " + lesson.items.length + " 題</span>";
      button.addEventListener("click", function () {
        state.currentLessonId = lesson.id;
        clearCanvas();
        render();
      });
      lessonList.appendChild(button);
    });
  }

  function renderCurrentLesson() {
    var lesson = getCurrentLesson();

    if (!lesson) {
      lessonTitle.textContent = "請先選擇課程";
      lessonDescription.textContent = "選課後會從第一題開始作答。";
      scoreLabel.textContent = "0 / 0";
      if (questionStage) { questionStage.hidden = true; }
      if (reviewStage) { reviewStage.hidden = true; }
      return;
    }

    lessonTitle.textContent = lesson.name;
    lessonDescription.textContent = lesson.description;
    scoreLabel.textContent = getDoneCount(lesson) + " / " + lesson.items.length;

    if (lesson.currentIndex >= lesson.items.length) {
      if (questionStage) { questionStage.hidden = true; }
      if (reviewStage) { reviewStage.hidden = false; }
      renderReview(lesson);
      return;
    }

    if (questionStage) { questionStage.hidden = false; }
    if (reviewStage) { reviewStage.hidden = true; }
    renderQuestion(lesson, lesson.items[lesson.currentIndex]);
  }

  function renderQuestion(lesson, item) {
    var chars = splitAnswerUnits(item.answer);
    var hints = splitHintUnits(item.hint, chars.length);
    var currentCharIndex = normalizeCharIndex(item, chars.length);
    var isLastQuestion = lesson.currentIndex === lesson.items.length - 1;
    var isLastChar = currentCharIndex === chars.length - 1;

    questionProgress.textContent = "第 " + (lesson.currentIndex + 1) + " 題 / 共 " + lesson.items.length + " 題";
    questionHint.textContent = "注音提示：" + (item.hint || "無");
    questionSentence.innerHTML = buildPromptMarkup(item, currentCharIndex);
    charProgress.textContent = "第 " + (currentCharIndex + 1) + " 字 / 共 " + chars.length + " 字";
    charLabel.textContent = "現在寫：第 " + (currentCharIndex + 1) + " 字　注音：" + (hints[currentCharIndex] || "無");

    if (prevButton) {
      prevButton.disabled = lesson.currentIndex === 0;
      prevButton.textContent = isCompactNav() ? "<<" : "上一題";
      prevButton.setAttribute("aria-label", "上一題");
      prevButton.setAttribute("title", "上一題");
    }
    if (nextButton) {
      nextButton.disabled = false;
      nextButton.textContent = isCompactNav() ? ">>" : (isLastQuestion ? "檢查答案" : "下一題");
      nextButton.setAttribute("aria-label", isLastQuestion ? "檢查答案" : "下一題");
      nextButton.setAttribute("title", isLastQuestion ? "檢查答案" : "下一題");
    }
    if (submitButton) {
      if (!isLastChar) {
        submitButton.setAttribute("aria-label", "送出這個字");
        submitButton.setAttribute("title", "送出這個字");
        if (submitIconMark) {
          submitIconMark.textContent = "✓";
        }
      } else {
        submitButton.setAttribute("aria-label", "送出這一題");
        submitButton.setAttribute("title", "送出這一題");
        if (submitIconMark) {
          submitIconMark.textContent = "✓";
        }
      }

      updateSubmitButtonState(Boolean(item.handwritingImages[currentCharIndex]));
    }

    restoreCanvasFromSavedImage(item.handwritingImages[currentCharIndex]);
  }

  function renderReview(lesson) {
    if (!reviewList || !reviewTemplate) { return; }
    reviewList.innerHTML = "";

    lesson.items.forEach(function (item, index) {
      var fragment = reviewTemplate.content.cloneNode(true);
      var reviewCard = fragment.querySelector(".review-card");
      var previewList = fragment.querySelector(".compare-canvas-list");

      fragment.querySelector(".review-index").textContent = "第 " + (index + 1) + " 題";
      fragment.querySelector(".review-sentence").innerHTML = buildAnswerMarkup(item);
      fragment.querySelector(".compare-answer").textContent = item.answer;
      fragment.querySelector(".compare-hint").textContent = "注音：" + (item.hint || "");

      if (reviewCard && !item.isDone) {
        reviewCard.classList.add("review-card--pending");
      }

      reviewList.appendChild(fragment);

      if (previewList) {
        drawPreviewList(previewList, item.handwritingImages);
      }
    });
  }

  function submitCurrentQuestion() {
    var lesson = getCurrentLesson();
    var item = lesson ? lesson.items[lesson.currentIndex] : null;
    var chars;
    var currentCharIndex;
    var isLastChar;

    if (!item) { return; }

    chars = splitAnswerUnits(item.answer);
    currentCharIndex = normalizeCharIndex(item, chars.length);
    isLastChar = currentCharIndex === chars.length - 1;

    item.handwritingImages[currentCharIndex] = hasInk ? canvas.toDataURL("image/png") : null;

    if (!isLastChar) {
      item.currentCharIndex = currentCharIndex + 1;
      clearCanvas();
      renderCurrentLesson();
      return;
    }

    item.currentCharIndex = chars.length - 1;
    item.isDone = true;
    renderCurrentLesson();
  }

  function restartLesson() {
    var lesson = getCurrentLesson();
    if (!lesson) { return; }

    lesson.items = buildQuizItemsFromBank(lesson);
    lesson.currentIndex = 0;
    clearCanvas();
    render();
  }

  function toggleCanvasExpand() {
    isCanvasExpanded = !isCanvasExpanded;
    if (canvasWrap) {
      canvasWrap.classList.toggle("is-expanded", isCanvasExpanded);
    }
    if (document.body) {
      document.body.classList.toggle("canvas-expanded-mode", isCanvasExpanded);
    }
    if (expandCanvasButton) {
      expandCanvasButton.setAttribute("aria-label", isCanvasExpanded ? "縮小畫布" : "放大書寫");
      expandCanvasButton.setAttribute("title", isCanvasExpanded ? "縮小畫布" : "放大書寫");
    }
    if (expandIconMark) {
      expandIconMark.textContent = isCanvasExpanded ? "×" : "⤢";
    }
  }

  function toggleLessonPanel() {
    isLessonPanelCollapsed = !isLessonPanelCollapsed;
    render();
  }

  function renderLessonPanelState() {
    if (lessonPanel) {
      lessonPanel.classList.toggle("is-collapsed", isLessonPanelCollapsed);
    }
    if (appShell) {
      appShell.classList.toggle("lesson-panel-collapsed", isLessonPanelCollapsed);
    }
    if (toggleLessonPanelButton) {
      toggleLessonPanelButton.textContent = isLessonPanelCollapsed ? "⇥" : "⇤";
      toggleLessonPanelButton.setAttribute("aria-label", isLessonPanelCollapsed ? "展開課程欄" : "縮起課程欄");
      toggleLessonPanelButton.setAttribute("title", isLessonPanelCollapsed ? "展開課程欄" : "縮起課程欄");
    }
  }

  function openBankDialog() {
    var lesson = getCurrentLesson();
    if (!lesson || !bankDialog || !bankList || !bankTitle) { return; }

    bankTitle.textContent = lesson.name + " 題庫";
    bankList.innerHTML = "";

    lesson.bankItems.forEach(function (item, index) {
      var card = document.createElement("article");
      card.className = "bank-item";
      card.innerHTML =
        '<p class="bank-meta">題庫第 ' + (index + 1) + ' 題</p>' +
        "<p>" + buildAnswerMarkup(item) + "</p>" +
        '<p class="bank-answer">答案：' + escapeHtml(item.answer) + "　注音：" + escapeHtml(item.hint || "") + "</p>";
      bankList.appendChild(card);
    });

    bankDialog.hidden = false;
  }

  function closeBankDialog() {
    if (bankDialog) {
      bankDialog.hidden = true;
    }
  }

  function goPrevQuestion() {
    var lesson = getCurrentLesson();
    if (!lesson || lesson.currentIndex <= 0) { return; }
    lesson.currentIndex -= 1;
    clearCanvas();
    renderCurrentLesson();
  }

  function goNextQuestion() {
    var lesson = getCurrentLesson();
    var blanks;
    var proceed;

    if (!lesson) { return; }

    if (lesson.currentIndex >= lesson.items.length - 1) {
      blanks = getBlankQuestionIndexes(lesson);
      if (blanks.length > 0) {
        proceed = window.confirm(
          "還有未完成的題目：" + blanks.join("、") + "。確定要先進入檢查答案頁嗎？"
        );
        if (!proceed) {
          return;
        }
      }

      lesson.currentIndex = lesson.items.length;
      clearCanvas();
      render();
      return;
    }

    lesson.currentIndex += 1;
    clearCanvas();
    renderCurrentLesson();
  }

  function handlePromptClick(event) {
    var target = event.target;
    var lesson = getCurrentLesson();
    var item;
    var charIndex;
    var chars;

    if (!lesson || !target) { return; }

    target = target.closest(".blank-inline");
    if (!target) { return; }

    item = lesson.items[lesson.currentIndex];
    if (!item) { return; }

    chars = splitAnswerUnits(item.answer);
    charIndex = Number(target.getAttribute("data-char-index"));

    if (isNaN(charIndex) || charIndex < 0 || charIndex >= chars.length) {
      return;
    }

    item.currentCharIndex = charIndex;
    renderCurrentLesson();
  }

  function setupCanvas() {
    if (!canvas || !canvasContext) { return; }

    clearCanvas();

    function getPoint(event) {
      var rect = canvas.getBoundingClientRect();
      var source = event.touches && event.touches.length ? event.touches[0] : event;
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      return {
        x: (source.clientX - rect.left) * scaleX,
        y: (source.clientY - rect.top) * scaleY
      };
    }

    function startStroke(event) {
      var point;
      if (event.preventDefault) { event.preventDefault(); }
      drawing = true;
      hasInk = true;
      updateSubmitButtonState(false);
      point = getPoint(event);
      canvasContext.beginPath();
      canvasContext.moveTo(point.x, point.y);
    }

    function moveStroke(event) {
      var point;
      if (!drawing) { return; }
      if (event.preventDefault) { event.preventDefault(); }
      point = getPoint(event);
      canvasContext.lineTo(point.x, point.y);
      canvasContext.stroke();
    }

    function endStroke() {
      if (!drawing) { return; }
      drawing = false;
      canvasContext.closePath();
    }

    canvas.addEventListener("pointerdown", startStroke);
    canvas.addEventListener("pointermove", moveStroke);
    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointercancel", endStroke);
    canvas.addEventListener("pointerleave", endStroke);

    canvas.addEventListener("mousedown", startStroke);
    canvas.addEventListener("mousemove", moveStroke);
    canvas.addEventListener("mouseup", endStroke);
    canvas.addEventListener("mouseleave", endStroke);

    canvas.addEventListener("touchstart", startStroke, { passive: false });
    canvas.addEventListener("touchmove", moveStroke, { passive: false });
    canvas.addEventListener("touchend", endStroke, { passive: false });
    canvas.addEventListener("touchcancel", endStroke, { passive: false });
  }

  function clearCanvas() {
    if (!canvasContext || !canvas) { return; }
    canvasContext.fillStyle = "#ffffff";
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);
    canvasContext.lineWidth = 26;
    canvasContext.lineCap = "round";
    canvasContext.lineJoin = "round";
    canvasContext.strokeStyle = "#1d2730";
    drawing = false;
    hasInk = false;
  }

  function restoreCanvasFromSavedImage(dataUrl) {
    clearCanvas();
    if (!dataUrl || !canvasContext || !canvas) { return; }

    var image = new Image();
    image.onload = function () {
      canvasContext.fillStyle = "#ffffff";
      canvasContext.fillRect(0, 0, canvas.width, canvas.height);
      canvasContext.drawImage(image, 0, 0, canvas.width, canvas.height);
      hasInk = true;
    };
    image.src = dataUrl;
  }

  function buildPromptMarkup(item, currentCharIndex) {
    var safeText = escapeHtml(item.text);
    var safeAnswer = escapeHtml(item.answer);
    var chars = splitAnswerUnits(item.answer);
    var hints = splitHintUnits(item.hint, chars.length);
    var parts = [];
    var index;
    var replacement;

    for (index = 0; index < chars.length; index += 1) {
      if (item.handwritingImages[index]) {
        parts.push(
          '<button class="blank-inline blank-ruby is-filled" type="button" data-char-index="' + index + '"><ruby>已寫<rt>' +
          escapeHtml(hints[index]) +
          "</rt></ruby></button>"
        );
      } else if (index === currentCharIndex) {
        parts.push(
          '<button class="blank-inline blank-ruby is-current" type="button" data-char-index="' + index + '"><ruby>　<rt>' +
          escapeHtml(hints[index]) +
          "</rt></ruby></button>"
        );
      } else {
        parts.push(
          '<button class="blank-inline blank-ruby" type="button" data-char-index="' + index + '"><ruby>　<rt>' +
          escapeHtml(hints[index]) +
          "</rt></ruby></button>"
        );
      }
    }

    replacement = parts.join("");
    if (safeText.indexOf(safeAnswer) >= 0) {
      return safeText.replace(safeAnswer, replacement);
    }
    return safeText + " " + replacement;
  }

  function buildAnswerMarkup(item) {
    var safeText = escapeHtml(item.text);
    var safeAnswer = escapeHtml(item.answer);
    var chars = splitAnswerUnits(item.answer);
    var hints = splitHintUnits(item.hint, chars.length);
    var parts = [];
    var index;
    var replacement;

    for (index = 0; index < chars.length; index += 1) {
      parts.push(
        '<span class="blank-inline blank-ruby is-answer"><ruby>' +
        escapeHtml(chars[index]) +
        "<rt>" +
        escapeHtml(hints[index]) +
        "</rt></ruby></span>"
      );
    }

    replacement = parts.join("");
    if (safeText.indexOf(safeAnswer) >= 0) {
      return safeText.replace(safeAnswer, replacement);
    }
    return safeText + " " + replacement;
  }

  function drawPreviewList(container, imageList) {
    container.innerHTML = "";

    if (!imageList || imageList.length === 0) {
      var empty = document.createElement("p");
      empty.className = "canvas-label";
      empty.textContent = "尚未作答";
      container.appendChild(empty);
      return;
    }

    imageList.forEach(function (dataUrl, index) {
      var block = document.createElement("div");
      var label = document.createElement("p");
      var previewCanvas = document.createElement("canvas");

      block.className = "compare-preview";
      label.className = "canvas-label";
      label.textContent = "第 " + (index + 1) + " 字";
      previewCanvas.className = "compare-canvas";
      previewCanvas.width = 600;
      previewCanvas.height = 600;

      block.appendChild(label);
      block.appendChild(previewCanvas);
      container.appendChild(block);
      drawPreviewToCanvas(previewCanvas, dataUrl);
    });
  }

  function drawPreviewToCanvas(targetCanvas, dataUrl) {
    var ctx;
    var image;

    if (!targetCanvas) { return; }

    ctx = targetCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

    if (!dataUrl) { return; }

    image = new Image();
    image.onload = function () {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
      ctx.drawImage(image, 0, 0, targetCanvas.width, targetCanvas.height);
    };
    image.src = dataUrl;
  }

  function getCurrentLesson() {
    var index;
    for (index = 0; index < state.lessons.length; index += 1) {
      if (state.lessons[index].id === state.currentLessonId) {
        return state.lessons[index];
      }
    }
    return null;
  }

  function getDoneCount(lesson) {
    var count = 0;
    lesson.items.forEach(function (item) {
      if (item.isDone) {
        count += 1;
      }
    });
    return count;
  }

  function getBlankQuestionIndexes(lesson) {
    var blanks = [];
    lesson.items.forEach(function (item, index) {
      if (!item.isDone) {
        blanks.push("第 " + (index + 1) + " 題");
      }
    });
    return blanks;
  }

  function normalizeCharIndex(item, charCount) {
    if (typeof item.currentCharIndex !== "number" || item.currentCharIndex < 0) {
      item.currentCharIndex = 0;
    }
    if (item.currentCharIndex > charCount - 1) {
      item.currentCharIndex = charCount - 1;
    }
    return item.currentCharIndex;
  }

  function shuffleItems(items) {
    var result = items.slice();
    var index;
    var swapIndex;
    var temp;

    for (index = result.length - 1; index > 0; index -= 1) {
      swapIndex = Math.floor(Math.random() * (index + 1));
      temp = result[index];
      result[index] = result[swapIndex];
      result[swapIndex] = temp;
    }

    return result;
  }

  function splitAnswerUnits(answer) {
    return Array.from(String(answer || "").replace(/\s+/g, ""));
  }

  function splitHintUnits(hint, count) {
    var parts = String(hint || "").trim().split(/\s+/).filter(Boolean);
    var result = [];
    var index;

    if (parts.length === count) {
      return parts;
    }

    for (index = 0; index < count; index += 1) {
      result.push(parts[index] || parts[0] || "");
    }

    return result;
  }

  function cloneItems(items, lessonId) {
    return items.map(function (item, index) {
      var charCount = splitAnswerUnits(item.answer).length;
      return {
        id: lessonId + "-" + (index + 1),
        text: item.text,
        answer: item.answer,
        hint: item.hint || "",
        handwritingImages: new Array(charCount).fill(null),
        currentCharIndex: 0,
        isDone: false
      };
    });
  }

  function buildQuizItems(lesson) {
    return buildQuizItemsFromBank({
      id: lesson.id,
      bankItems: cloneItems(lesson.items, lesson.id),
      quizCount: lesson.quizCount || lesson.items.length
    });
  }

  function buildQuizItemsFromBank(lesson) {
    return shuffleItems(cloneItems(lesson.bankItems, lesson.id)).slice(0, lesson.quizCount || lesson.bankItems.length);
  }

  function isCompactNav() {
    return window.matchMedia && window.matchMedia("(max-width: 919px)").matches;
  }

  function getShortLessonName(name) {
    var match = String(name || "").match(/^第[^ ]+課/);
    return match ? match[0] : String(name || "");
  }

  function updateSubmitButtonState(isSaved) {
    if (!submitButton) { return; }
    submitButton.classList.toggle("is-saved", Boolean(isSaved));
    submitButton.classList.toggle("is-pending", !isSaved);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
