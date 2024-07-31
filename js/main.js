const video = document.getElementById("video");
const isScreenSmall = window.matchMedia("(max-width: 700px)");
let predictedAges = [];

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  faceapi.nets.faceExpressionNet.loadFromUri("/models"),
  faceapi.nets.ageGenderNet.loadFromUri("/models")
]).then(startVideo).catch(err => console.error("Failed to load models", err));

function startVideo() {
  navigator.getUserMedia(
    { video: {} },
    stream => {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
      };
    },
    err => console.error("Error accessing webcam:", err)
  );
}

function screenResize(isScreenSmall) {
  if (isScreenSmall.matches) {
    video.style.width = "320px";
  } else {
    video.style.width = "500px";
  }
}

screenResize(isScreenSmall); // Call listener function at run time
isScreenSmall.addListener(screenResize);

video.addEventListener("playing", () => {
  console.log("Video is playing");
  const canvas = faceapi.createCanvasFromMedia(video);
  const container = document.querySelector(".container");
  container.append(canvas);

  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceExpressions()
      .withAgeAndGender();

    if (detection) {
      // Manually resize detection
      const resizedDetection = resizeDetection(detection, displaySize);
      console.log(resizedDetection);

      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

      faceapi.draw.drawDetections(canvas, resizedDetection);
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);

      const age = resizedDetection.age;
      const interpolatedAge = interpolateAgePredictions(age);
      const gender = resizedDetection.gender;
      const expressions = resizedDetection.expressions;
      const maxValue = Math.max(...Object.values(expressions));
      const emotion = Object.keys(expressions).filter(
        item => expressions[item] === maxValue
      );
      document.getElementById("age").innerText = `Age - ${interpolatedAge}`;
      document.getElementById("gender").innerText = `Gender - ${gender}`;
      document.getElementById("emotion").innerText = `Emotion - ${emotion[0]}`;
    }
  }, 1);
});

function resizeDetection(detection, displaySize) {
  const { width, height } = displaySize;
  const box = detection.detection.box;
  const scaleX = width / video.videoWidth;
  const scaleY = height / video.videoHeight;
  const resizedBox = new faceapi.Box({
    x: box.x * scaleX,
    y: box.y * scaleY,
    width: box.width * scaleX,
    height: box.height * scaleY
  });

  detection.detection.box = resizedBox;
  detection.landmarks.positions = detection.landmarks.positions.map(pos => ({
    x: pos.x * scaleX,
    y: pos.y * scaleY
  }));

  return detection;
}

function interpolateAgePredictions(age) {
  predictedAges = [age].concat(predictedAges).slice(0, 30);
  const avgPredictedAge =
    predictedAges.reduce((total, a) => total + a) / predictedAges.length;
  return avgPredictedAge;
}
