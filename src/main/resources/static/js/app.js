
const API = '/api';

const input = document.getElementById('imageInput');
const browse = document.getElementById('browseBtn');
const zone = document.getElementById('dropZone');
const preview = document.getElementById('preview');
const previewWrap = document.getElementById('previewWrap');
const prompt = document.getElementById('uploadPrompt');
const analyze = document.getElementById('analyzeBtn');
const resultPanel = document.getElementById('resultPanel');
const language = document.getElementById('language');

let selectedFile = null;
let lastSpokenText = '';
let activeRecognition = null;
let isListening = false;

// --------------------------------------------------
// BACKEND HEALTH CHECK
// --------------------------------------------------

async function checkHealth() {
    const label = document.getElementById('apiStatus');

    try {
        const response = await fetch(`${API}/health`);
        const data = await response.json();

        label.textContent = data.modelReady
            ? 'AI model ready'
            : 'Model setup needed';

    } catch {
        label.textContent = 'Backend offline';
    }
}

checkHealth();

// --------------------------------------------------
// IMAGE UPLOAD
// --------------------------------------------------

browse.addEventListener('click', () => input.click());

zone.addEventListener('click', event => {
    if (!event.target.closest('button')) {
        input.click();
    }
});

input.addEventListener('change', () => {
    setFile(input.files[0]);
});

document.getElementById('removeImage').addEventListener('click', event => {
    event.stopPropagation();

    selectedFile = null;
    input.value = '';

    previewWrap.classList.add('hidden');
    prompt.classList.remove('hidden');
    analyze.disabled = true;

    preview.removeAttribute('src');
});

['dragenter', 'dragover'].forEach(eventName => {
    zone.addEventListener(eventName, event => {
        event.preventDefault();
        zone.classList.add('drag');
    });
});

['dragleave', 'drop'].forEach(eventName => {
    zone.addEventListener(eventName, event => {
        event.preventDefault();
        zone.classList.remove('drag');
    });
});

zone.addEventListener('drop', event => {
    setFile(event.dataTransfer.files[0]);
});

function setFile(file) {
    if (!file) return;

    // JPEG and PNG are supported by the Java image processing flow.
    if (!['image/jpeg', 'image/png'].includes(file.type) ||
        file.size > 8 * 1024 * 1024) {

        showMessage(
            'Please choose a JPG or PNG image smaller than 8 MB.'
        );

        return;
    }

    selectedFile = file;

    preview.src = URL.createObjectURL(file);

    prompt.classList.add('hidden');
    previewWrap.classList.remove('hidden');
    analyze.disabled = false;
}

// --------------------------------------------------
// LEAF ANALYSIS
// --------------------------------------------------

analyze.addEventListener('click', async () => {
    if (!selectedFile) return;

    analyze.disabled = true;
    analyze.querySelector('span').textContent = 'Analyzing…';

    resultPanel.innerHTML = `
        <div class="result-empty">
            <div class="empty-orbit">⌁</div>
            <h3>Reading your leaf…</h3>
            <p>Checking image quality and supported crop classes.</p>
        </div>
    `;

    const form = new FormData();

    form.append('image', selectedFile);
    form.append('language', language.value);

    try {
        const response = await fetch(`${API}/diagnose`, {
            method: 'POST',
            body: form
        });

        const data = await response.json();

        if (!response.ok && !data.status) {
            throw new Error('Diagnosis request failed.');
        }

        renderResult(data);

    } catch (error) {
        showMessage(
            'Could not connect to the Java backend. Make sure Spring Boot is running on port 8080.'
        );

    } finally {
        analyze.disabled = false;
        analyze.querySelector('span').textContent = 'Analyze leaf';
    }
});

// --------------------------------------------------
// DISPLAY DIAGNOSIS RESULT
// --------------------------------------------------

function renderResult(data) {

    if (data.status === 'MODEL_NOT_READY') {

        resultPanel.innerHTML = `
            <div class="result-empty">
                <div class="empty-orbit">⚙</div>
                <h3>AI model setup required</h3>
                <p>${escapeHtml(data.message)}</p>
            </div>
        `;

        lastSpokenText = data.message || '';
        return;
    }

    if (data.status !== 'SUCCESS') {

        resultPanel.innerHTML = `
            <div class="result-empty">
                <div class="empty-orbit">!</div>
                <h3>${escapeHtml(statusTitle(data.status))}</h3>
                <p>${escapeHtml(data.message)}</p>
                <div class="empty-tags">
                    <span>NO UNSAFE GUESS</span>
                    <span>TRY AGAIN</span>
                </div>
            </div>
        `;

        lastSpokenText = data.message || '';
        speak(lastSpokenText);

        return;
    }

    const percentage = Math.round(data.confidence * 100);
    const advice = data.advisory;

    const guidance = advice
        ? (
            language.value === 'hi'
                ? advice.hindi
                : language.value === 'te'
                    ? advice.telugu
                    : advice.english
        )
        : 'No reviewed guidance is available for this class yet. Please contact an agricultural expert.';

    const safeGuidance = guidance || '';

    resultPanel.innerHTML = `
        <div class="report">

            <div class="report-head">
                <span class="report-label">
                    CROPCARE SCREENING REPORT
                </span>

                <span class="confidence">
                    ${percentage}%
                </span>
            </div>

            <div class="meter">
                <span style="width:${Math.min(100, percentage)}%"></span>
            </div>

            <p>
                ${escapeHtml(data.crop || 'Supported crop')}
                · Model confidence
            </p>

            <h3>
                ${escapeHtml(advice?.title || data.disease || 'Likely result')}
            </h3>

            <p>${escapeHtml(data.message)}</p>

            <div class="advice">
                <h4>✧ Suggested first steps</h4>
                <p>${escapeHtml(safeGuidance)}</p>
            </div>

            <p>
                <b>Important:</b>
                This is an AI screening result, not a confirmed diagnosis.
                Do not choose or apply pesticides based only on this result.
                Contact your local KVK for confirmation.
            </p>

            <button class="outline-button" id="speakResult">
                🔊 Listen to report
            </button>

        </div>
    `;

    // Construct speech using the selected language.
    const spokenParts = [];

    if (language.value === 'hi') {
        spokenParts.push('आपकी फसल की जाँच पूरी हो गई है।');
    } else if (language.value === 'te') {
        spokenParts.push('మీ పంట పరిశీలన పూర్తయింది.');
    } else {
        spokenParts.push('Your crop analysis is complete.');
    }

    // Avoid speaking an English advisory title in Hindi or Telugu.
    if (language.value === 'en') {
        spokenParts.push(advice?.title || data.disease || '');
    }

    spokenParts.push(data.message || '');
    spokenParts.push(safeGuidance);

    if (language.value === 'hi') {
        spokenParts.push(
            'यह केवल एक प्रारंभिक जाँच है। कृपया पुष्टि के लिए कृषि विशेषज्ञ से संपर्क करें।'
        );
    } else if (language.value === 'te') {
        spokenParts.push(
            'ఇది ప్రాథమిక పరిశీలన మాత్రమే. నిర్ధారణ కోసం వ్యవసాయ నిపుణుడిని సంప్రదించండి.'
        );
    } else {
        spokenParts.push(
            'This is only a preliminary screening. Please contact an agricultural expert for confirmation.'
        );
    }

    lastSpokenText = spokenParts.filter(Boolean).join('. ');

    document.getElementById('speakResult')
        .addEventListener('click', () => {
            speak(lastSpokenText);
        });
}

// --------------------------------------------------
// ERROR MESSAGES
// --------------------------------------------------

function statusTitle(status) {
    return ({
        UNCERTAIN: 'We are not confident enough',
        UNCLEAR_IMAGE: 'Photo needs a retake',
        UNSUPPORTED_CROP: 'Crop not supported',
        INVALID_IMAGE: 'Image not accepted',
        ERROR: 'Scan could not be completed'
    })[status] || 'Unable to identify';
}

function showMessage(message) {
    resultPanel.innerHTML = `
        <div class="result-empty">
            <div class="empty-orbit">!</div>
            <h3>Something needs attention</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

// --------------------------------------------------
// VOICE ASSISTANT
// --------------------------------------------------

const voiceBtn = document.getElementById('voiceBtn');
const voiceTitle = document.getElementById('voiceTitle');
const voiceHint = document.getElementById('voiceHint');
const wave = document.querySelector('.wave');

function localeCode() {
    return ({
        en: 'en-IN',
        hi: 'hi-IN',
        te: 'te-IN'
    })[language.value] || 'en-IN';
}

// --------------------------------------------------
// SELECT BEST AVAILABLE BROWSER VOICE
// --------------------------------------------------

function getBestVoice() {
    if (!('speechSynthesis' in window)) {
        return null;
    }

    const voices = speechSynthesis.getVoices();
    const selectedLocale = localeCode().toLowerCase();

    // First preference: exact language and region.
    let voice = voices.find(item =>
        item.lang.toLowerCase() === selectedLocale
    );

    // Second preference: matching language.
    if (!voice) {
        const languageCode = selectedLocale.split('-')[0];

        voice = voices.find(item =>
            item.lang.toLowerCase().startsWith(languageCode)
        );
    }

    return voice || null;
}

// Browser voices can load asynchronously.
if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => {
        getBestVoice();
    };
}

// --------------------------------------------------
// SPEAK TEXT
// --------------------------------------------------

function speak(text) {
    if (!text || !text.trim()) {
        voiceHint.textContent = 'There is no report to read yet.';
        return;
    }

    if (!('speechSynthesis' in window)) {
        voiceHint.textContent =
            'Speech output is not supported in this browser.';
        return;
    }

    // Stop any previous speech.
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = localeCode();
    utterance.rate = language.value === 'en' ? 0.92 : 0.85;
    utterance.pitch = 1;
    utterance.volume = 1;

    const selectedVoice = getBestVoice();

    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
        voiceTitle.textContent = 'Speaking…';
        voiceHint.textContent = 'CropCare is reading your report';
        wave.classList.add('active');
    };

    utterance.onend = () => {
        voiceTitle.textContent = 'Talk to CropCare';
        voiceHint.textContent = 'Tap the microphone to speak';
        wave.classList.remove('active');
    };

    utterance.onerror = () => {
        voiceTitle.textContent = 'Talk to CropCare';
        voiceHint.textContent = 'Could not play the voice. Try again.';
        wave.classList.remove('active');
    };

    speechSynthesis.speak(utterance);
}

// --------------------------------------------------
// VOICE COMMANDS
// --------------------------------------------------

function processVoiceCommand(spokenText) {
    const text = spokenText.toLowerCase().trim();

    voiceTitle.textContent = 'You said';
    voiceHint.textContent = spokenText;

    const scanCommands = [
        'scan',
        'photo',
        'upload',
        'take a picture',
        'check my leaf',
        'check the leaf',
        'स्कैन',
        'फोटो',
        'तस्वीर',
        'जांच',
        'जाँच',
        'స్కాన్',
        'ఫోటో',
        'ఆకు',
        'పంట'
    ];

    const reportCommands = [
        'report',
        'read report',
        'listen',
        'repeat',
        'result',
        'रिपोर्ट',
        'सुनाओ',
        'दोबारा',
        'परिणाम',
        'రిపోర్ట్',
        'చదువు',
        'వినిపించు',
        'ఫలితం'
    ];

    const wantsScan = scanCommands.some(command =>
        text.includes(command)
    );

    const wantsReport = reportCommands.some(command =>
        text.includes(command)
    );

    if (wantsScan) {
        document.getElementById('scanner')
            .scrollIntoView({ behavior: 'smooth' });

        speak(
            language.value === 'hi'
                ? 'कृपया अपनी फसल की पत्ती की साफ़ तस्वीर अपलोड करें।'
                : language.value === 'te'
                    ? 'దయచేసి మీ పంట ఆకుకు స్పష్టమైన ఫోటోను అప్‌లోడ్ చేయండి.'
                    : 'Please upload a clear photograph of your crop leaf.'
        );

        return;
    }

    if (wantsReport) {
        if (lastSpokenText) {
            speak(lastSpokenText);
        } else {
            speak(
                language.value === 'hi'
                    ? 'अभी कोई रिपोर्ट उपलब्ध नहीं है। पहले पत्ती की तस्वीर अपलोड करें।'
                    : language.value === 'te'
                        ? 'ప్రస్తుతం నివేదిక అందుబాటులో లేదు. ముందుగా ఆకు ఫోటోను అప్‌లోడ్ చేయండి.'
                        : 'There is no report yet. Please upload a leaf photograph first.'
            );
        }

        return;
    }

    // Default response for an unsupported or unclear command.
    speak(
        language.value === 'hi'
            ? 'मैं आपकी फसल की जाँच करने और रिपोर्ट पढ़ने में मदद कर सकता हूँ। कृपया पहले पत्ती की तस्वीर अपलोड करें।'
            : language.value === 'te'
                ? 'మీ పంటను పరిశీలించి నివేదిక చదవడంలో నేను సహాయపడగలను. ముందుగా ఆకు ఫోటోను అప్‌లోడ్ చేయండి.'
                : 'I can help scan your crop leaf and read the diagnosis report. Please upload a leaf photograph first.'
    );
}

// --------------------------------------------------
// START AND STOP MICROPHONE
// --------------------------------------------------

function stopListening() {
    if (activeRecognition) {
        activeRecognition.stop();
    }

    isListening = false;
    voiceBtn.classList.remove('listening');
    wave.classList.remove('active');
}

voiceBtn.addEventListener('click', () => {

    // Clicking again stops the microphone.
    if (isListening) {
        stopListening();
        voiceTitle.textContent = 'Talk to CropCare';
        voiceHint.textContent = 'Microphone stopped';
        return;
    }

    const Recognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!Recognition) {
        voiceTitle.textContent = 'Voice unavailable';
        voiceHint.textContent =
            'Try Chrome or another browser that supports speech recognition.';
        return;
    }

    if (!navigator.onLine) {
        voiceHint.textContent =
            'Check your internet connection and try again.';
        return;
    }

    // Stop any currently playing speech.
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
    }

    const recognition = new Recognition();

    activeRecognition = recognition;

    recognition.lang = localeCode();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    isListening = true;

    voiceTitle.textContent = 'Listening…';
    voiceHint.textContent = 'Speak now';
    voiceBtn.classList.add('listening');
    wave.classList.add('active');

    recognition.onresult = event => {
        const spokenText =
            event.results[0][0].transcript;

        processVoiceCommand(spokenText);
    };

    recognition.onerror = event => {
        voiceTitle.textContent = 'Talk to CropCare';

        const messages = {
            'not-allowed': 'Allow microphone access in your browser.',
            'no-speech': 'No speech detected. Please try again.',
            'audio-capture': 'No microphone was detected.',
            'network': 'Speech recognition network error. Try again.',
            'language-not-supported': 'This language is not supported by your browser.'
        };

        voiceHint.textContent =
            messages[event.error] ||
            'Could not hear clearly. Please try again.';

        isListening = false;
        voiceBtn.classList.remove('listening');
        wave.classList.remove('active');
    };

    recognition.onend = () => {
        isListening = false;
        activeRecognition = null;

        voiceBtn.classList.remove('listening');
        wave.classList.remove('active');

        if (voiceTitle.textContent === 'Listening…') {
            voiceTitle.textContent = 'Talk to CropCare';
            voiceHint.textContent = 'Tap the microphone to speak';
        }
    };

    try {
        recognition.start();
    } catch (error) {
        isListening = false;
        activeRecognition = null;

        voiceBtn.classList.remove('listening');
        wave.classList.remove('active');

        voiceTitle.textContent = 'Talk to CropCare';
        voiceHint.textContent = 'Could not start the microphone. Try again.';
    }
});

// --------------------------------------------------
// LANGUAGE CHANGE
// --------------------------------------------------

language.addEventListener('change', () => {

    if (activeRecognition) {
        stopListening();
    }

    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
    }

    voiceTitle.textContent = 'Talk to CropCare';

    voiceHint.textContent = ({
        en: 'Language set to English',
        hi: 'भाषा हिंदी में बदल दी गई है',
        te: 'భాష తెలుగులోకి మార్చబడింది'
    })[language.value] || 'Language updated';

});
