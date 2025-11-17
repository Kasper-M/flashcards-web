// ==========================
//  SUPABASE KONFIG
// ==========================

// Supabase-klienten kommer från CDN-scriptet i index.html
const { createClient } = supabase;

// FYLL I DINA EGNA VÄRDEN HÄR:
// Hämta från Supabase → Settings → API
const SUPABASE_URL = "https://matazmdegvlfbwsycudd.supabase.co"; // t.ex. "https://abcdxyz.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hdGF6bWRlZ3ZsZmJ3c3ljdWRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjQwNTcsImV4cCI6MjA3ODkwMDA1N30.lR1jYoowhP_UVSVwem9LYSSkoVjFX7k0QhxU7cXJpuA"; // din anon/publishable key

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Nuvarande inloggade användare
let currentUser = null;

// ==========================
//  STATE FÖR APPEN
// ==========================

let state = {
  courses: [], // { id, user_id, name, created_at }
  cards: [], // { id, user_id, course_id, question, answer_text, image_data, created_at }
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

// ==========================
//  DOM-REFERENSER
// ==========================

// Login
const loginViewEl = document.getElementById("loginView");
const appContainerEl = document.getElementById("appContainer");
const loginEmailEl = document.getElementById("loginEmail");
const loginPasswordEl = document.getElementById("loginPassword");
const loginBtnEl = document.getElementById("loginBtn");
const loginErrorEl = document.getElementById("loginError");

// Views
const homeViewEl = document.getElementById("homeView");
const homeEmptyEl = document.getElementById("homeEmpty");
const courseViewEl = document.getElementById("courseView");
const studyViewEl = document.getElementById("studyView");

// Hemskärm / mappar
const courseListEl = document.getElementById("courseList");
const addCourseBtn = document.getElementById("addCourseBtn");
const backHomeBtn = document.getElementById("backHomeBtn");
const courseModal = document.getElementById("courseModal");
const courseNameInput = document.getElementById("courseNameInput");
const cancelCourseBtn = document.getElementById("cancelCourseBtn");
const saveCourseBtn = document.getElementById("saveCourseBtn");

// Kursvy
const courseTitleEl = document.getElementById("courseTitle");
const cardListEl = document.getElementById("cardList");
const noCardsMessageEl = document.getElementById("noCardsMessage");
const addCardBtn = document.getElementById("addCardBtn");
const deleteCourseBtn = document.getElementById("deleteCourseBtn");

// Card-modal
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

// Study-vy
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

// Redigerings-state
let editingCardId = null;
let cardImageDataTemp = null;

// Swipe-state
let touchStartX = 0;
let touchStartY = 0;
let touchCurrentX = 0;
let isDraggingCard = false;
let suppressClickAfterSwipe = false;

// ==========================
//  LOGIN / AUTH
// ==========================

async function handleLogin() {
  const email = (loginEmailEl.value || "").trim();
  const password = loginPasswordEl.value || "";

  loginErrorEl.classList.add("hidden");

  if (!email || !password) {
    loginErrorEl.textContent = "Fyll i mejl och lösenord.";
    loginErrorEl.classList.remove("hidden");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    loginErrorEl.textContent = "Fel e-post eller lösenord.";
    loginErrorEl.classList.remove("hidden");
    return;
  }

  await initAfterLogin(data.user);
}

async function initAfterLogin(user) {
  currentUser = user;
  loginViewEl.classList.add("hidden");
  appContainerEl.classList.remove("hidden");

  await loadDataFromSupabase();
  render();
}

// ==========================
//  LADDA DATA FRÅN SUPABASE
// ==========================

async function loadDataFromSupabase() {
  if (!currentUser) return;

  const { data: courses, error: coursesError } = await supabaseClient
    .from("courses")
    .select("*")
    .order("created_at", { ascending: true });

  if (coursesError) {
    console.error("Kunde inte hämta courses", coursesError);
  }

  const { data: cards, error: cardsError } = await supabaseClient
    .from("cards")
    .select("*")
    .order("created_at", { ascending: true });

  if (cardsError) {
    console.error("Kunde inte hämta cards", cardsError);
  }

  state.courses = courses || [];
  state.cards = cards || [];

  if (
    state.selectedCourseId &&
    !state.courses.find((c) => c.id === state.selectedCourseId)
  ) {
    state.selectedCourseId = null;
  }
}

// ==========================
//  SWIPE VISUAL + ANIMATION
// ==========================

function clearSwipeVisual() {
  if (!studyCardInnerEl) return;
  studyCardInnerEl.classList.remove("swipe-right", "swipe-left");
  studyCardInnerEl.style.setProperty("--swipe-intensity", "0");
}

// uppdaterar färg + liten intensitet
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

// snygg “flyg iväg”-animation när man släpper tillräckligt långt
function animateCardSwipeOut(isRight, callback) {
  const direction = isRight ? 1 : -1;

  // kortet flyger iväg med rotation och fade
  studyCardEl.style.transition =
    "transform 0.22s ease-out, opacity 0.22s ease-out";
  studyCardEl.style.transform = `translateX(${direction * 260}px) rotate(${
    direction * 18
  }deg)`;
  studyCardEl.style.opacity = "0";

  setTimeout(() => {
    studyCardEl.style.transition = "";
    studyCardEl.style.transform = "";
    studyCardEl.style.opacity = "";
    clearSwipeVisual();
    if (callback) callback();
  }, 220);
}

// Anpassa kortets höjd efter innehållet
function adjustCardHeight() {
  if (!studyCardInnerEl) return;
  const front = document.querySelector(".study-card-front");
  const back = document.querySelector(".study-card-back");
  if (!front || !back) return;

  // Spara original-position
  const originalFrontPos = front.style.position;
  const originalBackPos = back.style.position;

  // Tillfälligt: låt fron/back bli "vanliga" block så vi kan mäta riktig höjd
  front.style.position = "static";
  back.style.position = "static";

  // släpp höjden så vi kan mäta fritt
  studyCardInnerEl.style.height = "auto";

  // scrollHeight här = verklig höjd av innehållet (inkl. bild)
  const frontHeight = front.scrollHeight;
  const backHeight = back.scrollHeight;

  const minHeight = 180;
  const maxHeightForViewport = Math.floor(window.innerHeight * 0.9); // upp till ~90% av skärmen

  let target = Math.max(minHeight, frontHeight, backHeight);
  target = Math.min(target, maxHeightForViewport);

  // sätt kortets höjd
  studyCardInnerEl.style.height = target + "px";

  // återställ position till absolute (för flip-effekten)
  front.style.position = originalFrontPos || "";
  back.style.position = originalBackPos || "";
}

// ==========================
//  COURSES / MAPPPAR
// ==========================

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
    const count = state.cards.filter((c) => c.course_id === course.id).length;
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

function getSelectedCourse() {
  return state.courses.find((c) => c.id === state.selectedCourseId) || null;
}

function openCourseModal() {
  courseNameInput.value = "";
  courseModal.classList.remove("hidden");
  setTimeout(() => courseNameInput.focus(), 0);
}

function closeCourseModal() {
  courseModal.classList.add("hidden");
}

async function addCourse() {
  const name = courseNameInput.value.trim();
  if (!name || !currentUser) return;

  const { data, error } = await supabaseClient
    .from("courses")
    .insert({
      name,
      user_id: currentUser.id,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Kunde inte skapa mapp", error);
    alert("Kunde inte skapa mapp.");
    return;
  }

  state.courses.push(data);
  closeCourseModal();
  render();
}

async function deleteCurrentCourse() {
  const course = getSelectedCourse();
  if (!course) return;

  if (!confirm(`Ta bort mappen "${course.name}" och alla dess flashcards?`))
    return;

  const { error } = await supabaseClient
    .from("courses")
    .delete()
    .eq("id", course.id);

  if (error) {
    console.error("Kunde inte ta bort mapp", error);
    alert("Kunde inte ta bort mapp.");
    return;
  }

  state.courses = state.courses.filter((c) => c.id !== course.id);
  state.cards = state.cards.filter((card) => card.course_id !== course.id);
  state.selectedCourseId = null;
  state.inStudyMode = false;

  render();
}

// ==========================
//  CARDS
// ==========================

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
    cardAnswerInput.value = card.answer_text || "";
    if (card.image_data) {
      cardImageDataTemp = card.image_data;
      cardImagePreview.src = card.image_data;
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
    const img = new Image();
    img.onload = () => {
      // max-dimension på bilden (i pixlar)
      const maxDim = 900;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // komprimera till JPEG (0.75 = 75% kvalitet)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);

      cardImageDataTemp = dataUrl;
      cardImagePreview.src = dataUrl;
      cardImagePreviewContainer.classList.remove("hidden");
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

async function saveCard() {
  const course = getSelectedCourse();
  if (!course || !currentUser) return;

  const question = cardQuestionInput.value.trim();
  const answerText = cardAnswerInput.value.trim();

  if (!question) {
    alert("Fråga får inte vara tom.");
    return;
  }

  if (editingCardId) {
    const { data, error } = await supabaseClient
      .from("cards")
      .update({
        question,
        answer_text: answerText || null,
        image_data: cardImageDataTemp || null,
      })
      .eq("id", editingCardId)
      .select("*")
      .single();

    if (error) {
      console.error("Kunde inte uppdatera kort", error);
      alert("Kunde inte uppdatera kort.");
      return;
    }

    const idx = state.cards.findIndex((c) => c.id === editingCardId);
    if (idx !== -1) {
      state.cards[idx] = data;
    }
  } else {
    const { data, error } = await supabaseClient
      .from("cards")
      .insert({
        user_id: currentUser.id,
        course_id: course.id,
        question,
        answer_text: answerText || null,
        image_data: cardImageDataTemp || null,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Kunde inte skapa kort", error);
      alert("Kunde inte skapa kort.");
      return;
    }

    state.cards.push(data);
  }

  closeCardModal();
  render();
}

async function deleteCard(cardId) {
  if (!confirm("Ta bort detta flashcard?")) return;

  const { error } = await supabaseClient
    .from("cards")
    .delete()
    .eq("id", cardId);

  if (error) {
    console.error("Kunde inte ta bort kort", error);
    alert("Kunde inte ta bort kort.");
    return;
  }

  state.cards = state.cards.filter((c) => c.id !== cardId);
  render();
}

function renderCards() {
  const course = getSelectedCourse();
  if (!course) return;

  const cards = state.cards.filter((c) => c.course_id === course.id);
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
    tdAnswer.textContent = card.answer_text ? card.answer_text : "-";

    const tdImage = document.createElement("td");
    if (card.image_data) {
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

// ==========================
//  STUDY-LÄGE
// ==========================

function startStudy(all = true) {
  const course = getSelectedCourse();
  if (!course) return;
  const cards = state.cards.filter((c) => c.course_id === course.id);
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
  studyCardEl.style.transition = "";
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

  if (card.answer_text) {
    studyAnswerTextEl.textContent = card.answer_text;
    studyAnswerTextEl.classList.remove("hidden");
  } else {
    studyAnswerTextEl.textContent = "";
    studyAnswerTextEl.classList.add("hidden");
  }

  if (card.image_data) {
    studyAnswerImageEl.src = card.image_data;
    studyAnswerImageEl.classList.remove("hidden");
    studyAnswerImageEl.onload = () => adjustCardHeight();
  } else {
    studyAnswerImageEl.src = "";
    studyAnswerImageEl.classList.add("hidden");
  }

  if (!card.answer_text && !card.image_data) {
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

// ==========================
//  RENDER MAIN
// ==========================

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

// ==========================
//  EVENTLYSSNARE
// ==========================

// Login
loginBtnEl.addEventListener("click", () => {
  handleLogin();
});

loginPasswordEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleLogin();
  }
});

// Mappar / hemskärm
addCourseBtn.addEventListener("click", openCourseModal);
cancelCourseBtn.addEventListener("click", closeCourseModal);
saveCourseBtn.addEventListener("click", () => {
  addCourse();
});

backHomeBtn.addEventListener("click", () => {
  state.selectedCourseId = null;
  state.inStudyMode = false;
  render();
});

// Cards
addCardBtn.addEventListener("click", () => openCardModal());
cancelCardBtn.addEventListener("click", closeCardModal);
saveCardBtn.addEventListener("click", () => {
  saveCard();
});

cardImageInput.addEventListener("change", handleCardImageChange);
removeImageBtn.addEventListener("click", () => {
  cardImageDataTemp = null;
  cardImagePreview.src = "";
  cardImagePreviewContainer.classList.add("hidden");
});

deleteCourseBtn.addEventListener("click", () => {
  deleteCurrentCourse();
});

// Study
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

// Klick på kortet = flip (ej direkt efter swipe)
studyCardEl.addEventListener("click", () => {
  if (suppressClickAfterSwipe) {
    suppressClickAfterSwipe = false;
    return;
  }
  state.showAnswer = !state.showAnswer;
  renderStudyView();
});

// ==========================
//  SWIPE – TOUCH
// ==========================

studyCardEl.addEventListener(
  "touchstart",
  (e) => {
    if (!state.inStudyMode || state.studyQueue.length === 0) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchCurrentX = touch.clientX;
    isDraggingCard = true;

    // ta bort ev. gammal transition när vi börjar dra
    studyCardEl.style.transition = "";
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
      return;
    }

    e.preventDefault();

    const rotation = dx / 20;
    const absDx = Math.abs(dx);
    const maxDistance = 140;
    let intensity = absDx / maxDistance;
    if (intensity > 1) intensity = 1;

    const scale = 1 - intensity * 0.05; // ju längre ut, desto mer "loss" från skärmen
    studyCardEl.style.transform = `translateX(${dx}px) rotate(${rotation}deg) scale(${scale})`;

    updateSwipeVisual(dx);
  },
  { passive: false }
);

studyCardEl.addEventListener(
  "touchend",
  () => {
    if (!isDraggingCard) return;
    isDraggingCard = false;

    const dx = touchCurrentX - touchStartX;
    const threshold = 60;

    if (Math.abs(dx) > threshold) {
      suppressClickAfterSwipe = true;
      const isRight = dx > 0;
      animateCardSwipeOut(isRight, () => {
        handleStudyAnswer(isRight);
      });
    } else {
      // tillbaka till mitten
      studyCardEl.style.transition = "transform 0.18s ease-out";
      studyCardEl.style.transform = "";
      setTimeout(() => {
        studyCardEl.style.transition = "";
        clearSwipeVisual();
      }, 180);
    }
  },
  { passive: false }
);

// ==========================
//  SWIPE – MUS / DESKTOP
// ==========================

studyCardEl.addEventListener("mousedown", (e) => {
  if (!state.inStudyMode || state.studyQueue.length === 0) return;
  isDraggingCard = true;
  touchStartX = e.clientX;
  touchStartY = e.clientY;
  touchCurrentX = e.clientX;

  studyCardEl.style.transition = "";

  const onMouseMove = (ev) => {
    if (!isDraggingCard) return;
    touchCurrentX = ev.clientX;
    const dx = touchCurrentX - touchStartX;
    const dy = ev.clientY - touchStartY;
    if (Math.abs(dy) > Math.abs(dx)) return;

    const rotation = dx / 20;
    const absDx = Math.abs(dx);
    const maxDistance = 140;
    let intensity = absDx / maxDistance;
    if (intensity > 1) intensity = 1;
    const scale = 1 - intensity * 0.05;

    studyCardEl.style.transform = `translateX(${dx}px) rotate(${rotation}deg) scale(${scale})`;
    updateSwipeVisual(dx);
  };

  const onMouseUp = (ev) => {
    if (!isDraggingCard) return;
    isDraggingCard = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    const dx = ev.clientX - touchStartX;
    const threshold = 80;

    if (Math.abs(dx) > threshold) {
      suppressClickAfterSwipe = true;
      const isRight = dx > 0;
      animateCardSwipeOut(isRight, () => {
        handleStudyAnswer(isRight);
      });
    } else {
      studyCardEl.style.transition = "transform 0.18s ease-out";
      studyCardEl.style.transform = "";
      setTimeout(() => {
        studyCardEl.style.transition = "";
        clearSwipeVisual();
      }, 180);
    }
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
});

// Tangentbord
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

// Justera kort vid resize
window.addEventListener("resize", () => {
  if (state.inStudyMode && state.studyQueue.length > 0) {
    adjustCardHeight();
  }
});

// ==========================
//  INIT – KOLLA SESSION
// ==========================

(async () => {
  const { data } = await supabaseClient.auth.getSession();
  const session = data?.session || null;

  if (session?.user) {
    await initAfterLogin(session.user);
  } else {
    loginViewEl.classList.remove("hidden");
    appContainerEl.classList.add("hidden");
  }
})();
