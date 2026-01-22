const POLL_INTERVAL = 2000; // ms
const FETCH_URL = "https://localhost:2999/liveclientdata/eventdata";
const MESSAGE_SOURCE = "dj-crolard-extension";

// Keep track of seen events so we only notify about newly appeared events
let seenEventIds = new Set();

function getEventId(ev) {
  // Prefer numeric EventID if present, otherwise fall back to serialized event
  if (ev && (typeof ev.EventID !== 'undefined')) return String(ev.EventID);
  return JSON.stringify(ev);
}

function pollAndSend() {
  fetch(FETCH_URL)
    .then(response => {
      if (!response.ok) throw new Error('Network response was not ok: ' + response.status);
      return response.json();
    })
    .then(data => {
      if (!data || !Array.isArray(data.Events)) {
        console.warn('Unexpected response shape, no Events array:', data);
        return;
      }

      const events = data.Events;
      const newEvents = [];

      for (const ev of events) {
        const id = getEventId(ev);
        if (!seenEventIds.has(id)) {
          seenEventIds.add(id);
          newEvents.push(ev);
        }
      }

      if (newEvents.length > 0) {
        // Send each new event as its own message
        for (const ev of newEvents) {
          window.postMessage({ source: MESSAGE_SOURCE, type: 'new-event', payload: ev }, '*');
          console.log('Sent new event to page', ev);
        }
      }
    })
    .catch(error => {
      // Ignore server failure as requested: reset internal seen list so when the
      // server becomes available we will resend events.
      console.warn('Fetch error - resetting seen event list:', error);
      seenEventIds.clear();
    });
}

// Start immediately and then poll every POLL_INTERVAL ms
pollAndSend();
setInterval(pollAndSend, POLL_INTERVAL);


