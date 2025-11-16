// === KONFIG: konto & auth ===
const ACCOUNT_EMAIL = "melawitalexander86@gmail.com";
// SHA-256 hash av "MelaKapi"
const ACCOUNT_PASSWORD_HASH =
  "a16138bc0d7ccd6b3fca3688085e37dc162f2d9e944c5825833e7ff1f47cf860";
const AUTH_KEY = "flashcards_auth_v1";

// Lokal lagring av flashcards
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

// Session-progress (för x/total)
let sessionSeenIds = new Set();
let sessionTotal = 0;

// Helpers för ID
function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Spara / ladda flashcard-data
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

// === Auth / login ===

const loginViewEl = document.getElementById("loginView");
const appContainerEl = document.getElementById("appContainer");
const loginEmailEl = document.getElementById("loginEmail");
const loginPasswordEl = document.getElementById("loginPassword");
const loginBtnEl = document.getElementById("loginBtn");
const loginErrorEl = document.getElementById("loginError");

function isLoggedIn() {
  return localStorage.getItem(AUTH_KEY) === "1";
}

function setLoggedIn() {
  localStorage.setItem(AUTH_KEY, "1");
}

function showApp() {
  loginViewEl.classList.add("hidden");
  appContainerEl.classList.remove("hidden");
  render();
}

async function hashString(str) {
  if (window.crypto && window.crypto.subtle && window.TextEncoder) {
    const enc = new TextEncoder().encode(str);
    const buf = await window.crypto.subtle.digest("SHA-256", enc);
    const bytes = new Uint8Array(buf);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } else {
    // Fallback (ingen riktig säkerhet, men funkar i gamla browsers)
    return str;
  }
}

async function handleLogin() {
  const email = (loginEmailEl.value || "").trim().toLowerCase();
  const pwd = loginPasswordEl.value || "";

  loginErrorEl.classList.add("hidden");

  if (email !== ACCOUNT_EMAIL.toLowerCase()) {
    loginErrorEl.classList.remove("hidden");
    return;
  }

  const hash = await hashString(pwd);
  if (hash !== ACCOUNT_PASSWORD_HASH) {
    loginErrorEl.classList.remove("hidden");
    return;
  }

  setLoggedIn();
  showApp();
}

// DOM-referenser – views
const homeViewEl = document.getElementById("homeView");
const homeEmptyEl = document.getElementById("homeEmpty");
const courseViewEl = document.getElementById("courseView");
const studyViewEl = document.getElementById("studyView");

// DOM-referenser – mappar/hemskärm
const courseListEl = document.getElementById("courseList");
const addCourseBtn = document.getElementById("addCourseBtn");
const backHomeBtn = document.getElementById("backHomeBtn");
const courseModal = document.getElementById("courseModal");
const courseNameInput = document.getElementById("courseNameInput");
const cancelCourseBtn = document.getElementById("cancelCourseBtn");
const saveCourseBtn = document.getElementById("saveCourseBtn");

// Export / import
const exportDataBtn = document.getElementById("exportDataBtn");
const importDataInput = document.getElementById("importDataInput");

// DOM – kursvy
const courseTitleEl = document.getElementById("courseTitle");
const cardListEl = document.getElementById("cardList");
const noCardsMessageEl = document.getElementById("noCardsMessage");
const addCardBtn = document.getElementById("addCardBtn");
const deleteCourseBtn = document.getElementById("deleteCourseBtn");

// DOM – card modal
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

// DOM – studyläge
const studyBtn = document.getElementById("studyBtn");
const backToCourseBtn = document.getElementById("backToCourseBtn");
const restartStudyBtn = document.getElementById("restartStudyBtn");
const studyProgressEl = document.getElementById("studyProgress");
const studyCardEl = document.getElementById("studyCard");
const studyCardInnerEl = document.getElementById("studyCardInner");
const studyQuestionEl = document.getElementById("studyQuestion");
const studyAnswerTextEl = document.getElementById("studyAnswerText");
const studyAnswerImageEl = document.getElementById("studyAnswerImage");
const studyFinishedEl = document.getElementById("studyFinished");
const studyFinishedTextEl = document.getElementById("studyFinishedText");
const studyRestartAllBtn = document.getElementById("studyRestartAllBtn");

// Tillstånd för "redigera kort"
let editingCardId = null;
let cardImageDataTemp = null;

// Swipe-state för studyCard
let touchStartX = 0;
let touchStartY = 0;
let touchCurrentX = 0;
let isDraggingCard = false;
let suppressClickAfterSwipe = false;

// --- Swipe-visual helpers ---

function clearSwipeVisual() {
  if (!studyCardInnerEl) return;
  studyCardInnerEl.classList.remove("swipe-right", "swipe-left");
  studyCardInnerEl.style.setProperty("--swipe-intensity", "0");
}

function updateSwipeVisual(dx) {
  if (!studyCardInnerEl) return;

  const absDx = Math.abs(dx);
  if (absDx < 5) {
    clearSwipeVisual();
    return;
  }

  const maxDistance = 140;
  let intensity = absDx / maxDistance;
  if (intensity > 1) intensity = 1;

  studyCardInnerEl.style.setProperty("--swipe-intensity", intensity.toString());

  if (dx > 0) {
    studyCardInnerEl.classList.add("swipe-right");
    studyCardInnerEl.classList.remove("swipe-left");
  } else {
    studyCardInnerEl.classList.add("swipe-left");
    studyCardInnerEl.classList.remove("swipe-right");
  }
}

// Anpassa kortets höjd efter innehållet
function adjustCardHeight() {
  if (!studyCardInnerEl) return;
  const front = document.querySelector(".study-card-front");
  const back = document.querySelector(".study-card-back");
  if (!front || !back) return;

  studyCardInnerEl.style.height = "auto";

  const frontHeight = front.getBoundingClientRect().height;
  const backHeight = back.getBoundingClientRect().height;

  const minHeight = 180;
  const maxHeightForViewport = Math.floor(window.innerHeight * 0.8);

  let target = Math.max(minHeight, frontHeight, backHeight);
  target = Math.min(target, maxHeightForViewport);

  studyCardInnerEl.style.height = target + "px";
}

// --- Courses / mappar ---

function renderCourses() {
  courseListEl.innerHTML = "";
  const hasCourses = state.courses.length > 0;
  if (!hasCourses) {
    homeEmptyEl.classList.remove("hidden");
  } else {
    homeEmptyEl.classList.add("hidden");
  }

  state.courses.forEach((course) => {
    const li = document.createElement("li");
    li.className = "course-item";
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
  setTimeout(() => courseNameInput.focus(), 0);
}

function closeCourseModal() {
  courseModal.classList.add("hidden");
}

function addCourse() {
  const name = courseNameInput.value.trim();
  if (!name) return;
  const course = { id: uuid(), name };
  state.courses.push(course);
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
  state.selectedCourseId = null;
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
  setTimeout(() => cardQuestionInput.focus(), 0);
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
    editBtn.className = "btn btn-secondary btn-sm";
    editBtn.textContent = "Redigera";
    editBtn.addEventListener("click", () => openCardModal(card.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-danger btn-sm";
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
    state.studyQueue = state.wrongQueue.slice();
  }

  state.wrongQueue = [];
  shuffleArray(state.studyQueue);
  state.currentIndex = 0;
  state.showAnswer = false;
  state.inStudyMode = true;

  sessionSeenIds = new Set();
  sessionTotal = cards.length;

  render();
}

function handleStudyAnswer(isRight) {
  if (!state.inStudyMode || state.studyQueue.length === 0) return;

  const currentCardId = state.studyQueue[state.currentIndex];

  sessionSeenIds.add(currentCardId);

  if (!isRight) {
    if (!state.wrongQueue.includes(currentCardId)) {
      state.wrongQueue.push(currentCardId);
    }
  }

  state.currentIndex++;

  if (state.currentIndex >= state.studyQueue.length) {
    if (state.wrongQueue.length > 0) {
      state.studyQueue = state.wrongQueue.slice();
      shuffleArray(state.studyQueue);
      state.wrongQueue = [];
      state.currentIndex = 0;
      state.showAnswer = false;
    } else {
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

  const hasCards = state.studyQueue.length > 0;

  if (!state.inStudyMode) {
    studyViewEl.classList.add("hidden");
    courseViewEl.classList.remove("hidden");
    return;
  }

  courseViewEl.classList.add("hidden");
  studyViewEl.classList.remove("hidden");

  studyCardEl.style.transform = "";
  studyCardEl.style.opacity = "";
  clearSwipeVisual();

  if (!hasCards) {
    studyCardEl.classList.add("hidden");
    studyFinishedEl.classList.remove("hidden");
    restartStudyBtn.disabled = false;
    studyRestartAllBtn.disabled = false;

    studyProgressEl.textContent = `${sessionTotal}/${sessionTotal}`;
    studyFinishedTextEl.textContent =
      "Du har klarat alla flashcards i den här mappen.";
    return;
  }

  studyFinishedEl.classList.add("hidden");
  studyCardEl.classList.remove("hidden");

  const doneCount = sessionSeenIds.size;
  studyProgressEl.textContent = `${doneCount}/${sessionTotal}`;

  const cardId = state.studyQueue[state.currentIndex];
  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return;

  if (state.showAnswer) {
    studyCardInnerEl.classList.add("is-flipped");
  } else {
    studyCardInnerEl.classList.remove("is-flipped");
  }

  studyQuestionEl.textContent = card.question;

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
    studyAnswerImageEl.onload = () => adjustCardHeight();
  } else {
    studyAnswerImageEl.src = "";
    studyAnswerImageEl.classList.add("hidden");
  }

  if (!card.answerText && !card.imageData) {
    studyAnswerTextEl.textContent = "Inget svar angivet.";
    studyAnswerTextEl.classList.remove("hidden");
  }

  adjustCardHeight();
}

// Fisher-Yates shuffle
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// --- Export / import backup ---

function handleExportData() {
  const data = {
    courses: state.courses,
    cards: state.cards,
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "flashcards-backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function handleImportData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const text = ev.target.result;
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.courses) || !Array.isArray(data.cards)) {
        throw new Error("Fel format");
      }
      state.courses = data.courses;
      state.cards = data.cards;
      saveState();
      alert("Backup importerad.");
      render();
    } catch (err) {
      console.error(err);
      alert("Kunde inte läsa backup-filen. Kontrollera att det är rätt fil.");
    } finally {
      importDataInput.value = "";
    }
  };
  reader.readAsText(file);
}

// --- Render main ---

function render() {
  renderCourses();
  const course = getSelectedCourse();

  if (!course && !state.inStudyMode) {
    homeViewEl.classList.remove("hidden");
    courseViewEl.classList.add("hidden");
    studyViewEl.classList.add("hidden");
    return;
  }

  if (state.inStudyMode) {
    homeViewEl.classList.add("hidden");
    renderStudyView();
  } else {
    homeViewEl.classList.add("hidden");
    studyViewEl.classList.add("hidden");
    courseViewEl.classList.remove("hidden");
    courseTitleEl.textContent = course.name;
    renderCards();
  }
}

// --- Event listeners ---

// login
loginBtnEl.addEventListener("click", () => {
  handleLogin();
});

loginPasswordEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleLogin();
  }
});

// mappar / hemskärm
addCourseBtn.addEventListener("click", openCourseModal);
cancelCourseBtn.addEventListener("click", closeCourseModal);
saveCourseBtn.addEventListener("click", addCourse);

backHomeBtn.addEventListener("click", () => {
  state.selectedCourseId = null;
  state.inStudyMode = false;
  render();
});

// export/import
exportDataBtn.addEventListener("click", handleExportData);
importDataInput.addEventListener("change", handleImportData);

// cards
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

// study
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

// Klick på kortet = flip (vänd fram/baksida) – men inte direkt efter swipe
studyCardEl.addEventListener("click", () => {
  if (suppressClickAfterSwipe) {
    suppressClickAfterSwipe = false;
    return;
  }
  state.showAnswer = !state.showAnswer;
  renderStudyView();
});

/* ===== SWIPE-PÅ-KORTET MED FÄRG & BLOCKERAD SID-SCROLL ===== */

// Touch (mobil)
studyCardEl.addEventListener(
  "touchstart",
  (e) => {
    if (!state.inStudyMode || state.studyQueue.length === 0) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchCurrentX = touch.clientX;
    isDraggingCard = true;
  },
  { passive: false }
);

studyCardEl.addEventListener(
  "touchmove",
  (e) => {
    if (!isDraggingCard) return;
    const touch = e.touches[0];
    touchCurrentX = touch.clientX;
    const dx = touchCurrentX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

    if (Math.abs(dy) > Math.abs(dx)) {
      return; // låt scroll om mer vertikalt
    }

    e.preventDefault(); // blockera sid-scroll

    const rotation = dx / 20;
    studyCardEl.style.transform = `translateX(${dx}px) rotate(${rotation}deg)`;
    updateSwipeVisual(dx);
  },
  { passive: false }
);

studyCardEl.addEventListener(
  "touchend",
  (e) => {
    if (!isDraggingCard) return;
    isDraggingCard = false;

    const dx = touchCurrentX - touchStartX;
    const threshold = 60;

    studyCardEl.style.transform = "";
    studyCardEl.style.opacity = "";
    clearSwipeVisual();

    if (Math.abs(dx) > threshold) {
      suppressClickAfterSwipe = true;
      if (dx > 0) {
        handleStudyAnswer(true); // höger = rätt
      } else {
        handleStudyAnswer(false); // vänster = fel
      }
    }
  },
  { passive: false }
);

// Mus / trackpad (desktop)
studyCardEl.addEventListener("mousedown", (e) => {
  if (!state.inStudyMode || state.studyQueue.length === 0) return;
  isDraggingCard = true;
  touchStartX = e.clientX;
  touchStartY = e.clientY;
  touchCurrentX = e.clientX;

  const onMouseMove = (ev) => {
    if (!isDraggingCard) return;
    touchCurrentX = ev.clientX;
    const dx = touchCurrentX - touchStartX;
    const dy = ev.clientY - touchStartY;
    if (Math.abs(dy) > Math.abs(dx)) return;
    const rotation = dx / 20;
    studyCardEl.style.transform = `translateX(${dx}px) rotate(${rotation}deg)`;
    updateSwipeVisual(dx);
  };

  const onMouseUp = (ev) => {
    if (!isDraggingCard) return;
    isDraggingCard = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    const dx = ev.clientX - touchStartX;
    const threshold = 80;

    studyCardEl.style.transform = "";
    studyCardEl.style.opacity = "";
    clearSwipeVisual();

    if (Math.abs(dx) > threshold) {
      suppressClickAfterSwipe = true;
      if (dx > 0) {
        handleStudyAnswer(true);
      } else {
        handleStudyAnswer(false);
      }
    }
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
});

// Tangentbord: vänster/höger pil + space
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

// Justera kort om fönstret ändras
window.addEventListener("resize", () => {
  if (state.inStudyMode && state.studyQueue.length > 0) {
    adjustCardHeight();
  }
});

// === Init ===
loadState();

if (isLoggedIn()) {
  showApp();
} else {
  // visa login, göm app (redan gömd i HTML)
  loginViewEl.classList.remove("hidden");
}
