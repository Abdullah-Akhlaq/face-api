import * as faceapi from "face-api.js";
import React, { useRef, useState } from "react";

function App() {
  const [selectedModel, setSelectedModel] = useState(null);
  const [captureVideo, setCaptureVideo] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detections, setDetections] = useState([]);
  const videoRef = useRef();
  const canvasRef = useRef();
  const videoHeight = 480;
  const videoWidth = 640;

  // ✅ Load the selected model dynamically
  const loadModel = async (model) => {
    const MODEL_URL = `${window.location.origin}/models`;
    try {
      setModelsLoaded(false);
      console.log(`⏳ Loading ${model} model...`);

      if (model === "ssd" && !faceapi.nets.ssdMobilenetv1.isLoaded) {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
      } else if (model === "tiny" && !faceapi.nets.tinyFaceDetector.isLoaded) {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      } else if (model === "landmark" && !faceapi.nets.faceLandmark68Net.isLoaded) {
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      }

      console.log(`✅ ${model} model loaded!`);
      setSelectedModel(model);
      setModelsLoaded(true);
    } catch (error) {
      console.error(`❌ Error loading ${model} model:`, error);
    }
  };

  // ✅ Start Webcam
  const startVideo = async () => {
    if (!modelsLoaded) {
      console.warn("⚠️ Model is still loading. Please wait...");
      return;
    }

    setCaptureVideo(true);
    navigator.mediaDevices
      .getUserMedia({ video: { width: videoWidth, height: videoHeight } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch((err) => {
        console.error("❌ Error accessing webcam:", err);
      });
  };

  // ✅ Process video based on selected model
  const handleVideoOnPlay = () => {
    if (!modelsLoaded || !selectedModel) {
      console.warn("⚠️ Cannot start detection. Model is not loaded yet.");
      return;
    }

    setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, videoWidth, videoHeight);

        const displaySize = { width: videoWidth, height: videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        let detectedFaces = [];

        if (selectedModel === "ssd") {
          detectedFaces = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options());
        } else if (selectedModel === "tiny") {
          detectedFaces = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
        } else if (selectedModel === "landmark") {
          detectedFaces = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options()).withFaceLandmarks();
        }

        if (detectedFaces.length > 0) {
          const resizedDetections = faceapi.resizeResults(detectedFaces, displaySize);
          setDetections(resizedDetections);
          
          faceapi.draw.drawDetections(canvas, resizedDetections);
          if (selectedModel === "landmark") {
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
          }

          // ✅ Draw Accuracy Line
          resizedDetections.forEach((det) => {
            const { x, y, width, height } = det?._box;
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y - 10);
            ctx.lineTo(x + width, y - 10);
            ctx.stroke();

            ctx.fillStyle = "red";
            ctx.font = "16px Arial";
            ctx.fillText(`Accuracy: ${(det?._score * 100).toFixed(2)}%`, x, y - 15);
          });
        }
      }
    }, 100);
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
  
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
  
    if (detections.length > 0) {
      const face = detections[0]?._box;
      const padding = 40;
  
      // ✅ First, draw the current video frame on the canvas
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
  
      // ✅ Draw accuracy line on the face (same as real-time detection)
      detections.forEach((det) => {
        const { x, y, width, height } = det?._box;
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x + width, y - 10);
        ctx.stroke();
  
        ctx.fillStyle = "red";
        ctx.font = "16px Arial";
        ctx.fillText(`Accuracy: ${(det?._score * 100).toFixed(2)}%`, x, y - 15);
      });
  
      // ✅ Now, crop the face + extra space from the canvas
      const faceX = Math.max(face.x - padding, 0);
      const faceY = Math.max(face.y - padding, 0);
      const faceWidth = Math.min(face.width + padding * 2, videoWidth);
      const faceHeight = Math.min(face.height + padding * 2, videoHeight);
  
      // ✅ Create a new passport-size canvas
      const passportWidth = 400;
      const passportHeight = 500;
      const passportCanvas = document.createElement("canvas");
      passportCanvas.width = passportWidth;
      passportCanvas.height = passportHeight;
      const passportCtx = passportCanvas.getContext("2d");
  
      // ✅ Fill background with white
      passportCtx.fillStyle = "white";
      passportCtx.fillRect(0, 0, passportWidth, passportHeight);
  
      // ✅ Draw the cropped face (WITH face-api lines) into the passport canvas
      passportCtx.drawImage(
        canvas, // Take from the updated canvas (which now has both video + lines)
        faceX, faceY, faceWidth, faceHeight, // Crop the detected face
        0, 0, passportWidth, passportHeight // Resize to passport size
      );
  
      // ✅ Convert to Blob (Bitmap) and download
      passportCanvas.toBlob((blob) => {
        if (blob) {
          console.log("✅ Passport-size Image Captured:", blob);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "passport_photo.png";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }, "image/png");
    }
  };
  
  

  // ✅ Close Webcam
  const closeWebcam = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      if (videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    }
    setCaptureVideo(false);
  };

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h2>Face Detection</h2>

      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => loadModel("ssd")} disabled={selectedModel === "ssd"}>
          Load SSD Model
        </button>
        <button onClick={() => loadModel("tiny")} disabled={selectedModel === "tiny"}>
          Load Tiny Face Detector
        </button>
        {/* <button onClick={() => loadModel("landmark")} disabled={selectedModel === "landmark"}>
          Load Landmark Model
        </button> */}
      </div>

      {captureVideo && modelsLoaded ? (
        <button onClick={closeWebcam} style={{ backgroundColor: "red", color: "white" }}>
          Close Webcam
        </button>
      ) : (
        <button onClick={startVideo} style={{ backgroundColor: "green", color: "white" }}>
          Open Webcam
        </button>
      )}

      {captureVideo && modelsLoaded ? (
        <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
          <video ref={videoRef} height={videoHeight} width={videoWidth} onPlay={handleVideoOnPlay} />
          <canvas ref={canvasRef} width={videoWidth} height={videoHeight} style={{ position: "absolute" }} />
        </div>
      ) : !modelsLoaded ? (
        <p>Loading {selectedModel} model...</p>
      ) : null}

      {detections.some((det) => det?._score > 0.7) && (
        <button onClick={captureImage} style={{ backgroundColor: "blue", color: "white", marginTop: "15px" }}>
          Submit (Capture Passport-Size)
        </button>
      )}
    </div>
  );
}

export default App;
