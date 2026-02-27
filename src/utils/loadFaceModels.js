import * as faceapi from "face-api.js";

export async function loadFaceModels() {
  const MODEL_URL = "/models";

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
  ]);

  window.faceapi = faceapi;
}
