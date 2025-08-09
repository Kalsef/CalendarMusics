const date = new Date();
let currYear = date.getFullYear();
let currMonth = date.getMonth();

const daysContainer = document.querySelector(".days");
const monthElement = document.querySelector(".date");
const prevBtn = document.querySelector(".prev");
const nextBtn = document.querySelector(".next");
const todayBtn = document.querySelector(".today-btn");
const gotoBtn = document.querySelector(".goto-btn");
const dateInput = document.querySelector(".date-input");
const eventDay = document.querySelector(".event-day");
const eventDate = document.querySelector(".event-date");
const audioPlay = document.getElementById("audioPlayer");
const songTitle = document.getElementById("songTitle");
const lyrics = document.getElementById("lyrics");
const progressBar = document.getElementById("progressBar");
const currentTime = document.getElementById("currentTime");
const totalTime = document.getElementById("totalTime");
const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const eventTitle = document.querySelector(".event-title");
const eventTime = document.querySelector(".event-time");
const coracao = document.getElementById("coracao");
const tabsContainer = document.getElementById("tabs");

let songs = {}; // vindo do backend
let musicaAtualIndex = 0; // índice da aba

playBtn?.addEventListener("click", () => {
  audioPlay?.play();
  playBtn.style.display = "none";
  pauseBtn.style.display = "inline-block";
});
pauseBtn?.addEventListener("click", () => {
  audioPlay?.pause();
  pauseBtn.style.display = "none";
  playBtn.style.display = "inline-block";
});

const months = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

async function carregarMusicas() {
  try {
    const res = await fetch("/api/musicas");
    if (!res.ok) throw new Error("Falha ao buscar músicas");
    songs = await res.json();
    renderCalendar();
  } catch (err) {
    console.error(err);
    songs = {};
    renderCalendar();
  }
}

function renderCalendar() {
  const firstDay = new Date(currYear, currMonth, 1).getDay();
  const lastDate = new Date(currYear, currMonth + 1, 0).getDate();
  const lastDay = new Date(currYear, currMonth, lastDate).getDay();
  const prevLastDate = new Date(currYear, currMonth, 0).getDate();
  let days = "";

  for (let i = firstDay; i > 0; i--) days += `<div class="day prev-date">${prevLastDate - i + 1}</div>`;

  for (let i = 1; i <= lastDate; i++) {
    const fullDate = `${currYear}-${String(currMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const hasEvent = songs[fullDate] ? "event" : "";
    const todayCheck = (i === date.getDate() && currMonth === date.getMonth() && currYear === date.getFullYear()) ? "today" : "";
    days += `<div class="day ${hasEvent} ${todayCheck}" data-date="${fullDate}">${i}</div>`;
  }

  for (let i = lastDay; i < 6; i++) days += `<div class="day next-date">${i - lastDay + 1}</div>`;

  daysContainer.innerHTML = days;
  monthElement.textContent = `${months[currMonth]} ${currYear}`;

  const selected = document.querySelector(".day.selected");
  if (!selected) {
    const todayStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    const todayEl = document.querySelector(`.day[data-date="${todayStr}"]`);
    if (todayEl) {
      todayEl.classList.add("selected");
      musicaAtualIndex = 0;
      loadSong(todayStr);
    }
  }
}

daysContainer?.addEventListener("click", (e) => {
  const day = e.target.closest(".day");
  if (!day || !day.dataset.date) return;
  daysContainer.querySelectorAll(".day.selected").forEach(d => d.classList.remove("selected"));
  day.classList.add("selected");
  musicaAtualIndex = 0;
  updateTabsForDate(day.dataset.date);
  loadSong(day.dataset.date);
});

function updateTabsForDate(dateStr) {
  tabsContainer.innerHTML = "";
  const arr = songs[dateStr] || [];
  if (!arr || arr.length === 0) {
    const btn = document.createElement("button");
    btn.textContent = "Sem músicas";
    btn.disabled = true;
    btn.classList.add("music-tab-btn");
    tabsContainer.appendChild(btn);
    return;
  }

  arr.forEach((m, idx) => {
    const btn = document.createElement("button");
    if (idx === 0) {
      btn.textContent = "Música de Bom Dia";
    } else {
      if (arr.length === 2) {
        // Apenas 1 Dedicação Especial, sem número
        btn.textContent = "Dedicação Especial";
      } else {
        // Mais de uma Dedicação Especial, adiciona número
        btn.textContent = `Dedicação Especial ${idx + 1}`;
      }
    }
    btn.dataset.index = idx;
    btn.classList.add("music-tab-btn");
    if (idx === musicaAtualIndex) {
      btn.classList.add("active");
    }
    btn.onclick = () => {
      musicaAtualIndex = idx;
      updateTabStyles();
      const sel = document.querySelector(".day.selected");
      if (sel && sel.dataset.date) loadSong(sel.dataset.date);
    };
    tabsContainer.appendChild(btn);
  });

  updateTabStyles();
}

function updateTabStyles() {
  [...tabsContainer.children].forEach((btn, idx) => {
    btn.style.opacity = (idx === musicaAtualIndex) ? "1" : "0.6";
  });
}

function loadSong(dateStr) {
  const musicasDoDia = songs[dateStr] || [];
  const song = musicasDoDia[musicaAtualIndex];

  const [year, month, day] = dateStr.split("-");
  if (eventDay) eventDay.textContent = String(parseInt(day, 10));
  if (eventDate) eventDate.textContent = `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;

  updateTabsForDate(dateStr);

  if (song && song.audio) {
    songTitle.textContent = song.titulo || "Título desconhecido";
    lyrics.textContent = song.letra || "Letra indisponível.";
    if (audioPlay) {
      audioPlay.src = song.audio;
      audioPlay.load();
    }
    eventTitle.textContent = `Tocando: ${song.titulo || "—"}`;
    eventTime.textContent = "00:00";
    playBtn.style.display = "inline-block";
    pauseBtn.style.display = "none";
  } else {
    songTitle.textContent = "Sem música para esta data/posição.";
    lyrics.textContent = "Sem letra.";
    if (audioPlay) {
      audioPlay.src = "";
      audioPlay.load();
    }
    eventTitle.textContent = "Nenhuma música selecionada";
    eventTime.textContent = "00:00";
    if (progressBar) progressBar.value = 0;
    if (currentTime) currentTime.textContent = "00:00";
    if (totalTime) totalTime.textContent = "00:00";
  }
}

audioPlay?.addEventListener("loadedmetadata", () => {
  if (audioPlay && totalTime) totalTime.textContent = formatTime(audioPlay.duration || 0);
  if (audioPlay && eventTime) eventTime.textContent = formatTime(audioPlay.duration || 0);
});

function atualizarProgresso() {
  if (!audioPlay || !progressBar || !coracao) return;
  const duracao = audioPlay.duration || 0;
  const tempoAtual = audioPlay.currentTime || 0;
  const porcentagem = duracao ? (tempoAtual / duracao) * 100 : 0;
  progressBar.value = porcentagem;
  const posicao = Math.min(Math.max(porcentagem, 0), 100);
  coracao.style.left = `${posicao}%`;
  if (currentTime) currentTime.textContent = formatTime(tempoAtual);
}
audioPlay?.addEventListener("timeupdate", atualizarProgresso);

audioPlay?.addEventListener("ended", () => {
  playBtn.style.display = "inline-block";
  pauseBtn.style.display = "none";
  progressBar.value = 0;
  currentTime.textContent = "00:00";
  eventTime.textContent = formatTime(audioPlay.duration || 0);
});

const barra = document.querySelector(".barra");
barra?.addEventListener("click", e => {
  if (!audioPlay || !barra || !audioPlay.duration) return;
  const rect = barra.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const largura = rect.width;
  const novoTempo = (clickX / largura) * audioPlay.duration;
  audioPlay.currentTime = novoTempo;
  atualizarProgresso();
});

progressBar?.addEventListener("input", () => {
  if (audioPlay && !isNaN(audioPlay.duration)) {
    audioPlay.currentTime = (progressBar.value / 100) * audioPlay.duration;
  }
});

function formatTime(sec) {
  if (!sec || isNaN(sec)) return "00:00";
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

prevBtn?.addEventListener("click", () => {
  currMonth--;
  if (currMonth < 0) { currMonth = 11; currYear--; }
  renderCalendar();
});
nextBtn?.addEventListener("click", () => {
  currMonth++;
  if (currMonth > 11) { currMonth = 0; currYear++; }
  renderCalendar();
});
todayBtn?.addEventListener("click", () => {
  currYear = date.getFullYear(); currMonth = date.getMonth(); renderCalendar();
});
gotoBtn?.addEventListener("click", () => {
  const val = dateInput?.value.trim();
  if (!val) return alert("Data inválida! Use o formato mm/aaaa.");
  const dateArr = val.split("/");
  if (dateArr.length === 2) {
    const m = parseInt(dateArr[0], 10) - 1;
    const y = parseInt(dateArr[1], 10);
    if (!isNaN(m) && !isNaN(y) && m >= 0 && m <= 11 && y > 0) {
      currMonth = m; currYear = y; renderCalendar();
    } else alert("Data inválida! Use o formato mm/aaaa.");
  } else alert("Data inválida! Use o formato mm/aaaa.");
});

carregarMusicas();
