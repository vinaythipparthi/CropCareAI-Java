# CropCare AI - Java Full Stack

A farmer-focused crop leaf screening web application built using Java, Spring Boot, HTML, CSS, JavaScript, and ONNX Runtime.

## Features

- Responsive agriculture dashboard
- JPG, PNG, and WEBP image upload with preview and drag-and-drop
- Java REST API for image validation and ONNX inference
- Tomato and potato class support, depending on installed model labels
- Confidence-based uncertainty response
- Basic image blur screening
- Advisory lookup table without pesticide dosage recommendations
- English, Hindi, and Telugu advisory text
- Browser voice input and output
- KVK directory link

## Technology Stack

- Java
- Spring Boot
- Maven
- ONNX Runtime
- HTML, CSS, JavaScript

## Project Structure

```text
CropCareAI-Java/
├── models/
│   ├── cropcare.onnx
│   ├── class_names.txt
│   └── README.txt
├── src/
│   └── main/
│       ├── java/
│       └── resources/
├── pom.xml
└── README.md
```

## Run Locally

1. Install the required JDK version and Maven.
2. Open a terminal in the project root.
3. Run `mvn spring-boot:run`.
4. Open http://localhost:8080.
5. Check http://localhost:8080/api/health.

The frontend is served by Spring Boot from `src/main/resources/static`.

## ONNX Model

The repository includes an ONNX model at `models/cropcare.onnx` and its class labels at `models/class_names.txt`.

The expected model contract is documented in `models/README.txt`.

Treat model predictions as preliminary screening results until the model has been properly evaluated on unseen images.

## API Endpoints

- `GET /api/health`
- `POST /api/diagnose`

The diagnosis endpoint accepts multipart form data with:
- `image`
- Optional `language` (`en`, `hi`, or `te`)

## Evaluation and Limitations

- Support only crop and disease classes actually present in the model.
- Evaluate using at least 30 unseen images, including field photos and poor-quality images.
- Measure accuracy, precision, recall, F1 score, confusion matrix, and rejection rates before making performance claims.
- Tune the confidence threshold using validation data.
- The blur score is a simple heuristic, not a validated image-quality classifier.
- Advisory text is not a complete treatment recommendation.
- Do not provide pesticide dosages. Refer uncertain cases to the local KVK.
- Uploaded images are not persisted by the demo application.
- Automatic nearest-KVK geolocation is not implemented.