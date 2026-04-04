(function () {
  var state = {
    lessons: [],
    currentLessonId: null,
    currentItemId: null
  };

  var lessonList = document.getElementById("lesson-list");
  var lessonTitle = document.getElementById("lesson-title");
  var lessonDescription = document.getElementById("lesson-description");
  var questionList = document.getElementById("question-list");
  var scoreLabel = document.getElementById("score-label");
  var handwritingDialog = document.getElementById("handwriting-dialog");
  var dialogTitle = document.getElementById("dialog-title");
  var dialogPrompt = document.getElementById("dialog-prompt");
  var previewDialog = document.getElementById("preview-dialog");
  var previewCanvas = document.getElementById("preview-canvas");
  var previewAnswer = document.getElementById("preview-answer");
  var previewHint = document.getElementById("preview-hint");
  var questionTemplate = document.getElementById("question-template");
  var canvas = document.getElementById("handwriting-canvas");
  var canvasContext = canvas ? canvas.getContext("2d") : null;

  var drawing = false;
  var hasInk = false;

  initializeState();
  setupCanvas();
  bindEvents();
  render();

  function initializeState() {
    var sourceLessons = window.LESSONS || [];
    state.lessons = sourceLessons.map(function (lesson) {
      return {
        id: lesson.id,
        name: lesson.name,
        description: lesson.description,
        items: lesson.items.map(function (item, index) {
          return {
            id: lesson.id + "-" + (index + 1),
            text: item.text,
            answer: item.answer,
            hint: item.hint || "",
            userAnswer: "",
            handwritingImage: "",
            recognizedText: "",
            isCorrect: null,
            isRevealed: false,
            feedback: ""
          };
        })
      };
    });

    state.currentLessonId = state.lessons.length ? state.lessons[0].id : null;
  }

  function bindEvents() {
    document.getElementById("close-handwriting-button").addEventListener("click", closeHandwritingDialog);
    document.getElementById("close-preview-button").addEventListener("click", closePreviewDialog);
    document.getElementById("clear-canvas-button").addEventListener("click", clearCanvas);
    document.getElementById("submit-answer-button").addEventListener("click", submitHandwriting);
    questionList.addEventListener("click", handleQuestionListClick);
  }

  function render() {
    renderLessonList();
    renderLesson();
  }

  function renderLessonList() {
    lessonList.innerHTML = "";

    state.lessons.forEach(function (lesson) {
      var button = document.createElement("button");
      button.className = "lesson-button" + (lesson.id === state.currentLessonId ? " is-active" : "");
      button.type = "button";
      button.innerHTML = "<strong>" + escapeHtml(lesson.name) + "</strong><span>" + lesson.items.length + " 題</span>";
      button.addEventListener("click", function () {
        state.currentLessonId = lesson.id;
        render();
      });
      lessonList.appendChild(button);
    });
  }

  function renderLesson() {
    var lesson = getCurrentLesson();
    if (!lesson) {
      lessonTitle.textContent = "請先選擇課程";
      lessonDescription.textContent = "題目會把生字挖空，點擊空格後即可進入手寫作答。";
      questionList.innerHTML = "";
      scoreLabel.textContent = "0 / 0";
      return;
    }

    lessonTitle.textContent = lesson.name;
    lessonDescription.textContent = lesson.description;
    questionList.innerHTML = "";

    var completedCount = lesson.items.filter(function (item) {
      return item.isCorrect !== null || item.isRevealed;
    }).length;

    scoreLabel.textContent = completedCount + " / " + lesson.items.length;

    lesson.items.forEach(function (item, index) {
      var fragment = questionTemplate.content.cloneNode(true);
      var card = fragment.querySelector(".question-card");
      var indexEl = fragment.querySelector(".question-index");
      var statusEl = fragment.querySelector(".question-status");
      var textEl = fragment.querySelector(".question-text");
      var hintEl = fragment.querySelector(".question-hint");
      var blankButton = fragment.querySelector(".blank-button");
      var showAnswerButton = fragment.querySelector(".show-answer-button");
      var feedbackEl = fragment.querySelector(".question-feedback");
      var comparePanel = fragment.querySelector(".compare-panel");
      var compareCanvas = fragment.querySelector(".compare-canvas");
      var compareAnswer = fragment.querySelector(".compare-answer");
      var compareHint = fragment.querySelector(".compare-hint");

      indexEl.textContent = "第 " + (index + 1) + " 題";
      textEl.innerHTML = buildSentenceMarkup(item);
      hintEl.textContent = "注音提示：" + (item.hint || "無");

      blankButton.textContent = item.handwritingImage ? "查看手寫" : "點我手寫";
      blankButton.classList.toggle("is-filled", !!item.userAnswer);
      blankButton.addEventListener("click", function () {
        if (item.handwritingImage) {
          openPreviewDialog(item);
        } else {
          openHandwritingDialog(item);
        }
      });

      showAnswerButton.addEventListener("click", function () {
        revealAnswer(item.id);
      });

      if (item.isRevealed) {
        card.classList.add("is-revealed");
        statusEl.textContent = "已顯示答案";
        feedbackEl.textContent = "正確答案：" + item.answer;
        if (hasPreviewImage(item)) {
          comparePanel.hidden = false;
          drawPreviewToCanvas(compareCanvas, item.handwritingImage);
          compareAnswer.textContent = item.answer;
          compareHint.textContent = "注音：" + (item.hint || "");
        }
      } else if (item.isCorrect === true) {
        card.classList.add("is-correct");
        statusEl.textContent = "已作答";
        feedbackEl.textContent = item.feedback || "已記錄手寫作答。";
      }

      questionList.appendChild(fragment);
    });
  }

  function buildSentenceMarkup(item) {
    var safeText = escapeHtml(item.text);
    var safeAnswer = escapeHtml(item.answer);
    var hint = escapeHtml(item.hint || "");
    var blankText = item.handwritingImage ? "查看手寫" : "＿＿";
    var extraClass = item.handwritingImage ? " blank-inline--clickable" : "";
    var replacement = '<span class="blank-inline blank-ruby' + extraClass + '" data-preview-id="' + escapeHtml(item.id) + '"><ruby>' + blankText + "<rt>" + hint + "</rt></ruby></span>";

    if (safeText.indexOf(safeAnswer) >= 0) {
      return safeText.replace(safeAnswer, replacement);
    }

    return safeText + " " + replacement;
  }

  function buildPromptMarkup(item) {
    var safeText = escapeHtml(item.text);
    var safeAnswer = escapeHtml(item.answer);
    var hint = escapeHtml(item.hint || "");
    var replacement = '<span class="blank-inline blank-ruby"><ruby>＿＿<rt>' + hint + "</rt></ruby></span>";

    if (safeText.indexOf(safeAnswer) >= 0) {
      return safeText.replace(safeAnswer, replacement);
    }

    return safeText + " " + replacement;
  }

  function openHandwritingDialog(item) {
    state.currentItemId = item.id;
    dialogTitle.textContent = "請寫字";
    dialogPrompt.innerHTML = buildPromptMarkup(item);
    clearCanvas();
    handwritingDialog.hidden = false;
  }

  function closeHandwritingDialog() {
    handwritingDialog.hidden = true;
  }

  function openPreviewDialog(item) {
    if (!hasPreviewImage(item)) {
      return;
    }

    drawPreviewToCanvas(previewCanvas, item.handwritingImage);
    previewAnswer.textContent = item.answer;
    previewHint.textContent = "注音：" + (item.hint || "");
    previewDialog.hidden = false;
  }

  function closePreviewDialog() {
    previewDialog.hidden = true;
  }

  function revealAnswer(itemId) {
    var item = findItemById(itemId);
    if (!item) {
      return;
    }

    item.isRevealed = true;
    item.userAnswer = item.answer;
    item.recognizedText = item.answer;
    item.isCorrect = true;
    item.feedback = "這題答案是 " + item.answer;
    renderLesson();
  }

  function submitHandwriting() {
    var item = findItemById(state.currentItemId);
    if (!item) {
      return;
    }

    if (!hasInk) {
      item.feedback = "請先手寫再送出。";
      renderLesson();
      return;
    }

    item.userAnswer = "已手寫作答";
    item.handwritingImage = canvas.toDataURL("image/jpeg", 0.82);
    item.recognizedText = "";
    item.isCorrect = true;
    item.feedback = "已記錄作答，可點「查看手寫」或按「顯示答案」人工核對。";
    item.isRevealed = false;
    closeHandwritingDialog();
    renderLesson();
  }

  function handleQuestionListClick(event) {
    var target = event.target;
    if (!target || !target.closest) {
      return;
    }

    var previewNode = target.closest("[data-preview-id]");
    if (!previewNode) {
      return;
    }

    var item = findItemById(previewNode.getAttribute("data-preview-id"));
    if (item) {
      openPreviewDialog(item);
    }
  }

  function setupCanvas() {
    if (!canvas || !canvasContext) {
      return;
    }

    clearCanvas();

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

      drawing = true;
      hasInk = true;
      var point = getPoint(event);
      canvasContext.beginPath();
      canvasContext.moveTo(point.x, point.y);
    }

    function moveStroke(event) {
      if (!drawing) {
        return;
      }

      if (event.preventDefault) {
        event.preventDefault();
      }

      var point = getPoint(event);
      canvasContext.lineTo(point.x, point.y);
      canvasContext.stroke();
    }

    function endStroke() {
      drawing = false;
      canvasContext.closePath();
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
  }

  function clearCanvas() {
    if (!canvasContext) {
      return;
    }

    canvasContext.fillStyle = "#ffffff";
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);
    canvasContext.lineWidth = 26;
    canvasContext.lineCap = "round";
    canvasContext.lineJoin = "round";
    canvasContext.strokeStyle = "#1d2730";
    hasInk = false;
  }

  function getCurrentLesson() {
    for (var i = 0; i < state.lessons.length; i += 1) {
      if (state.lessons[i].id === state.currentLessonId) {
        return state.lessons[i];
      }
    }
    return null;
  }

  function findItemById(itemId) {
    for (var i = 0; i < state.lessons.length; i += 1) {
      for (var j = 0; j < state.lessons[i].items.length; j += 1) {
        if (state.lessons[i].items[j].id === itemId) {
          return state.lessons[i].items[j];
        }
      }
    }
    return null;
  }

  function hasPreviewImage(item) {
    return !!(item && item.handwritingImage && item.handwritingImage.indexOf("data:image/") === 0);
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

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
