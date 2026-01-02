const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const ytdl = require("ytdl-core");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let state = {
  currentVideoId: null,
  currentTitle: null,
  startTime: null,
  queue: [],
  timer: null,
};

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log(`New connection : ${socket.id}`);

  // Sync immédiate au nouvel arrivant
  if (state.currentVideoId) {
    socket.emit("sync", {
      videoId: state.currentVideoId,
      title: state.currentTitle,
      startTime: state.startTime,
    });
  }
  socket.emit("update_queue", state.queue);

  socket.on("add_to_queue", async (videoId) => {
    try {
      console.log("Adding video: ", videoId);
      const info = await ytdl.getBasicInfo(videoId);
      const videoItem = {
        id: videoId,
        title: info.videoDetails.title,
        duration: parseInt(info.videoDetails.lengthSeconds),
      };

      if (!state.currentVideoId) {
        playVideo(videoItem);
      } else {
        state.queue.push(videoItem);
        io.emit("update_queue", state.queue);
      }
    } catch (err) {
      console.error("Cannot add video: ", err.message);
    }
  });

  socket.on("next", () => {
    nextVideo();
  });

  socket.on("clear", () => {
    clearQueue();
  });

  socket.on("delete", (videoId, index) => {
    deleteFromQueue(videoId, index);
  });

  socket.on("reorder", (newQueue) => {
    state.queue = newQueue;
    io.emit("update_queue", state.queue);
  });
});

async function playVideo(videoItem) {
  state.currentVideoId = videoItem.id;
  state.currentTitle = videoItem.title;
  state.startTime = Date.now();

  console.log("Now playing: ", state.currentTitle);

  io.emit("sync", {
    videoId: state.currentVideoId,
    title: state.currentTitle,
    startTime: state.startTime,
  });
  io.emit("update_queue", state.queue);

  // Programmation de la suite
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    nextVideo();
  }, videoItem.duration * 1000);
}

async function nextVideo() {
  if (state.queue.length > 0) {
    playVideo(state.queue.shift());
  } else {
    // Replay the last video
    state.startTime = Date.now();
    io.emit("sync", {
      videoId: state.currentVideoId,
      title: state.currentTitle,
      startTime: state.startTime,
    });
  }
}

function clearQueue() {
  state.queue = [];
  io.emit("update_queue", state.queue);
}

function deleteFromQueue(videoId, index) {
  const itemAtPosition = state.queue[index];
  if (itemAtPosition && itemAtPosition.id === videoId) {
    state.queue.splice(index, 1);
    console.log(`Deleted: ${itemAtPosition.title} at ${index + 1}`);
    io.emit("update_queue", state.queue);
  } else {
    console.log("Deletion conflict: no change occurred");
  }
}

server.listen(8000, () =>
  console.log("🚀 Jukebox Server on http://localhost:8000"),
);
