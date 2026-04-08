(function () {
  var LESSON_BANK_STORAGE_KEY = "myquiz-lesson-bank-items-v2";
  var LEGACY_CUSTOM_BANK_STORAGE_KEY = "myquiz-custom-bank-items-v1";
  var DEFAULT_QUIZ_COUNT = 10;
  var BOPOMOFO_SYMBOLS = [
    "ㄅ", "ㄆ", "ㄇ", "ㄈ", "ㄉ", "ㄊ", "ㄋ", "ㄌ", "ㄍ", "ㄎ", "ㄏ",
    "ㄐ", "ㄑ", "ㄒ", "ㄓ", "ㄔ", "ㄕ", "ㄖ", "ㄗ", "ㄘ", "ㄙ",
    "ㄧ", "ㄨ", "ㄩ", "ㄚ", "ㄛ", "ㄜ", "ㄝ", "ㄞ", "ㄟ", "ㄠ", "ㄡ",
    "ㄢ", "ㄣ", "ㄤ", "ㄥ", "ㄦ", "˙", "ˊ", "ˇ", "ˋ"
  ];
  var state = {
    lessons: [],
    currentLessonId: null,
    storedBankItemsByLesson: {},
    editingBankItemId: null
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
  var bankForm = document.getElementById("bank-form");
  var bankSentenceInput = document.getElementById("bank-sentence-input");
  var bankAnswerInput = document.getElementById("bank-answer-input");
  var bankHintInput = document.getElementById("bank-hint-input");
  var bankFormStatus = document.getElementById("bank-form-status");
  var bankFormTitle = document.getElementById("bank-form-title");
  var addBankItemButton = document.getElementById("add-bank-item-button");
  var cancelBankEditButton = document.getElementById("cancel-bank-edit-button");
  var bopomofoToolbar = document.getElementById("bopomofo-toolbar");
  var bopomofoPalette = document.getElementById("bopomofo-palette");
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
  var enterQuizButton = document.getElementById("enter-quiz-button");
  var bankButton = document.getElementById("bank-button");
  var stageBankButton = document.getElementById("stage-bank-button");
  var stageLessonButton = document.getElementById("stage-lesson-button");
  var closeBankButton = document.getElementById("close-bank-button");
  var clearCanvasButton = document.getElementById("clear-canvas-button");
  var eraserButton = document.getElementById("eraser-button");
  var toggleLessonPanelButton = document.getElementById("toggle-lesson-panel");
  var lessonDrawerBackdrop = document.getElementById("lesson-drawer-backdrop");

  var drawing = false;
  var hasInk = false;
  var isErasing = false;
  var isCanvasExpanded = false;
  var isLessonPanelCollapsed = true;
  var isLessonDrawerOpen = false;
  var lastEraserCursorDiameter = 0;
  var ERASER_SIZE = 64;

  normalizeStaticLabels();
  setQuizScreenActive(false);
  initializeState();
  renderBopomofoPalette();
  setupCanvas();
  bindEvents();
  render();

  function normalizeStaticLabels() {
    if (enterQuizButton) {
      enterQuizButton.textContent = "開始作答";
    }
    if (bankButton) {
      bankButton.textContent = "檢視本課題庫";
    }
    if (stageBankButton) {
      stageBankButton.textContent = "檢視本課題庫";
    }
  }

  function setQuizScreenActive(isActive) {
    if (!document.body) { return; }
    document.body.classList.toggle("landing-mode", !isActive);
    document.body.classList.toggle("quiz-mode", Boolean(isActive));
    if (!isActive) {
      closeLessonDrawer();
    }
    if (isActive && appShell) {
      appShell.scrollTop = 0;
    }
  }

  function initializeState() {
    var sourceLessons = window.LESSONS || [];
    state.storedBankItemsByLesson = loadStoredBankItems();
    state.lessons = sourceLessons.map(function (lesson) {
      var storedItems = state.storedBankItemsByLesson[lesson.id];
      var sourceItems = getInitialBankSource(lesson, storedItems);
      var bankItems = cloneItems(sourceItems, lesson.id);
      return {
        id: lesson.id,
        name: lesson.name,
        description: lesson.description,
        quizCount: resolveQuizCount(bankItems.length),
        bankItems: bankItems,
        items: buildQuizItems(lesson, bankItems),
        currentIndex: 0
      };
    });
    state.currentLessonId = state.lessons.length ? state.lessons[0].id : null;
  }

  function bindEvents() {
    if (clearCanvasButton) {
      clearCanvasButton.addEventListener("click", clearCanvas);
    }
    if (eraserButton) {
      eraserButton.addEventListener("click", toggleEraserMode);
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
    if (enterQuizButton) {
      enterQuizButton.addEventListener("click", function () {
        setQuizScreenActive(true);
      });
    }
    if (bankButton) {
      bankButton.addEventListener("click", openBankDialog);
    }
    if (stageBankButton) {
      stageBankButton.addEventListener("click", openBankDialog);
    }
    if (stageLessonButton) {
      stageLessonButton.addEventListener("click", openLessonList);
    }
    if (closeBankButton) {
      closeBankButton.addEventListener("click", closeBankDialog);
    }
    if (bankForm) {
      bankForm.addEventListener("submit", handleBankFormSubmit);
    }
    if (cancelBankEditButton) {
      cancelBankEditButton.addEventListener("click", resetBankForm);
    }
    if (bankList) {
      bankList.addEventListener("click", handleBankListClick);
    }
    if (bopomofoToolbar) {
      bopomofoToolbar.addEventListener("click", handleBopomofoToolClick);
    }
    if (bopomofoPalette) {
      bopomofoPalette.addEventListener("click", handleBopomofoPaletteClick);
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
    if (lessonDrawerBackdrop) {
      lessonDrawerBackdrop.addEventListener("click", closeLessonDrawer);
    }
    document.addEventListener("keydown", handleGlobalKeydown);
  }

  function render() {
    renderLessonPanelState();
    renderLessonDrawerState();
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
        closeLessonDrawer();
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
    if (shouldHideLessonListFromPanel()) {
      hideLessonList();
      return;
    }

    isLessonPanelCollapsed = !isLessonPanelCollapsed;
    render();
  }

  function openLessonList() {
    isLessonPanelCollapsed = false;
    isLessonDrawerOpen = shouldUseLessonDrawer();
    render();
  }

  function hideLessonList() {
    if (shouldUseLessonDrawer()) {
      closeLessonDrawer();
      return;
    }

    if (!isLessonPanelCollapsed) {
      isLessonDrawerOpen = false;
      isLessonPanelCollapsed = true;
      render();
    }
  }

  function closeLessonDrawer() {
    if (!isLessonDrawerOpen) { return; }
    isLessonDrawerOpen = false;
    renderLessonDrawerState();
  }

  function renderLessonPanelState() {
    var isQuizShortcutVisible = isLessonShortcutVisible();
    var isLessonListVisible = isLessonListShown();

    if (lessonPanel) {
      lessonPanel.classList.toggle("is-collapsed", isLessonPanelCollapsed);
    }
    if (appShell) {
      appShell.classList.toggle("lesson-panel-collapsed", isLessonPanelCollapsed);
    }
    if (toggleLessonPanelButton) {
      if (isQuizShortcutVisible) {
        toggleLessonPanelButton.textContent = isLessonListVisible ? "\u21e4" : "\u21e5";
        toggleLessonPanelButton.setAttribute(
          "aria-label",
          isLessonListVisible ? "\u96b1\u85cf\u8ab2\u7a0b\u5217\u8868" : "\u5c55\u958b\u8ab2\u7a0b\u5217\u8868"
        );
        toggleLessonPanelButton.setAttribute(
          "title",
          isLessonListVisible ? "\u96b1\u85cf\u8ab2\u7a0b\u5217\u8868" : "\u5c55\u958b\u8ab2\u7a0b\u5217\u8868"
        );
      } else {
        toggleLessonPanelButton.textContent = isLessonPanelCollapsed ? "\u21e5" : "\u21e4";
        toggleLessonPanelButton.setAttribute(
          "aria-label",
          isLessonPanelCollapsed ? "\u5c55\u958b\u8ab2\u7a0b\u6b04" : "\u7e2e\u8d77\u8ab2\u7a0b\u6b04"
        );
        toggleLessonPanelButton.setAttribute(
          "title",
          isLessonPanelCollapsed ? "\u5c55\u958b\u8ab2\u7a0b\u6b04" : "\u7e2e\u8d77\u8ab2\u7a0b\u6b04"
        );
      }
    }
  }

  function renderLessonDrawerState() {
    var shouldShowDrawer = shouldUseLessonDrawer() && isLessonDrawerOpen;

    if (document.body) {
      document.body.classList.toggle("lesson-drawer-open", shouldShowDrawer);
    }
    if (lessonDrawerBackdrop) {
      lessonDrawerBackdrop.hidden = !shouldShowDrawer;
    }
    if (stageLessonButton) {
      stageLessonButton.setAttribute("aria-expanded", isLessonListShown() ? "true" : "false");
    }
  }

  function shouldUseLessonDrawer() {
    return window.matchMedia("(max-width: 699px), (min-width: 920px) and (max-width: 1280px)").matches;
  }

  function isQuizModeActive() {
    return Boolean(document.body) && document.body.classList.contains("quiz-mode");
  }

  function isLessonShortcutVisible() {
    return Boolean(stageLessonButton) &&
      isQuizModeActive() &&
      window.getComputedStyle(stageLessonButton).display !== "none";
  }

  function isLessonListShown() {
    return shouldUseLessonDrawer() ? isLessonDrawerOpen : !isLessonPanelCollapsed;
  }

  function shouldHideLessonListFromPanel() {
    return isLessonShortcutVisible() && isLessonListShown();
  }

  function handleGlobalKeydown(event) {
    if (event.key === "Escape") {
      closeLessonDrawer();
    }
  }

  function openBankDialog() {
    var lesson = getCurrentLesson();
    if (!lesson || !bankDialog || !bankList || !bankTitle) { return; }

    bankTitle.textContent = lesson.name + " 題庫";
    renderBankList(lesson);
    resetBankForm();
    bankDialog.hidden = false;
  }

  function closeBankDialog() {
    if (bankDialog) {
      bankDialog.hidden = true;
    }
  }

  function renderBankList(lesson) {
    if (!bankList) { return; }

    bankList.innerHTML = "";

    lesson.bankItems.forEach(function (item, index) {
      var card = document.createElement("article");
      card.className = "bank-item";
      card.innerHTML =
        '<div class="bank-item-header">' +
          '<p class="bank-meta">題庫第 ' + (index + 1) + ' 題</p>' +
          (item.isCustom ? '<span class="bank-badge">手動新增</span>' : "") +
        "</div>" +
        "<p>" + buildAnswerMarkup(item) + "</p>" +
        '<p class="bank-answer">答案：' + escapeHtml(item.answer) + "　注音：" + escapeHtml(item.hint || "") + "</p>" +
        '<div class="bank-item-actions">' +
          '<button class="secondary-button bank-item-action" type="button" data-bank-action="edit" data-bank-id="' + escapeHtml(item.id) + '">修改</button>' +
          '<button class="secondary-button bank-item-action bank-item-action--danger" type="button" data-bank-action="delete" data-bank-id="' + escapeHtml(item.id) + '">刪除</button>' +
        "</div>";
      bankList.appendChild(card);
    });
  }

  function handleBankFormSubmit(event) {
    var lesson = getCurrentLesson();
    var sentence;
    var answer;
    var hint;
    var item;
    var storageSaved;
    var editingItem;

    if (event && event.preventDefault) {
      event.preventDefault();
    }

    if (!lesson || !bankSentenceInput || !bankAnswerInput || !bankHintInput) {
      return;
    }

    sentence = normalizeText(bankSentenceInput.value);
    answer = normalizeAnswer(bankAnswerInput.value);
    hint = normalizeHintText(bankHintInput.value);

    if (!sentence) {
      setBankFormStatus("請先輸入句子。", "error");
      bankSentenceInput.focus();
      return;
    }

    if (!answer) {
      setBankFormStatus("請輸入要考的單字或詞語。", "error");
      bankAnswerInput.focus();
      return;
    }

    if (sentence.indexOf(answer) < 0) {
      setBankFormStatus("句子裡找不到這個字詞，請確認內容一致。", "error");
      bankAnswerInput.focus();
      return;
    }

    if (!hint) {
      setBankFormStatus("請先手動填入注音。", "error");
      bankHintInput.focus();
      return;
    }

    editingItem = findBankItemById(lesson, state.editingBankItemId);

    if (editingItem) {
      editingItem.text = sentence;
      editingItem.answer = answer;
      editingItem.hint = hint;
      editingItem.handwritingImages = new Array(splitAnswerUnits(answer).length).fill(null);
      editingItem.currentCharIndex = 0;
      editingItem.isDone = false;
      storageSaved = persistLessonBankItems(lesson);
    } else {
      item = createBankItem(lesson.id, {
        text: sentence,
        answer: answer,
        hint: hint,
        isCustom: true
      }, lesson.bankItems.length);

      lesson.bankItems.push(item);
      storageSaved = persistLessonBankItems(lesson);
    }

    renderBankList(lesson);
    render();
    resetBankForm();
    setBankFormStatus(
      storageSaved
        ? (editingItem ? "題目已更新。重新練習本課後，新的題庫內容就會被抽到。" : "已加入本課題庫。重新練習本課後，新題目就能被抽到。")
        : "已加入本次題庫，但這台裝置目前無法儲存到本機。",
      storageSaved ? "success" : "error"
    );
  }

  function resetBankForm() {
    if (bankForm) {
      bankForm.reset();
    }
    state.editingBankItemId = null;
    if (bankFormTitle) {
      bankFormTitle.textContent = "手動新增題目";
    }
    if (addBankItemButton) {
      addBankItemButton.textContent = "新增到本課題庫";
    }
    if (cancelBankEditButton) {
      cancelBankEditButton.hidden = true;
    }
    setBankFormStatus("輸入句子和要考的字詞後，再用注音欄或下方符號表手動拼出注音。", "");
  }

  function handleBankListClick(event) {
    var target = event.target;
    var lesson = getCurrentLesson();
    var action;
    var bankId;
    var item;
    var storageSaved;
    var index;

    if (!lesson || !target) { return; }

    target = target.closest("[data-bank-action]");
    if (!target) { return; }

    action = target.getAttribute("data-bank-action");
    bankId = target.getAttribute("data-bank-id");
    item = findBankItemById(lesson, bankId);
    index = findBankItemIndexById(lesson, bankId);

    if (!item || index < 0) { return; }

    if (action === "edit") {
      state.editingBankItemId = item.id;
      if (bankSentenceInput) {
        bankSentenceInput.value = item.text;
      }
      if (bankAnswerInput) {
        bankAnswerInput.value = item.answer;
      }
      if (bankHintInput) {
        bankHintInput.value = item.hint;
      }
      if (bankFormTitle) {
        bankFormTitle.textContent = "修改題目";
      }
      if (addBankItemButton) {
        addBankItemButton.textContent = "儲存修改";
      }
      if (cancelBankEditButton) {
        cancelBankEditButton.hidden = false;
      }
      setBankFormStatus("正在編輯這一題，改完後按「儲存修改」。", "success");
      if (bankSentenceInput && bankSentenceInput.focus) {
        bankSentenceInput.focus();
      }
      return;
    }

    if (action === "delete") {
      if (!window.confirm("確定要刪除這一題嗎？")) {
        return;
      }
      lesson.bankItems.splice(index, 1);
      storageSaved = persistLessonBankItems(lesson);
      if (state.editingBankItemId === bankId) {
        resetBankForm();
      }
      renderBankList(lesson);
      render();
      setBankFormStatus(
        storageSaved ? "題目已刪除。重新練習本課後，新的題庫內容就會被抽到。" : "題目已刪除，但這台裝置目前無法儲存到本機。",
        storageSaved ? "success" : "error"
      );
    }
  }

  function setBankFormStatus(message, type) {
    if (!bankFormStatus) { return; }
    bankFormStatus.textContent = message;
    bankFormStatus.classList.remove("is-error", "is-success");
    if (type === "error") {
      bankFormStatus.classList.add("is-error");
    }
    if (type === "success") {
      bankFormStatus.classList.add("is-success");
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

    function getStrokeWidth(event) {
      var pressure = typeof event.pressure === "number" && event.pressure > 0 ? event.pressure : 0;
      if (isErasing) {
        return getCanvasEraserSize();
      }
      if (event.pointerType === "pen") {
        return pressure > 0 ? 1.5 + (pressure * 2.5) : 2.5;
      }
      return 4.5;
    }

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

    function getCanvasEraserSize() {
      var rect;
      var scaleX;
      var scaleY;
      if (!canvas) { return ERASER_SIZE; }
      rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) { return ERASER_SIZE; }
      scaleX = canvas.width / rect.width;
      scaleY = canvas.height / rect.height;
      return ERASER_SIZE * ((scaleX + scaleY) / 2);
    }

    function updateEraserCursor(event) {
      var diameter;
      if (!canvas) { return; }
      if (!isErasing) {
        lastEraserCursorDiameter = 0;
        canvas.style.cursor = "";
        return;
      }

      diameter = ERASER_SIZE;
      if (diameter === lastEraserCursorDiameter) { return; }
      lastEraserCursorDiameter = diameter;
      canvas.style.cursor = buildEraserCursor(diameter);
    }

    function startStroke(event) {
      var point;
      if (event.preventDefault) { event.preventDefault(); }
      drawing = true;
      if (!isErasing) {
        hasInk = true;
      }
      updateSubmitButtonState(false);
      point = getPoint(event);
      applyCanvasTool();
      updateEraserCursor(event);
      canvasContext.lineWidth = getStrokeWidth(event);
      canvasContext.beginPath();
      canvasContext.moveTo(point.x, point.y);
    }

    function moveStroke(event) {
      var point;
      if (!drawing) { return; }
      if (event.preventDefault) { event.preventDefault(); }
      point = getPoint(event);
      applyCanvasTool();
      updateEraserCursor(event);
      canvasContext.lineWidth = getStrokeWidth(event);
      canvasContext.lineTo(point.x, point.y);
      canvasContext.stroke();
    }

    function endStroke() {
      if (!drawing) { return; }
      drawing = false;
      canvasContext.closePath();
      syncCanvasInkState();
    }

    function handleCursorPreview(event) {
      if (!isErasing || !event || event.pointerType === "touch") { return; }
      updateEraserCursor(event);
    }

    canvas.addEventListener("pointerdown", startStroke);
    canvas.addEventListener("pointermove", moveStroke);
    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointercancel", endStroke);
    canvas.addEventListener("pointerleave", endStroke);
    canvas.addEventListener("pointerenter", handleCursorPreview);

    canvas.addEventListener("pointermove", handleCursorPreview);

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
    canvasContext.lineWidth = 3.5;
    canvasContext.lineCap = "round";
    canvasContext.lineJoin = "round";
    canvasContext.strokeStyle = "#1d2730";
    drawing = false;
    hasInk = false;
    applyCanvasTool();
  }

  function restoreCanvasFromSavedImage(dataUrl) {
    clearCanvas();
    if (!dataUrl || !canvasContext || !canvas) { return; }

    var image = new Image();
    image.onload = function () {
      canvasContext.fillStyle = "#ffffff";
      canvasContext.fillRect(0, 0, canvas.width, canvas.height);
      canvasContext.drawImage(image, 0, 0, canvas.width, canvas.height);
      syncCanvasInkState();
    };
    image.src = dataUrl;
  }

  function toggleEraserMode() {
    isErasing = !isErasing;
    applyCanvasTool();
  }

  function applyCanvasTool() {
    if (!canvasContext || !canvas) { return; }
    if (isErasing) {
      canvasContext.globalCompositeOperation = "destination-out";
      canvasContext.strokeStyle = "rgba(0, 0, 0, 1)";
      canvas.classList.add("is-erasing");
      canvas.style.cursor = buildEraserCursor(ERASER_SIZE);
    } else {
      canvasContext.globalCompositeOperation = "source-over";
      canvasContext.strokeStyle = "#1d2730";
      canvas.classList.remove("is-erasing");
      lastEraserCursorDiameter = 0;
      canvas.style.cursor = "";
    }
    renderCanvasToolState();
  }

  function buildEraserCursor(diameter) {
    var size = diameter + 8;
    var radius = diameter / 2;
    var center = size / 2;
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '">' +
      '<circle cx="' + center + '" cy="' + center + '" r="' + radius + '" fill="rgba(129, 213, 154, 0.18)" stroke="rgba(60, 145, 92, 0.95)" stroke-width="1.6"/>' +
      "</svg>";
    return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '") ' + center + " " + center + ", crosshair";
  }

  function renderCanvasToolState() {
    if (!eraserButton) { return; }
    eraserButton.classList.toggle("is-active", isErasing);
    eraserButton.setAttribute("aria-pressed", isErasing ? "true" : "false");
    eraserButton.setAttribute("title", isErasing ? "切回書寫" : "切換橡皮擦");
    eraserButton.setAttribute("aria-label", isErasing ? "切回書寫" : "切換橡皮擦");
  }

  function syncCanvasInkState() {
    var pixels;
    var index;
    if (!canvasContext || !canvas) { return; }
    pixels = canvasContext.getImageData(0, 0, canvas.width, canvas.height).data;
    hasInk = false;
    for (index = 0; index < pixels.length; index += 4) {
      if (pixels[index] !== 255 || pixels[index + 1] !== 255 || pixels[index + 2] !== 255 || pixels[index + 3] !== 255) {
        hasInk = true;
        return;
      }
    }
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
      return createBankItem(lessonId, item, index);
    });
  }

  function createBankItem(lessonId, item, index) {
    var charCount = splitAnswerUnits(item.answer).length;
    return {
      id: item.id || (lessonId + "-" + (index + 1) + "-" + Date.now() + "-" + Math.floor(Math.random() * 1000)),
      text: item.text,
      answer: item.answer,
      hint: item.hint || "",
      handwritingImages: new Array(charCount).fill(null),
      currentCharIndex: 0,
      isDone: false,
      isCustom: Boolean(item.isCustom)
    };
  }

  function buildQuizItems(lesson, bankItems) {
    return buildQuizItemsFromBank({
      id: lesson.id,
      bankItems: bankItems || cloneItems(lesson.items, lesson.id),
      quizCount: resolveQuizCount((bankItems || lesson.items || []).length)
    });
  }

  function buildQuizItemsFromBank(lesson) {
    var availableCount = lesson.bankItems.length;
    var quizCount = resolveQuizCount(availableCount);
    return shuffleItems(cloneItems(lesson.bankItems, lesson.id)).slice(0, quizCount);
  }

  function resolveQuizCount(availableCount) {
    var safeAvailableCount = Math.max(0, Number(availableCount) || 0);
    return Math.min(DEFAULT_QUIZ_COUNT, safeAvailableCount);
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

  function renderBopomofoPalette() {
    if (!bopomofoPalette) { return; }

    bopomofoPalette.innerHTML = "";
    BOPOMOFO_SYMBOLS.forEach(function (symbol) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "bopomofo-chip";
      button.setAttribute("data-bopomofo", symbol);
      button.textContent = symbol;
      bopomofoPalette.appendChild(button);
    });
  }

  function handleBopomofoPaletteClick(event) {
    var target = event.target;
    var symbol;

    if (!target || !bankHintInput) { return; }

    target = target.closest("[data-bopomofo]");
    if (!target) { return; }

    symbol = target.getAttribute("data-bopomofo");
    appendHintSymbol(symbol || "");
  }

  function handleBopomofoToolClick(event) {
    var target = event.target;
    var action;

    if (!target || !bankHintInput) { return; }

    target = target.closest("[data-bopomofo-action]");
    if (!target) { return; }

    action = target.getAttribute("data-bopomofo-action");
    if (action === "space") {
      appendHintSymbol(" ");
      return;
    }
    if (action === "backspace") {
      bankHintInput.value = bankHintInput.value.slice(0, -1);
      bankHintInput.focus();
      return;
    }
    if (action === "clear") {
      bankHintInput.value = "";
      bankHintInput.focus();
    }
  }

  function appendHintSymbol(symbol) {
    if (!bankHintInput || !symbol) { return; }
    bankHintInput.value += symbol;
    bankHintInput.focus();
  }

  function getInitialBankSource(lesson, storedItems) {
    var hasPersistentIds;
    if (!storedItems || !storedItems.length) {
      return lesson.items;
    }
    hasPersistentIds = storedItems.some(function (item) {
      return Boolean(item && item.id);
    });
    return hasPersistentIds ? storedItems : lesson.items.concat(storedItems);
  }

  function persistLessonBankItems(lesson) {
    var stored = state.storedBankItemsByLesson || {};
    stored[lesson.id] = lesson.bankItems.map(function (item) {
      return {
        id: item.id,
        text: item.text,
        answer: item.answer,
        hint: item.hint,
        isCustom: Boolean(item.isCustom)
      };
    });
    state.storedBankItemsByLesson = stored;
    return saveStoredBankItems(stored);
  }

  function loadStoredBankItems() {
    var storage;
    var parsed;
    var legacyStorage;
    var legacyParsed;
    var lessonId;

    try {
      storage = window.localStorage.getItem(LESSON_BANK_STORAGE_KEY);
      parsed = storage ? JSON.parse(storage) : {};
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length) {
        return parsed;
      }
    } catch (error) {
      parsed = {};
    }

    try {
      legacyStorage = window.localStorage.getItem(LEGACY_CUSTOM_BANK_STORAGE_KEY);
      legacyParsed = legacyStorage ? JSON.parse(legacyStorage) : {};
      if (!legacyParsed || typeof legacyParsed !== "object") {
        return {};
      }
      parsed = {};
      for (lessonId in legacyParsed) {
        if (Object.prototype.hasOwnProperty.call(legacyParsed, lessonId)) {
          parsed[lessonId] = legacyParsed[lessonId];
        }
      }
      return parsed;
    } catch (error) {
      return {};
    }
  }

  function saveStoredBankItems(itemsByLesson) {
    try {
      window.localStorage.setItem(LESSON_BANK_STORAGE_KEY, JSON.stringify(itemsByLesson));
      return true;
    } catch (error) {
      return false;
    }
  }

  function findBankItemById(lesson, bankId) {
    var index = findBankItemIndexById(lesson, bankId);
    return index >= 0 ? lesson.bankItems[index] : null;
  }

  function findBankItemIndexById(lesson, bankId) {
    var index;
    for (index = 0; index < lesson.bankItems.length; index += 1) {
      if (lesson.bankItems[index].id === bankId) {
        return index;
      }
    }
    return -1;
  }

  function normalizeText(text) {
    return String(text || "").trim().replace(/\s+/g, " ");
  }

  function normalizeAnswer(answer) {
    return String(answer || "").trim().replace(/\s+/g, "");
  }

  function normalizeHintText(hint) {
    return String(hint || "").trim().replace(/\s+/g, " ");
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
