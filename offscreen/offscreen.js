// Enregistrement vidéo de l'onglet (document hors écran, seul endroit où MV3 permet
// d'utiliser le flux de chrome.tabCapture avec MediaRecorder).
// L'enregistrement s'arrête tout seul au bout de 2 minutes.
(() => {
  const MAX_MS = 2 * 60 * 1000;
  let recorder = null;
  let stream = null;
  let audioCtx = null;
  let chunks = [];
  let autoStop = 0;
  let lastUrl = null;

  function pickMime() {
    const options = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    return options.find((m) => MediaRecorder.isTypeSupported(m)) || "";
  }

  async function start(streamId) {
    if (recorder) return;
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } },
      video: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId, maxFrameRate: 60 } }
    });
    // Capturer l'onglet coupe son son pour vous : on le renvoie vers les haut-parleurs.
    audioCtx = new AudioContext();
    audioCtx.createMediaStreamSource(stream).connect(audioCtx.destination);

    const mimeType = pickMime();
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      clearTimeout(autoStop);
      const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      chunks = [];
      stream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close();
      recorder = null;
      lastUrl = URL.createObjectURL(blob);
      chrome.runtime.sendMessage({ type: "rec-done", url: lastUrl, size: blob.size });
    };
    recorder.start(1000);
    autoStop = setTimeout(stop, MAX_MS);
  }

  function stop() {
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.target !== "offscreen") return;
    if (msg.type === "start") {
      start(msg.streamId).catch((err) => chrome.runtime.sendMessage({ type: "rec-error", message: err.message }));
    } else if (msg.type === "stop") {
      stop();
    } else if (msg.type === "cleanup") {
      if (lastUrl) URL.revokeObjectURL(lastUrl);
      window.close();
    }
  });
})();
