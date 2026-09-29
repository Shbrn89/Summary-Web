const CONFIG = {
    endpoints: {
        backend: "https://kurrooyuki-web-summarizer-api.hf.space/api/summarize",
        tfidf: "https://kurrooyuki-tfidf-text-summarize.hf.space/run/ringkas_tfidf" 
    }
};

// Variabel DOM Murni (Hanya yang dipakai)
const inputType = document.getElementById("inputType");
const textInputGroup = document.getElementById("textInputGroup");
const fileInputGroup = document.getElementById("fileInputGroup");
const method = document.getElementById("method");
const methodNote = document.getElementById("methodNote");
const summarizeButton = document.getElementById("summarizeButton");
const downloadButton = document.getElementById("downloadButton");
const loading = document.getElementById("loading");
const warningBox = document.getElementById("warningBox");
const summaryOutput = document.getElementById("summaryOutput");
const originalWordCount = document.getElementById("originalWordCount");
const summaryWordCount = document.getElementById("summaryWordCount");
const detectedLanguage = document.getElementById("detectedLanguage");
const usedModel = document.getElementById("usedModel");
const navButtons = document.querySelectorAll(".nav-button");
const heroButtons = document.querySelectorAll(".hero-button");

// Navigasi & Animasi
function scrollToSection(targetId) {
    const target = document.getElementById(targetId);
    if (target) {
        target.scrollIntoView({ behavior: "smooth" });
    }
}

navButtons.forEach(button => button.addEventListener("click", () => scrollToSection(button.dataset.target)));
heroButtons.forEach(button => button.addEventListener("click", () => scrollToSection(button.dataset.target)));

// Tampilan Tipe Input
inputType.addEventListener("change", function () {
    if (inputType.value === "text") {
        textInputGroup.classList.remove("hidden");
        fileInputGroup.classList.add("hidden");
    } else {
        textInputGroup.classList.add("hidden");
        fileInputGroup.classList.remove("hidden");
    }
});

// Catatan Metode
method.addEventListener("change", function () {
    if (method.value === "tfidf") methodNote.textContent = "TF-IDF is the extractive baseline used to compare Transformer model performance.";
    else if (method.value === "bart") methodNote.textContent = "BART is the main trained model used for abstractive summarization.";
    else if (method.value === "t5") methodNote.textContent = "T5 is a trained text-to-text Transformer comparison model.";
    else if (method.value === "led") methodNote.textContent = "LED is designed for long documents but may require more memory and processing time.";
});

// Helper: Menghitung Kata
function countWords(str) {
    return str.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Main Fuction: Summarize
summarizeButton.addEventListener("click", async function () {
    let inputText = "";
    
    // 1. Ambil Teks
    if (inputType.value === "text") {
        inputText = document.getElementById("textInput").value.trim();
    } else {
        alert("Warning: The File Upload mode is currently unavailable because the server uses a pure decoupled architecture. Please use the ‘Paste Text’ mode.");
        return;
    }

    if (!inputText) {
        alert("Please enter the document text first!");
        return;
    }

    const selectedModel = method.value; 
    
    // 2. Persiapan UI
    loading.classList.remove("hidden");
    loading.textContent = "Sending documents to the cloud server... (If this is your first time, it may take 1–2 minutes for the server to start up).";
    warningBox.classList.add("hidden");
    summaryOutput.value = "";
    
    originalWordCount.textContent = countWords(inputText);
    summaryWordCount.textContent = "0";
    detectedLanguage.textContent = "English";
    usedModel.textContent = selectedModel.toUpperCase();

    summarizeButton.disabled = true;
    summarizeButton.textContent = "Processing Cloud Inference...";

    try {
        let finalSummary = "";

        // 3A. Jalur Model TF-IDF (Gradio)
        if (selectedModel === "tfidf") {
            try {
                const { Client } = await import("https://cdn.jsdelivr.net/npm/@gradio/client/dist/index.min.js");
                const app = await Client.connect("kUrrooYuki/tfidf-text-summarize");
                const result = await app.predict("/ringkas_tfidf", { 
                    teks: inputText 
                });
                
                if (result && result.data && result.data[0]) {
                    finalSummary = result.data[0];
                } else {
                    throw new Error("The Gradio response format is incorrect.");
                }
            } catch (gradioErr) {
                throw new Error("Failed to contact the TF-IDF server. The server might be sleeping (Cold Start), please try again in a few seconds. Details: " + gradioErr.message);
            }
        
        // 3B. Jalur 3 Model Transformer (Backend Custom FastAPI)
        } else {
            const response = await fetch(CONFIG.endpoints.backend, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ 
                    text: inputText, 
                    model_type: selectedModel 
                })
            });
            
            const textResponse = await response.text();
            let resJson;
            
            try {
                resJson = JSON.parse(textResponse);
            } catch (parseError) {
                if (response.status === 503 || response.status === 504) {
                    throw new Error("The Hugging Face server is waking up from sleep (Cold Start). Please wait 1 minute and try again.");
                }
                console.error("Unexpected response from server:", textResponse);
                throw new Error(`Server returned an invalid format (Status: ${response.status}). Check the console log.`);
            }
            
            if (!response.ok) {
                throw new Error(resJson.detail || "Failed to process document in backend API.");
            }
            
            if (resJson.status === "success" && resJson.summary !== undefined) {
                finalSummary = resJson.summary;
                
                if (finalSummary.trim() === "") {
                    throw new Error("The model runs successfully, but produces an empty summary.");
                }
            } else {
                throw new Error("The server response is incorrect: " + JSON.stringify(resJson));
            }
        }

        // 4. Sukses: Tampilkan Hasil
        loading.classList.add("hidden");
        summaryOutput.value = finalSummary;
        summaryWordCount.textContent = countWords(finalSummary);

    } catch (error) {
        loading.classList.add("hidden");
        warningBox.classList.remove("hidden");
        warningBox.textContent = "Pesan Sistem: " + error.message;
        console.error("Error Detail:", error);
    } finally {
        summarizeButton.disabled = false;
        summarizeButton.textContent = "Generate Summary";
    }
});

// Download Button
downloadButton.addEventListener("click", function () {
    const summary = summaryOutput.value;
    if (!summary) {
        alert("No summary available to download.");
        return;
    }
    const blob = new Blob([summary], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "summarly_legal_summary.txt";
    link.click();
});
