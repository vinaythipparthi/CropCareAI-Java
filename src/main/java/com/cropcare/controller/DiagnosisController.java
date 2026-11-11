package com.cropcare.controller;

import com.cropcare.service.DiagnosisService;
import com.cropcare.service.DiagnosisService.DiagnosisResult;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class DiagnosisController {
    private final DiagnosisService diagnosisService;

    public DiagnosisController(DiagnosisService diagnosisService) {
        this.diagnosisService = diagnosisService;
    }

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(java.util.Map.of(
                "status", "UP",
                "application", "CropCare AI",
                "modelReady", diagnosisService.isModelReady()
        ));
    }

    @PostMapping(value = "/diagnose", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DiagnosisResult> diagnose(@RequestPart("image") MultipartFile image,
                                                     @RequestParam(defaultValue = "en") String language) {
        DiagnosisResult result = diagnosisService.diagnose(image, language);
        if ("MODEL_NOT_READY".equals(result.status())) {
            return ResponseEntity.status(503).body(result);
        }
        if ("INVALID_IMAGE".equals(result.status())) {
            return ResponseEntity.badRequest().body(result);
        }
        return ResponseEntity.ok(result);
    }
}
