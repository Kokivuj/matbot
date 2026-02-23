const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

if (!GROQ_API_KEY) {
    console.warn("VITE_GROQ_API_KEY nije pronađen u environment varijablama!");
}

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
    // Level 1: Primary Vision Model
    onProgress("🔍 Analiziram sliku (model 1)...");
    try {
        const res = await visionRequest(dataUrl, MODELS.primary_vision);
        return res;
    } catch (e) {
        console.warn("Level 1 failed, trying Level 2...");

        // Level 2: Fallback Vision Model
        onProgress("🔄 Prelazim na rezervni model...");
        try {
            const res = await visionRequest(dataUrl, MODELS.fallback_vision);
            return res;
        } catch (e2) {
            console.error("Level 2 failed");
            // Level 3 is manual mode handled in UI
            throw new Error("VISION_FAILED");
        }
    }
};

const visionRequest = async (dataUrl, model) => {
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
                        { type: "text", text: "Prepiši sav tekst sa ove slike/PDF-a koji se odnosi na matematičke zadatke. Ako ima više zadataka, odvoj ih sa 'ZADATAK [broj]:'." },
                        { type: "image_url", image_url: { url: dataUrl } }
                    ]
                }
            ]
        })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("Vision Request Error:", errData);
        throw new Error("Vision Request Failed");
    }
    const data = await response.json();
    return data.choices[0].message.content;
};
