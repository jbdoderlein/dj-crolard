const socket = io();
let player;
let currentVideoId = null;
let currentVideoStartTime = null;
let sortableInstance = null;
let localQueue = [];

window.addEventListener("message", (event) => {
  if(event.data && event.data.source === "dj-crolard-extension") {
    // Relay the extension event to the server so every connected client
    // can react (play the sound). Only the browser with the extension
    // active will emit this message to the server.
    socket.emit('extension_event', event.data.payload);

    // Optionally play locally immediately so the sender also hears it
    // (uncomment if desired):
    // playSoundForEvent(event.data.payload);
  }
});

// Preset library (id and title)
const presetLibrary = [
  { id: "xHQod1tMYJE", title: "Test" },
];

function renderLibrary() {
  const lib = document.getElementById("library-view");
  if (!lib) return;
  lib.innerHTML = presetLibrary
    .map(
      (item) => `
        <li>
          <div class="item-content">${item.title}</div>
          <button class="add-btn" onclick="addPreset('${item.id}')">Add</button>
        </li>
      `,
    )
    .join("");
}

function addPreset(id) {
  socket.emit("add_to_queue", id);
}

// Initialisation API YouTube
function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    height: "100%",
    width: "100%",
    playerVars: { autoplay: 1, controls: 1 },
    events: {
      onReady: () => {
        document.getElementById("btn-sync").style.display = "block";
        renderLibrary();
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PAUSED)
          console.log("Pause detected. Clic Synchronize to come back to live.");
      },
    },
  });
}

// Extraction ID
function extractId(url) {
  const reg =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(reg);
  return match ? match[1] : null;
}

function sendUrl() {
  const input = document.getElementById("url-input");
  const id = extractId(input.value);
  if (id) {
    socket.emit("add_to_queue", id);
    input.value = "";
  }
}

// WebSocket Events
socket.on("sync", (data) => {
  currentVideoId = data.videoId;
  currentVideoStartTime = data.startTime;
  if (player && player.loadVideoById) forceSync();
});

socket.on("update_queue", (queue) => {
  localQueue = queue;
  const view = document.getElementById("playlist-view");
  if (queue.length == 0) {
    view.innerHTML = "<li>Queue is empty :/</li>";
  } else {
    view.innerHTML = queue
      .map(
        (item, i) =>
          `<li data-index="${i}">
             <div class="item-content">
               <span class="index">${i + 1}</span> ${item.title}
             </div>
             <button class="delete-btn" onclick="askDelete('${item.id}', ${i})">⨉</button>
           </li>`,
      )
      .join("");
    initSortable();
  }
});

function initSortable() {
  const el = document.getElementById("playlist-view");
  if (sortableInstance) sortableInstance.destroy();

  sortableInstance = new Sortable(el, {
    animation: 150,
    ghostClass: "sortable-ghost",
    onEnd: function () {
      const items = el.querySelectorAll("li");
      const newQueue = Array.from(items).map(
        (li) => localQueue[li.dataset.index],
      );
      socket.emit("reorder", newQueue);
    },
  });
}

socket.on("stop_video", () => {
  if (player) player.stopVideo();
});

// La fonction clé : calcule le temps réel par rapport au serveur
function forceSync() {
  if (player && currentVideoId && currentVideoStartTime) {
    const elapsed = (Date.now() - currentVideoStartTime) / 1000;
    player.loadVideoById({
      videoId: currentVideoId,
      startSeconds: elapsed,
    });
    player.playVideo();
  }
}

function askNextVideo() {
  socket.emit("next");
}

function askClearQueue() {
  socket.emit("clear");
}

function askDelete(videoId, index) {
  socket.emit("delete", videoId, index);
}

// Play audio helpers and handler for relayed extension events
function playSound(src) {
  try {
    const audio = new Audio(src);
    // Read slider value directly from DOM and use it (0-100 -> 0.0-1.0)
    const slider = document.getElementById('event-volume');
    const raw = slider ? Number(slider.value) : NaN;
    const vol = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw / 100)) : 0.9;
    audio.volume = vol;
    audio.play().catch(err => console.warn('Audio play failed:', err));
  } catch (e) {
    console.warn('Could not play sound:', e);
  }
}

function playSoundForEvent(ev) {
  console.log('Received event for sound playback:', ev);
  if (!ev || !ev.EventName) return;

  if (ev.EventName === 'ChampionKill') {
    if (ev.KillerName) {
      switch (ev.KillerName) {
        case 'YEP jbdod':
          // sound when YEP jbdod gets a kill
          playSound('/sounds/aaahhh.ogg');
          return;
        // add more killer-specific cases here
        default:
          break;
      }
    }

    if (ev.VictimName) {
      switch (ev.VictimName) {
        case 'YEP jbdod':
          // sound when YEP jbdod dies
          playSound('/sounds/abssysalementnulla.mp3');
          return;
        // add more victim-specific cases here
        default:
          break;
      }
    }
  }
}

// When the server relays an extension event, play the mapped sound
socket.on('extension_event', (payload) => {
  playSoundForEvent(payload);
});
