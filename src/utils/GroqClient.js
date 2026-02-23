const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

const MODELS = {
    primary_vision: "llama-3.2-90b-vision-preview",
    fallback_vision: "llama-3.2-11b-vision-preview",
    text_chat: "llama-3.3-70b-versatile"
};

export const chatWithGroq = async (messages, model = MODELS.text_chat) => {
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        if (!response.ok) throw new Error("Groq API error");
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Groq Chat Error:", error);
        throw error;
    }
};

export const extractTextFromFile = async (dataUrl, onProgress) => {
    // Check if it's a PDF (very basic check)
    if (dataUrl.startsWith("data:application/pdf")) {
        onProgress("⚠️ PDF format trenutno nije podržan za automatsko čitanje.");
        throw new Error("PDF_NOT_SUPPORTED");
    }

    // Level 1: Primary Vision Model
    onProgress("🔍 Analiziram sliku...");
    try {
        const res = await visionRequest(dataUrl, MODELS.primary_vision);
        return res;
    } catch (e) {
        console.warn("Level 1 failed, trying Level 2...", e);

        // Level 2: Fallback Vision Model
        onProgress("🔄 Pokušavam ponovo sa drugim modelom...");
        try {
            const res = await visionRequest(dataUrl, MODELS.fallback_vision);
            return res;
        } catch (e2) {
            console.error("Level 2 failed", e2);
            // Level 3 is manual mode handled in UI
            throw new Error("VISION_FAILED");
        }
    }
};

const visionRequest = async (dataUrl, model) => {
    console.log(`Sending Vision request to model: ${model}`);
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Ti si ekspert za OCR i matematiku. Pažljivo pročitaj SVE matematičke zadatke sa ove slike. " +
                                "Prepiši ih tačno onako kako pišu, reč po reč. " +
                                "Ako ima više zadataka, obavezno ih odvoj sa 'ZADATAK [broj]:'. " +
                                "Ako je slika mutna, daj sve od sebe da prepoznaš bar delove teksta."
                        },
                        { type: "image_url", image_url: { url: dataUrl } }
                    ]
                }
            ],
            temperature: 0,
            max_tokens: 2048
        })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("Vision Request API Error:", {
            status: response.status,
            statusText: response.statusText,
            error: errData
        });
        throw new Error(`Vision Request Failed: ${response.status}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
};
