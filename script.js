// Enkel data-modell & localStorage-hantering

const STORAGE_KEY = "flashcards_app_data_v1";

let state = {
  courses: [], // { id, name }
  cards: [], // { id, courseId, question, answerText, imageData }
  selectedCourseId: null,

  // Studie-session
  studyQueue: [], // array av cardId
  wrongQueue: [],
  currentIndex: 0,
  showAnswer: false,
  inStudyMode: false,
};

// Helpers för ID
function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Spara / ladda
function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      courses: state.courses,
      cards: state.cards,
    })
  );
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      state.courses = data.courses || [];
      state.cards = data.cards || [];
    } catch (e) {
      console.error("Kunde inte läsa lagrad data", e);
    }
  }
}

// DOM-referenser
const courseListEl = document.getElementById("courseList");
const addCourseBtn = document.getElementById("addCourseBtn");
const courseModal = document.getElementById("courseModal");
const courseNameInput = document.getElementById("courseNameInput");
const cancelCourseBtn = document.getElementById("cancelCourseBtn");
const saveCourseBtn = document.getElementById("saveCourseBtn");

const noCourseSelectedEl = document.getElementById("noCourseSelected");
const courseViewEl = document.getElementById("courseView");
const courseTitleEl = document.getElementById("courseTitle");
const cardListEl = document.getElementById("cardList");
const noCardsMessageEl = document.getElementById("noCardsMessage");
const addCardBtn = document.getElementById("addCardBtn");
const deleteCourseBtn = document.getElementById("deleteCourseBtn");

const cardModal = document.getElementById("cardModal");
const cardModalTitle = document.getElementById("cardModalTitle");
const cardQuestionInput = document.getElementById("cardQuestionInput");
const cardAnswerInput = document.getElementById("cardAnswerInput");
const cardImageInput = document.getElementById("cardImageInput");
const cardImagePreviewContainer = document.getElementById(
  "cardImagePreviewContainer"
);
const cardImagePreview = document.getElementById("cardImagePreview");
const removeImageBtn = document.getElementById("removeImageBtn");
const cancelCardBtn = document.getElementById("cancelCardBtn");
const saveCardBtn = document.getElementById("saveCardBtn");

const studyViewEl = document.getElementById("studyView");
const studyBtn = document.getElementById("studyBtn");
const backToCourseBtn = document.getElementById("backToCourseBtn");
const restartStudyBtn = document.getElementById("restartStudyBtn");
const studyProgressEl = document.getElementById("studyProgress");
const studyCardEl = document.getElementById("studyCard");
const studyQuestionEl = document.getElementById("studyQuestion");
const studyAnswerContainerEl = document.getElementById("studyAnswerContainer");
const studyAnswerTextEl = document.getElementById("studyAnswerText");
const studyAnswerImageEl = document.getElementById("studyAnswerImage");
const wrongBtn = document.getElementById("wrongBtn");
const rightBtn = document.getElementById("rightBtn");
const studyFinishedEl = document.getElementById("studyFinished");
const studyFinishedTextEl = document.getElementById("studyFinishedText");
const studyRestartAllBtn = document.getElementById("studyRestartAllBtn");

// Tillstånd för "redigera kort"
let editingCardId = null;
let cardImageDataTemp = null;

// --- Courses ---

function renderCourses() {
  courseListEl.innerHTML = "";
  state.courses.forEach((course) => {
    const li = document.createElement("li");
    li.className =
      "course-item" + (course.id === state.selectedCourseId ? " active" : "");
    li.dataset.id = course.id;

    const courseName = document.createElement("div");
    courseName.className = "course-name";
    courseName.textContent = course.name;

    const courseMeta = document.createElement("div");
    courseMeta.className = "course-meta";
    const count = state.cards.filter((c) => c.courseId === course.id).length;
    courseMeta.textContent = `${count} kort`;

    li.appendChild(courseName);
    li.appendChild(courseMeta);
    li.addEventListener("click", () => {
      state.selectedCourseId = course.id;
      state.inStudyMode = false;
      render();
    });

    courseListEl.appendChild(li);
  });
}

function openCourseModal() {
  courseNameInput.value = "";
  courseModal.classList.remove("hidden");
  courseNameInput.focus();
}

function closeCourseModal() {
  courseModal.classList.add("hidden");
}

function addCourse() {
  const name = courseNameInput.value.trim();
  if (!name) return;
  const course = { id: uuid(), name };
  state.courses.push(course);
  if (!state.selectedCourseId) {
    state.selectedCourseId = course.id;
  }
  saveState();
  closeCourseModal();
  render();
}

function deleteCurrentCourse() {
  if (!state.selectedCourseId) return;
  const course = state.courses.find((c) => c.id === state.selectedCourseId);
  if (!course) return;
  if (
    !confirm(
      `Är du säker på att du vill ta bort mappen "${course.name}" och alla dess flashcards?`
    )
  ) {
    return;
  }
  state.cards = state.cards.filter((card) => card.courseId !== course.id);
  state.courses = state.courses.filter((c) => c.id !== course.id);
  state.selectedCourseId = state.courses[0]?.id || null;
  state.inStudyMode = false;
  saveState();
  render();
}

// --- Cards ---

function getSelectedCourse() {
  return state.courses.find((c) => c.id === state.selectedCourseId) || null;
}

function openCardModal(cardId = null) {
  editingCardId = cardId;
  cardImageDataTemp = null;
  cardImageInput.value = "";
  cardImagePreviewContainer.classList.add("hidden");
  cardImagePreview.src = "";

  if (cardId) {
    const card = state.cards.find((c) => c.id === cardId);
    if (!card) return;
    cardModalTitle.textContent = "Redigera flashcard";
    cardQuestionInput.value = card.question;
    cardAnswerInput.value = card.answerText;
    if (card.imageData) {
      cardImageDataTemp = card.imageData;
      cardImagePreview.src = card.imageData;
      cardImagePreviewContainer.classList.remove("hidden");
    }
  } else {
    cardModalTitle.textContent = "Nytt flashcard";
    cardQuestionInput.value = "";
    cardAnswerInput.value = "";
  }

  cardModal.classList.remove("hidden");
  cardQuestionInput.focus();
}

function closeCardModal() {
  cardModal.classList.add("hidden");
  editingCardId = null;
  cardImageDataTemp = null;
}

function handleCardImageChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    cardImageDataTemp = ev.target.result; // Data URL
    cardImagePreview.src = cardImageDataTemp;
    cardImagePreviewContainer.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function saveCard() {
  const course = getSelectedCourse();
  if (!course) return;

  const question = cardQuestionInput.value.trim();
  const answerText = cardAnswerInput.value.trim();
  if (!question) {
    alert("Fråga får inte vara tom.");
    return;
  }

  if (editingCardId) {
    const card = state.cards.find((c) => c.id === editingCardId);
    if (!card) return;
    card.question = question;
    card.answerText = answerText;
    card.imageData = cardImageDataTemp;
  } else {
    const card = {
      id: uuid(),
      courseId: course.id,
      question,
      answerText,
      imageData: cardImageDataTemp,
    };
    state.cards.push(card);
  }
  saveState();
  closeCardModal();
  render();
}

function deleteCard(cardId) {
  if (!confirm("Ta bort detta flashcard?")) return;
  state.cards = state.cards.filter((c) => c.id !== cardId);
  saveState();
  render();
}

function renderCards() {
  const course = getSelectedCourse();
  if (!course) return;

  const cards = state.cards.filter((c) => c.courseId === course.id);
  cardListEl.innerHTML = "";

  if (cards.length === 0) {
    noCardsMessageEl.classList.remove("hidden");
  } else {
    noCardsMessageEl.classList.add("hidden");
  }

  cards.forEach((card) => {
    const tr = document.createElement("tr");

    const tdQuestion = document.createElement("td");
    tdQuestion.textContent = card.question;

    const tdAnswer = document.createElement("td");
    tdAnswer.textContent = card.answerText ? card.answerText : "-";

    const tdImage = document.createElement("td");
    if (card.imageData) {
      const span = document.createElement("span");
      span.className = "badge";
      span.textContent = "Bild";
      tdImage.appendChild(span);
    } else {
      tdImage.textContent = "-";
    }

    const tdActions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className = "secondary small";
    editBtn.textContent = "Redigera";
    editBtn.addEventListener("click", () => openCardModal(card.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "danger small";
    deleteBtn.textContent = "Ta bort";
    deleteBtn.style.marginLeft = "0.25rem";
    deleteBtn.addEventListener("click", () => deleteCard(card.id));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(deleteBtn);

    tr.appendChild(tdQuestion);
    tr.appendChild(tdAnswer);
    tr.appendChild(tdImage);
    tr.appendChild(tdActions);

    cardListEl.appendChild(tr);
  });
}

// --- Studie-läge ---

function startStudy(all = true) {
  const course = getSelectedCourse();
  if (!course) return;
  const cards = state.cards.filter((c) => c.courseId === course.id);
  if (cards.length === 0) {
    alert("Det finns inga flashcards i den här mappen.");
    return;
  }

  if (all) {
    state.studyQueue = cards.map((c) => c.id);
  } else {
    // om vi vill stödja "bara fel" någon gång separat
    state.studyQueue = state.wrongQueue.slice();
  }

  state.wrongQueue = [];
  shuffleArray(state.studyQueue);
  state.currentIndex = 0;
  state.showAnswer = false;
  state.inStudyMode = true;

  render();
}

function restartStudyOnlyWrong() {
  if (state.wrongQueue.length === 0) {
    // inget fel kvar -> session klar
    state.inStudyMode = true;
    state.studyQueue = [];
    state.currentIndex = 0;
    state.showAnswer = false;
    renderStudyView();
    return;
  }
  state.studyQueue = state.wrongQueue.slice();
  shuffleArray(state.studyQueue);
  state.wrongQueue = [];
  state.currentIndex = 0;
  state.showAnswer = false;
  render();
}

function handleStudyAnswer(isRight) {
  if (!state.inStudyMode || state.studyQueue.length === 0) return;

  const currentCardId = state.studyQueue[state.currentIndex];
  if (!isRight) {
    // lägg till i fel-lista om den inte redan finns
    if (!state.wrongQueue.includes(currentCardId)) {
      state.wrongQueue.push(currentCardId);
    }
  }

  state.currentIndex++;

  if (state.currentIndex >= state.studyQueue.length) {
    // slut på nuvarande omgång
    if (state.wrongQueue.length > 0) {
      // ny omgång bara med fel
      state.studyQueue = state.wrongQueue.slice();
      shuffleArray(state.studyQueue);
      state.wrongQueue = [];
      state.currentIndex = 0;
      state.showAnswer = false;
    } else {
      // allt rätt → färdig
      state.studyQueue = [];
      state.currentIndex = 0;
      state.showAnswer = false;
    }
  }

  renderStudyView();
}

function renderStudyView() {
  const course = getSelectedCourse();
  if (!course) return;

  const total = state.studyQueue.length;
  const hasCards = total > 0;

  if (!state.inStudyMode) {
    studyViewEl.classList.add("hidden");
    courseViewEl.classList.remove("hidden");
    return;
  }

  courseViewEl.classList.add("hidden");
  studyViewEl.classList.remove("hidden");

  if (!hasCards) {
    // session färdig
    studyCardEl.classList.add("hidden");
    studyFinishedEl.classList.remove("hidden");
    restartStudyBtn.disabled = false;
    studyRestartAllBtn.disabled = false;
    wrongBtn.disabled = true;
    rightBtn.disabled = true;

    const totalWrongRound = 0; // vi behöver inte visa exakt här
    studyProgressEl.textContent = "0 kort kvar";

    studyFinishedTextEl.textContent =
      "Du har klarat alla flashcards i den här mappen.";
    return;
  }

  studyFinishedEl.classList.add("hidden");
  studyCardEl.classList.remove("hidden");
  wrongBtn.disabled = false;
  rightBtn.disabled = false;

  const remaining = state.studyQueue.length - state.currentIndex;
  studyProgressEl.textContent = `${remaining} kort kvar i denna omgång`;

  const cardId = state.studyQueue[state.currentIndex];
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return;

  studyQuestionEl.textContent = card.question;

  if (state.showAnswer) {
    studyAnswerContainerEl.classList.remove("hidden");

    if (card.answerText) {
      studyAnswerTextEl.textContent = card.answerText;
      studyAnswerTextEl.classList.remove("hidden");
    } else {
      studyAnswerTextEl.textContent = "";
      studyAnswerTextEl.classList.add("hidden");
    }

    if (card.imageData) {
      studyAnswerImageEl.src = card.imageData;
      studyAnswerImageEl.classList.remove("hidden");
    } else {
      studyAnswerImageEl.src = "";
      studyAnswerImageEl.classList.add("hidden");
    }

    if (!card.answerText && !card.imageData) {
      studyAnswerTextEl.textContent = "Inget svar angivet.";
      studyAnswerTextEl.classList.remove("hidden");
    }
  } else {
    studyAnswerContainerEl.classList.add("hidden");
  }
}

// Fisher-Yates shuffle
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// --- Render main ---

function render() {
  renderCourses();
  const course = getSelectedCourse();

  if (!course) {
    noCourseSelectedEl.classList.remove("hidden");
    courseViewEl.classList.add("hidden");
    studyViewEl.classList.add("hidden");
    return;
  }

  noCourseSelectedEl.classList.add("hidden");

  if (state.inStudyMode) {
    renderStudyView();
  } else {
    courseViewEl.classList.remove("hidden");
    studyViewEl.classList.add("hidden");
    courseTitleEl.textContent = course.name;
    renderCards();
  }
}

// --- Event listeners ---

addCourseBtn.addEventListener("click", openCourseModal);
cancelCourseBtn.addEventListener("click", closeCourseModal);
saveCourseBtn.addEventListener("click", addCourse);

addCardBtn.addEventListener("click", () => openCardModal());
cancelCardBtn.addEventListener("click", closeCardModal);
saveCardBtn.addEventListener("click", saveCard);

cardImageInput.addEventListener("change", handleCardImageChange);
removeImageBtn.addEventListener("click", () => {
  cardImageDataTemp = null;
  cardImagePreview.src = "";
  cardImagePreviewContainer.classList.add("hidden");
});

deleteCourseBtn.addEventListener("click", deleteCurrentCourse);

studyBtn.addEventListener("click", () => startStudy(true));
backToCourseBtn.addEventListener("click", () => {
  state.inStudyMode = false;
  render();
});
restartStudyBtn.addEventListener("click", () => {
  startStudy(true);
});
studyRestartAllBtn.addEventListener("click", () => {
  startStudy(true);
});

studyCardEl.addEventListener("click", () => {
  state.showAnswer = !state.showAnswer;
  renderStudyView();
});

wrongBtn.addEventListener("click", () => handleStudyAnswer(false));
rightBtn.addEventListener("click", () => handleStudyAnswer(true));

document.addEventListener("keydown", (e) => {
  if (!state.inStudyMode) return;
  if (e.key === "ArrowLeft") {
    handleStudyAnswer(false);
  } else if (e.key === "ArrowRight") {
    handleStudyAnswer(true);
  } else if (e.key === " ") {
    e.preventDefault();
    state.showAnswer = !state.showAnswer;
    renderStudyView();
  }
});

// Init
loadState();
render();
