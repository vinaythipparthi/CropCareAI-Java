package com.cropcare.service;

import ai.onnxruntime.*;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.nio.FloatBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.List;

@Service
public class DiagnosisService {

    private static final int IMAGE_SIZE = 224;
    private static final int EXPECTED_CLASSES = 6;

    private final AdvisoryService advisoryService;

    private OrtEnvironment environment;
    private OrtSession session;
    private String[] labels;

    @Value("${cropcare.model.path:models/cropcare.onnx}")
    private String modelPath;

    @Value("${cropcare.confidence-threshold:0.75}")
    private float confidenceThreshold;

    @Value("${cropcare.max-file-mb:8}")
    private int maxFileMb;

    public DiagnosisService(AdvisoryService advisoryService) {
        this.advisoryService = advisoryService;
    }

    // Load ONNX model and class labels after dependency injection.
    @PostConstruct
    public void loadModel() {
        try {
            Path path = Paths.get(modelPath).toAbsolutePath();

            if (!Files.exists(path)) {
                System.err.println("CropCare model not found at: " + path);
                return;
            }

            Path labelsPath = Paths.get("models/class_names.txt")
                    .toAbsolutePath();

            if (!Files.exists(labelsPath)) {
                System.err.println("Class labels not found at: " + labelsPath);
                return;
            }

            labels = Files.readAllLines(labelsPath)
                    .stream()
                    .filter(line -> !line.isBlank())
                    .toArray(String[]::new);

            if (labels.length != EXPECTED_CLASSES) {
                throw new IllegalStateException(
                        "Expected " + EXPECTED_CLASSES
                                + " labels, but found " + labels.length
                );
            }

            environment = OrtEnvironment.getEnvironment();

            OrtSession.SessionOptions options =
                    new OrtSession.SessionOptions();

            session = environment.createSession(
                    path.toString(),
                    options
            );

            System.out.println("CropCare ONNX model loaded successfully!");
            System.out.println("Model inputs: " + session.getInputInfo().keySet());
            System.out.println("Model outputs: " + session.getOutputInfo().keySet());
            System.out.println("Loaded labels: " + List.of(labels));

        } catch (Exception ex) {
            session = null;
            System.err.println("Could not load CropCare ONNX model!");
            ex.printStackTrace();
        }
    }

    public boolean isModelReady() {
        return session != null && labels != null;
    }

    // Main image diagnosis method.
    public DiagnosisResult diagnose(
            MultipartFile file,
            String language
    ) {

        if (file == null || file.isEmpty()
                || file.getSize() > maxFileMb * 1024L * 1024L) {

            return result(
                    "INVALID_IMAGE",
                    "Please upload a valid image smaller than "
                            + maxFileMb + " MB.",
                    null, 0, null, language
            );
        }

        if (!isModelReady()) {
            return result(
                    "MODEL_NOT_READY",
                    "The AI model or class labels could not be loaded. "
                            + "Check the models folder.",
                    null, 0, null, language
            );
        }

        try (InputStream in = file.getInputStream()) {

            BufferedImage original = ImageIO.read(in);

            if (original == null
                    || original.getWidth() < 80
                    || original.getHeight() < 80) {

                return result(
                        "INVALID_IMAGE",
                        "Please upload a supported JPG or PNG leaf photograph.",
                        null, 0, null, language
                );
            }

            if (estimateSharpness(original) < 12.0) {
                return result(
                        "UNCLEAR_IMAGE",
                        "This photo appears blurry. Take another photo "
                                + "in good lighting and keep the leaf in focus.",
                        null, 0, null, language
                );
            }

            // Preprocess image to match TensorFlow training.
            float[] input = preprocess(original);

            String inputName =
                    session.getInputNames().iterator().next();

            // Model input format: NHWC
            // [Batch, Height, Width, Channels]
            long[] shape = {1, IMAGE_SIZE, IMAGE_SIZE, 3};

            try (
                    OnnxTensor tensor = OnnxTensor.createTensor(
                            environment,
                            FloatBuffer.wrap(input),
                            shape
                    );

                    OrtSession.Result output = session.run(
                            Collections.singletonMap(inputName, tensor)
                    )
            ) {

                float[][] scores = toScores(output.get(0).getValue());

                if (scores.length == 0
                        || scores[0].length != labels.length) {

                    return result(
                            "UNCERTAIN",
                            "The model output does not match the configured "
                                    + "class list.",
                            null, 0, null, language
                    );
                }

                int best = argmax(scores[0]);

                float confidence = scores[0][best];

                String className = labels[best];

                String crop;

                if (className.startsWith("Tomato")) {
                    crop = "Tomato";
                } else if (className.startsWith("Potato")) {
                    crop = "Potato";
                } else {
                    crop = "Unsupported crop";
                }

                if (crop.equals("Unsupported crop")) {
                    return result(
                            "UNSUPPORTED_CROP",
                            "This version supports tomato and potato only.",
                            crop, confidence, null, language
                    );
                }

                if (confidence < confidenceThreshold) {
                    return result(
                            "UNCERTAIN",
                            "The prediction confidence is below the "
                                    + "configured threshold. Please retake "
                                    + "the photograph or consult an agricultural expert.",
                            crop, confidence, null, language
                    );
                }

                AdvisoryService.Advisory advisory =
                        advisoryService.find(className, language);

                return result(
                        "SUCCESS",
                        "Likely result only. This is not a confirmed diagnosis.",
                        crop,
                        confidence,
                        className,
                        language,
                        advisory
                );
            }

        } catch (Exception ex) {

            System.err.println("Image diagnosis failed:");
            ex.printStackTrace();

            return result(
                    "ERROR",
                    "We could not analyze this image. "
                            + "Please try a clear JPG or PNG photograph.",
                    null, 0, null, language
            );
        }
    }

    // TensorFlow MobileNetV2 preprocessing:
    // RGB, 224x224, float32, values scaled to [-1, 1].
    // Output layout: NHWC.
    private float[] preprocess(BufferedImage source) {

        BufferedImage resized = new BufferedImage(
                IMAGE_SIZE,
                IMAGE_SIZE,
                BufferedImage.TYPE_INT_RGB
        );

        Graphics2D g = resized.createGraphics();

        g.setRenderingHint(
                RenderingHints.KEY_INTERPOLATION,
                RenderingHints.VALUE_INTERPOLATION_BILINEAR
        );

        g.drawImage(
                source,
                0,
                0,
                IMAGE_SIZE,
                IMAGE_SIZE,
                null
        );

        g.dispose();

        float[] data = new float[
                IMAGE_SIZE * IMAGE_SIZE * 3
                ];

        int p = 0;

        for (int y = 0; y < IMAGE_SIZE; y++) {

            for (int x = 0; x < IMAGE_SIZE; x++) {

                int rgb = resized.getRGB(x, y);

                float red =
                        ((rgb >> 16) & 255) / 127.5f - 1.0f;

                float green =
                        ((rgb >> 8) & 255) / 127.5f - 1.0f;

                float blue =
                        (rgb & 255) / 127.5f - 1.0f;

                data[p++] = red;
                data[p++] = green;
                data[p++] = blue;
            }
        }

        return data;
    }

    // Estimate image sharpness using Laplacian variance.
    private double estimateSharpness(BufferedImage image) {

        int w = Math.min(image.getWidth(), 500);
        int h = Math.min(image.getHeight(), 500);

        BufferedImage scaled = new BufferedImage(
                w,
                h,
                BufferedImage.TYPE_BYTE_GRAY
        );

        Graphics2D g = scaled.createGraphics();
        g.drawImage(image, 0, 0, w, h, null);
        g.dispose();

        double sum = 0;
        double sum2 = 0;
        int count = 0;

        for (int y = 1; y < h - 1; y++) {

            for (int x = 1; x < w - 1; x++) {

                int center = scaled.getRaster()
                        .getSample(x, y, 0);

                int lap =
                        scaled.getRaster().getSample(x - 1, y, 0)
                                + scaled.getRaster().getSample(x + 1, y, 0)
                                + scaled.getRaster().getSample(x, y - 1, 0)
                                + scaled.getRaster().getSample(x, y + 1, 0)
                                - 4 * center;

                sum += lap;
                sum2 += lap * lap;
                count++;
            }
        }

        double mean = sum / Math.max(count, 1);

        return sum2 / Math.max(count, 1) - mean * mean;
    }

    // Convert ONNX output into a two-dimensional score array.
    private float[][] toScores(Object value) {

        if (value instanceof float[][] scores) {
            return scores;
        }

        if (value instanceof float[] scores) {
            return new float[][]{scores};
        }

        throw new IllegalStateException(
                "Unexpected ONNX model output type: "
                        + value.getClass().getName()
        );
    }

    // Find the class with the highest model score.
    private int argmax(float[] values) {

        int best = 0;

        for (int i = 1; i < values.length; i++) {

            if (values[i] > values[best]) {
                best = i;
            }
        }

        return best;
    }

    private DiagnosisResult result(
            String status,
            String message,
            String crop,
            float confidence,
            String disease,
            String language
    ) {

        return new DiagnosisResult(
                status,
                message,
                crop,
                confidence,
                disease,
                null,
                language
        );
    }

    private DiagnosisResult result(
            String status,
            String message,
            String crop,
            float confidence,
            String disease,
            String language,
            AdvisoryService.Advisory advisory
    ) {

        return new DiagnosisResult(
                status,
                message,
                crop,
                confidence,
                disease,
                advisory,
                language
        );
    }

    public record DiagnosisResult(
            String status,
            String message,
            String crop,
            float confidence,
            String disease,
            AdvisoryService.Advisory advisory,
            String language
    ) {}
}
