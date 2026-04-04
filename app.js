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
        currentIndex: 0,
        items: shuffleItems(lesson.items.map(function (item, index) {
          return {
            id: lesson.id + "-" + (index + 1),
            text: item.text,
            answer: item.answer,
            hint: item.hint || "",
            handwritingImage: "",
            isDone: false
          };
        }))
      };
    });

    state.currentLessonId = state.lessons.length ? state.lessons[0].id : null;
  }

  function bindEvents() {
    document.getElementById("clear-canvas-button").addEventListener("click", clearCanvas);
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
        clearCanvas();
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
  }

  function renderReview(lesson) {
    reviewList.innerHTML = "";

    lesson.items.forEach(function (item, index) {
      var fragment = reviewTemplate.content.cloneNode(true);
      var indexEl = fragment.querySelector(".review-index");
      var sentenceEl = fragment.querySelector(".review-sentence");
      var compareCanvas = fragment.querySelector(".compare-canvas");
      var compareAnswer = fragment.querySelector(".compare-answer");
      var compareHint = fragment.querySelector(".compare-hint");

      indexEl.textContent = "第 " + (index + 1) + " 題";
      sentenceEl.innerHTML = buildAnswerMarkup(item);
      compareAnswer.textContent = item.answer;
      compareHint.textContent = "注音：" + (item.hint || "");

      reviewList.appendChild(fragment);

      if (item.handwritingImage) {
        var appendedCard = reviewList.lastElementChild;
        var appendedCanvas = appendedCard ? appendedCard.querySelector(".compare-canvas") : null;
        if (appendedCanvas) {
          drawPreviewToCanvas(appendedCanvas, item.handwritingImage);
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

    if (!hasInk) {
      window.alert("請先手寫再送出。");
      return;
    }

    item.handwritingImage = canvas.toDataURL("image/jpeg", 0.82);
    item.isDone = true;
    lesson.currentIndex += 1;
    clearCanvas();
    renderCurrentLesson();
  }

  function restartLesson() {
    var lesson = getCurrentLesson();
    if (!lesson) {
      return;
    }

    lesson.items = shuffleItems(lesson.items.map(function (item) {
      item.handwritingImage = "";
      item.isDone = false;
      return item;
    }));

    lesson.currentIndex = 0;
    clearCanvas();
    renderCurrentLesson();
  }

  function openBankDialog() {
    var lesson = getCurrentLesson();
    if (!lesson) {
      return;
    }

    bankTitle.textContent = lesson.name + " 題庫";
    bankList.innerHTML = "";

    lesson.items.forEach(function (item, index) {
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

  function buildAnswerMarkup(item) {
    var safeText = escapeHtml(item.text);
    var safeAnswer = escapeHtml(item.answer);
    var hint = escapeHtml(item.hint || "");
    var replacement = '<span class="blank-inline blank-ruby"><ruby>' + safeAnswer + "<rt>" + hint + "</rt></ruby></span>";

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

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
