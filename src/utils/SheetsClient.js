const SHEETS_URL = "SHEETS_WEB_APP_URL"; // Placeholder

export const fetchTasks = async () => {
    try {
        const response = await fetch(SHEETS_URL);
        if (!response.ok) throw new Error("Sheets Fetch Error");
        return await response.json();
    } catch (error) {
        console.error("Fetch Tasks Error:", error);
        return [];
    }
};

export const saveTask = async (taskData) => {
    try {
        // action: 'add'
        const response = await fetch(SHEETS_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "add",
                ...taskData
            })
        });
        // no-cors doesn't give response content, so we assume success if no error
        return true;
    } catch (error) {
        console.error("Save Task Error:", error);
        return false;
    }
};

export const updateTask = async (rowIndex, updateData) => {
    try {
        const response = await fetch(SHEETS_URL, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "update",
                rowIndex,
                ...updateData
            })
        });
        return true;
    } catch (error) {
        console.error("Update Task Error:", error);
        return false;
    }
};
