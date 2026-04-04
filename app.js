(function () {
  var state = {
    lessons: [],
    currentLessonId: null
  };

  var lessonList = document.getElementById("lesson-list");
  var lessonTitle = document.getElementById("lesson-title");
  var lessonDescription = document.getElementById("lesson-description");
  var scoreLabel = document.getElementById("score-label");
  var questionStage = document.getElementById("question-stage");
  var reviewStage = document.getElementById("review-stage");
  var questionProgress = document.getElementById("question-progress");
  var questionHint = document.getElementById("question-hint");
  var questionSentence = document.getElementById("question-sentence");
  var reviewList = document.getElementById("review-list");
  var reviewTemplate = document.getElementById("review-template");
  var bankDialog = document.getElementById("bank-dialog");
  var bankTitle = document.getElementById("bank-title");
  var bankList = document.getElementById("bank-list");
  var canvasGrid = document.getElementById("canvas-grid");

  var activePads = [];

  initializeState();
  bindEvents();
  render();

  function initializeState() {
    var sourceLessons = window.LESSONS || [];
    state.lessons = sourceLessons.map(function (lesson) {
      return {
        id: lesson.id,
        name: lesson.name,
        description: lesson.description,
        bankItems: cloneBankItems(lesson.items, lesson.id),
        currentIndex: 0,
        items: shuffleItems(cloneBankItems(lesson.items, lesson.id))
      };
    });

    state.currentLessonId = state.lessons.length ? state.lessons[0].id : null;
  }

  function bindEvents() {
    document.getElementById("clear-canvas-button").addEventListener("click", clearPads);
    document.getElementById("submit-answer-button").addEventListener("click", submitCurrentQuestion);
    document.getElementById("restart-button").addEventListener("click", restartLesson);
    document.getElementById("bank-button").addEventListener("click", openBankDialog);
    document.getElementById("close-bank-button").addEventListener("click", closeBankDialog);
  }

  function render() {
    renderLessonList();
    renderCurrentLesson();
  }

  function renderLessonList() {
    lessonList.innerHTML = "";

    state.lessons.forEach(function (lesson) {
      var button = document.createElement("button");
      button.className = "lesson-button" + (lesson.id === state.currentLessonId ? " is-active" : "");
      button.type = "button";
      button.innerHTML = "<strong>" + escapeHtml(lesson.name) + "</strong><span>" + getDoneCount(lesson) + " / " + lesson.items.length + " 題</span>";
      button.addEventListener("click", function () {
        state.currentLessonId = lesson.id;
        render();
        clearPads();
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
      questionStage.hidden = true;
      reviewStage.hidden = true;
      return;
    }

    lessonTitle.textContent = lesson.name;
    lessonDescription.textContent = lesson.description;
    scoreLabel.textContent = getDoneCount(lesson) + " / " + lesson.items.length;

    if (lesson.currentIndex >= lesson.items.length) {
      questionStage.hidden = true;
      reviewStage.hidden = false;
      renderReview(lesson);
      return;
    }

    reviewStage.hidden = true;
    questionStage.hidden = false;
    renderQuestion(lesson.items[lesson.currentIndex], lesson.currentIndex, lesson.items.length);
  }

  function renderQuestion(item, currentIndex, totalCount) {
    questionProgress.textContent = "第 " + (currentIndex + 1) + " 題 / 共 " + totalCount + " 題";
    questionHint.textContent = "注音提示：" + (item.hint || "無");
    questionSentence.innerHTML = buildPromptMarkup(item);
    renderPads(item);
  }

  function renderReview(lesson) {
    reviewList.innerHTML = "";

    lesson.items.forEach(function (item, index) {
      var fragment = reviewTemplate.content.cloneNode(true);
      var indexEl = fragment.querySelector(".review-index");
      var sentenceEl = fragment.querySelector(".review-sentence");
      var compareCanvasList = fragment.querySelector(".compare-canvas-list");
      var compareAnswer = fragment.querySelector(".compare-answer");
      var compareHint = fragment.querySelector(".compare-hint");

      indexEl.textContent = "第 " + (index + 1) + " 題";
      sentenceEl.innerHTML = buildAnswerMarkup(item);
      compareAnswer.textContent = item.answer;
      compareHint.textContent = "注音：" + (item.hint || "");

      reviewList.appendChild(fragment);

      if (item.handwritingImages && item.handwritingImages.length) {
        var appendedCard = reviewList.lastElementChild;
        var appendedList = appendedCard ? appendedCard.querySelector(".compare-canvas-list") : null;
        if (appendedList) {
          drawPreviewList(appendedList, item.handwritingImages);
        }
      }
    });
  }

  function submitCurrentQuestion() {
    var lesson = getCurrentLesson();
    var item = lesson ? lesson.items[lesson.currentIndex] : null;

    if (!item) {
      return;
    }

    if (!allPadsFilled()) {
      window.alert("請先手寫再送出。");
      return;
    }

    item.handwritingImages = activePads.map(function (pad) {
      return pad.canvas.toDataURL("image/jpeg", 0.82);
    });
    item.isDone = true;
    lesson.currentIndex += 1;
    clearPads();
    render();
  }

  function restartLesson() {
    var lesson = getCurrentLesson();
    if (!lesson) {
      return;
    }

    lesson.items = shuffleItems(cloneBankItems(lesson.bankItems, lesson.id));

    lesson.items.forEach(function (item) {
      item.isDone = false;
    });

    lesson.currentIndex = 0;
    clearPads();
    render();
  }

  function openBankDialog() {
    var lesson = getCurrentLesson();
    if (!lesson) {
      return;
    }

    bankTitle.textContent = lesson.name + " 題庫";
    bankList.innerHTML = "";

    lesson.bankItems.forEach(function (item, index) {
      var card = document.createElement("article");
      card.className = "bank-item";
      card.innerHTML =
        '<p class="bank-meta">第 ' + (index + 1) + ' 題候選</p>' +
        '<p>' + buildAnswerMarkup(item) + '</p>' +
        '<p class="bank-answer">答案：' + escapeHtml(item.answer) + '　注音：' + escapeHtml(item.hint || "無") + "</p>";
      bankList.appendChild(card);
    });

    bankDialog.hidden = false;
  }

  function closeBankDialog() {
    bankDialog.hidden = true;
  }

  function createPad(canvas) {
    var ctx = canvas.getContext("2d");
    var pad = {
      canvas: canvas,
      ctx: ctx,
      drawing: false,
      hasInk: false
    };

    resetPad(pad);

    function getPoint(event) {
      var rect = canvas.getBoundingClientRect();
      var source = event;
      if (event.touches && event.touches.length) {
        source = event.touches[0];
      }

      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      return {
        x: (source.clientX - rect.left) * scaleX,
        y: (source.clientY - rect.top) * scaleY
      };
    }

    function startStroke(event) {
      if (event.preventDefault) {
        event.preventDefault();
      }

      pad.drawing = true;
      pad.hasInk = true;
      var point = getPoint(event);
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }

    function moveStroke(event) {
      if (!pad.drawing) {
        return;
      }

      if (event.preventDefault) {
        event.preventDefault();
      }

      var point = getPoint(event);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    function endStroke() {
      pad.drawing = false;
      ctx.closePath();
    }

    canvas.addEventListener("pointerdown", startStroke);
    canvas.addEventListener("pointermove", moveStroke);
    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointerleave", endStroke);
    canvas.addEventListener("mousedown", startStroke);
    canvas.addEventListener("mousemove", moveStroke);
    canvas.addEventListener("mouseup", endStroke);
    canvas.addEventListener("touchstart", startStroke, false);
    canvas.addEventListener("touchmove", moveStroke, false);
    canvas.addEventListener("touchend", endStroke, false);

    return pad;
  }

  function renderPads(item) {
    canvasGrid.innerHTML = "";
    activePads = [];

    var characters = splitAnswerUnits(item.answer);
    var hints = splitHintUnits(item.hint, characters.length);

    characters.forEach(function (character, index) {
      var cell = document.createElement("div");
      cell.className = "canvas-cell";

      var label = document.createElement("div");
      label.className = "canvas-label";
      label.textContent = "第 " + (index + 1) + " 字：" + character + "　注音：" + hints[index];

      var charCanvas = document.createElement("canvas");
      charCanvas.className = "char-canvas";
      charCanvas.width = 900;
      charCanvas.height = 900;
      charCanvas.setAttribute("aria-label", "第 " + (index + 1) + " 字手寫格");

      cell.appendChild(label);
      cell.appendChild(charCanvas);
      canvasGrid.appendChild(cell);
      activePads.push(createPad(charCanvas));
    });
  }

  function clearPads() {
    activePads.forEach(function (pad) {
      resetPad(pad);
    });
  }

  function resetPad(pad) {
    pad.ctx.fillStyle = "#ffffff";
    pad.ctx.fillRect(0, 0, pad.canvas.width, pad.canvas.height);
    pad.ctx.lineWidth = 26;
    pad.ctx.lineCap = "round";
    pad.ctx.lineJoin = "round";
    pad.ctx.strokeStyle = "#1d2730";
    pad.hasInk = false;
    pad.drawing = false;
  }

  function allPadsFilled() {
    if (!activePads.length) {
      return false;
    }

    for (var i = 0; i < activePads.length; i += 1) {
      if (!activePads[i].hasInk) {
        return false;
      }
    }
    return true;
  }

  function buildPromptMarkup(item) {
    var safeText = escapeHtml(item.text);
    var safeAnswer = escapeHtml(item.answer);
    var characters = splitAnswerUnits(item.answer);
    var hints = splitHintUnits(item.hint, characters.length);
    var blankParts = [];
    for (var i = 0; i < characters.length; i += 1) {
      blankParts.push('<span class="blank-inline blank-ruby"><ruby>＿<rt>' + escapeHtml(hints[i]) + "</rt></ruby></span>");
    }
    var replacement = blankParts.join("");

    if (safeText.indexOf(safeAnswer) >= 0) {
      return safeText.replace(safeAnswer, replacement);
    }

    return safeText + " " + replacement;
  }

  function buildAnswerMarkup(item) {
    var safeText = escapeHtml(item.text);
    var safeAnswer = escapeHtml(item.answer);
    var characters = splitAnswerUnits(item.answer);
    var hints = splitHintUnits(item.hint, characters.length);
    var answerParts = [];
    for (var i = 0; i < characters.length; i += 1) {
      answerParts.push('<span class="blank-inline blank-ruby"><ruby>' + escapeHtml(characters[i]) + "<rt>" + escapeHtml(hints[i]) + "</rt></ruby></span>");
    }
    var replacement = answerParts.join("");

    if (safeText.indexOf(safeAnswer) >= 0) {
      return safeText.replace(safeAnswer, replacement);
    }

    return safeText + " " + replacement;
  }

  function drawPreviewToCanvas(targetCanvas, dataUrl) {
    if (!targetCanvas) {
      return;
    }

    var ctx = targetCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

    if (!dataUrl) {
      return;
    }

    var image = new Image();
    image.onload = function () {
      var scale = Math.min(targetCanvas.width / image.width, targetCanvas.height / image.height);
      var drawWidth = image.width * scale;
      var drawHeight = image.height * scale;
      var offsetX = (targetCanvas.width - drawWidth) / 2;
      var offsetY = (targetCanvas.height - drawHeight) / 2;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
      ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    };
    image.src = dataUrl;
  }

  function drawPreviewList(container, imageList) {
    container.innerHTML = "";

    imageList.forEach(function (dataUrl, index) {
      var label = document.createElement("div");
      label.className = "canvas-label";
      label.textContent = "第 " + (index + 1) + " 字";

      var canvas = document.createElement("canvas");
      canvas.className = "compare-canvas";
      canvas.width = 600;
      canvas.height = 400;

      container.appendChild(label);
      container.appendChild(canvas);
      drawPreviewToCanvas(canvas, dataUrl);
    });
  }

  function getCurrentLesson() {
    for (var i = 0; i < state.lessons.length; i += 1) {
      if (state.lessons[i].id === state.currentLessonId) {
        return state.lessons[i];
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

  function shuffleItems(items) {
    var result = items.slice();
    for (var i = result.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  function splitAnswerUnits(answer) {
    return Array.from(String(answer).replace(/\s+/g, ""));
  }

  function splitHintUnits(hint, count) {
    var parts = String(hint || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === count) {
      return parts;
    }

    var result = [];
    for (var i = 0; i < count; i += 1) {
      result.push(parts[i] || (hint || "無"));
    }
    return result;
  }

  function cloneBankItems(items, lessonId) {
    return items.map(function (item, index) {
      return {
        id: lessonId + "-" + (index + 1),
        text: item.text,
        answer: item.answer,
        hint: item.hint || "",
        handwritingImages: [],
        isDone: false
      };
    });
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
