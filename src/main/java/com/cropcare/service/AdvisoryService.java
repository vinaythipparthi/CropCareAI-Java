package com.cropcare.service;

import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class AdvisoryService {
    private final Map<String, Advisory> advice = new HashMap<>();

    public AdvisoryService() {
        advice.put("Tomato___Early_blight", new Advisory(
                "Early blight (possible)", "Remove fallen, heavily affected plant debris where practical. Avoid prolonged leaf wetness and monitor nearby plants. Seek local agricultural guidance if symptoms spread.",
                "अधिक प्रभावित गिरी हुई पत्तियों और पौधों के अवशेषों को उचित तरीके से हटाएँ। पत्तियों को लंबे समय तक गीला रहने से बचाएँ और आसपास के पौधों की जाँच करें।",
                "తీవ్రంగా ప్రభావితమైన పడిపోయిన ఆకులు, మొక్కల అవశేషాలను సాధ్యమైనంతవరకు తొలగించండి. ఆకులు ఎక్కువసేపు తడిగా ఉండకుండా చూడండి."));

        advice.put("Tomato___Late_blight", new Advisory(
                "Late blight (possible)", "Monitor plants closely and avoid handling wet foliage. Remove severely affected material where appropriate and contact your local agriculture extension officer promptly.",
                "पौधों की नियमित जाँच करें और गीली पत्तियों को छूने से बचें। अधिक प्रभावित हिस्सों के बारे में स्थानीय कृषि अधिकारी से सलाह लें।",
                "మొక్కలను తరచుగా పరిశీలించండి. తడి ఆకులను తాకకుండా ఉండండి. స్థానిక వ్యవసాయ అధికారిని సంప్రదించండి."));

        advice.put("Potato___Early_blight", new Advisory(
                "Early blight (possible)", "Monitor older leaves for spreading spots, maintain field hygiene, and avoid prolonged leaf wetness. Confirm the problem with an agricultural expert.",
                "पुरानी पत्तियों पर धब्बों के फैलाव पर नज़र रखें। खेत की स्वच्छता बनाए रखें और कृषि विशेषज्ञ से पुष्टि करें।",
                "పాత ఆకులపై మచ్చలు వ్యాపిస్తున్నాయా గమనించండి. పొలం పరిశుభ్రత పాటించి వ్యవసాయ నిపుణుడిని సంప్రదించండి."));

        advice.put("Potato___Late_blight", new Advisory(
                "Late blight (possible)", "Inspect the crop frequently. Avoid moving through wet plants and seek prompt advice from the nearest KVK or agriculture department.",
                "फसल का बार-बार निरीक्षण करें। गीले पौधों के बीच चलने से बचें और नज़दीकी KVK से सलाह लें।",
                "పంటను తరచుగా పరిశీలించండి. తడి మొక్కల మధ్య నడవకుండా, సమీప KVK సలహా పొందండి."));
    }

    public Advisory find(String disease, String language) {
        Advisory a = advice.getOrDefault(disease, new Advisory(
                "Healthy or other supported class", "Continue routine monitoring. If symptoms are visible or worsening, consult an agricultural expert.",
                "नियमित रूप से फसल की निगरानी करें। लक्षण दिखें या बढ़ें तो कृषि विशेषज्ञ से सलाह लें।",
                "పంటను క్రమం తప్పకుండా గమనించండి. లక్షణాలు కనిపిస్తే వ్యవసాయ నిపుణుడిని సంప్రదించండి."));
        String normalized = language == null ? "en" : language.toLowerCase();
        String localized = normalized.startsWith("hi") ? a.hindi() : normalized.startsWith("te") ? a.telugu() : a.english();
        return new Advisory(a.title(), localized, a.hindi(), a.telugu());
    }

    public record Advisory(String title, String english, String hindi, String telugu) {}
}
