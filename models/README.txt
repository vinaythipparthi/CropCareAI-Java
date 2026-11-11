Place your trained ONNX image classifier at:
  backend/models/cropcare.onnx

Place one class label per line at:
  backend/models/class_names.txt

IMPORTANT MODEL CONTRACT:
- Input tensor name: first ONNX input
- Input shape: [1, 3, 224, 224]
- RGB channels, NCHW layout
- Pixel normalization: (pixel / 127.5) - 1.0
- Output: float scores/probabilities shaped [1, number_of_classes]
- Class order must exactly match class_names.txt

The included Java service expects the output values to be probabilities. If your ONNX model outputs logits, apply softmax before confidence thresholding or adapt the Java inference service.
Do not invent class labels or claim the model works until you have trained and evaluated it.
