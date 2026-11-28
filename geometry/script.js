const diagramDescriptionInput = document.getElementById("diagram-description");
const questionInput = document.getElementById("question");
const imageInput = document.getElementById("problem-image");
const imagePreview = document.getElementById("image-preview");
const imageActions = document.getElementById("image-actions");
const imageStatus = document.getElementById("image-status");
const diagramImage = document.getElementById("diagram-image");
const diagramCaption = document.getElementById("diagram-caption");
const answerHeading = document.getElementById("answer-heading");
const answerMessage = document.getElementById("answer-message");
const interpretation = document.getElementById("interpretation");
const interpretationItems = document.getElementById("interpretation-items");
const explanation = document.getElementById("explanation");
const answerSteps = document.getElementById("answer-steps");
const confirmButton = document.getElementById("confirm-interpretation");
const solveButton = document.getElementById("solve");
const nextStepButton = document.getElementById("next-step");
const diagramSaveStatus = document.getElementById("diagram-save-status");

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
let imageUrl = "";
let selectedImageFile = null;
let pendingResult = null;
let visibleStepCount = 0;

function showMessage(heading, message) {
    answerHeading.textContent = heading;
    answerMessage.textContent = message;
    explanation.hidden = true;
    nextStepButton.hidden = true;
    answerSteps.replaceChildren();
    visibleStepCount = 0;
}

function invalidateAnalysis() {
    pendingResult = null;
    confirmButton.hidden = true;
    interpretation.hidden = true;
    diagramImage.hidden = true;
    diagramImage.removeAttribute("src");
    diagramCaption.textContent = "Analyze the updated inputs to redraw the diagram.";
    diagramSaveStatus.textContent = "";
    showMessage(
        "Input changed",
        "Analyze the updated diagram description and question to check the interpretation.",
    );
}

function displayInterpretation(result) {
    interpretationItems.replaceChildren(
        ...result.interpretation_items.map((description) => {
            const item = document.createElement("li");
            item.textContent = description;
            return item;
        }),
    );
    interpretation.hidden = false;
}

function insertSymbol(button) {
    const target = document.getElementById(button.dataset.target);
    if (!(target instanceof HTMLTextAreaElement)) return;

    const start = target.selectionStart;
    const end = target.selectionEnd;
    target.setRangeText(button.dataset.symbol, start, end, "end");
    target.focus();
    target.dispatchEvent(new Event("input", { bubbles: true }));
}

function appendRecognizedText(text) {
    const extracted = text.trim();
    if (!extracted) return;
    const normalize = (value) => value.toLowerCase().replace(/\s+/g, " ").trim();
    if (normalize(questionInput.value).includes(normalize(extracted))) return;
    questionInput.value = questionInput.value.trim()
        ? `${questionInput.value.trim()}\n${extracted}`
        : extracted;
}

async function analyzeCurrentQuestion() {
    if (
        !diagramDescriptionInput.value.trim()
        && !questionInput.value.trim()
        && !selectedImageFile
    ) {
        showMessage(
            "Add a diagram or question",
            "Describe the shapes, enter the math question, or choose a picture.",
        );
        return;
    }

    pendingResult = null;
    confirmButton.hidden = true;
    interpretation.hidden = true;
    explanation.hidden = true;
    diagramSaveStatus.textContent = "";
    diagramImage.hidden = true;
    diagramImage.removeAttribute("src");
    diagramCaption.textContent = "Python is generating the diagram…";
    solveButton.disabled = true;
    imageStatus.textContent = selectedImageFile
        ? "Sending the picture to the Python solver on this Render service…"
        : "";
    showMessage(
        "Working it out",
        "Python is checking the question, reading any picture, and drawing a diagram.",
    );

    const formData = new FormData();
    formData.set("diagram_description", diagramDescriptionInput.value.trim());
    formData.set("question", questionInput.value.trim());
    if (selectedImageFile) formData.set("image", selectedImageFile);

    try {
        const response = await fetch("/geometry/analyze", {
            method: "POST",
            body: formData,
        });
        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error(
                "The Python service returned an unreadable response. Check the Render service logs.",
            );
        }
        if (!response.ok) {
            throw new Error(result.error || `The Python service returned ${response.status}.`);
        }
        if (
            !result
            || !Array.isArray(result.interpretation_items)
            || !Array.isArray(result.steps)
            || typeof result.diagram_svg !== "string"
        ) {
            throw new Error("The Python service returned an incomplete geometry result.");
        }

        pendingResult = result;
        appendRecognizedText(result.ocr_text || "");
        diagramImage.src = `data:image/svg+xml;base64,${result.diagram_svg}`;
        diagramImage.alt = result.diagram_caption || "Generated geometry diagram";
        diagramImage.hidden = false;
        diagramCaption.textContent = result.diagram_caption || "Diagram generated by Python.";
        displayInterpretation(result);

        if (result.ocr_text) {
            imageStatus.textContent =
                "Printed text was read by Python and added to the question. Check the detected shapes and measurements.";
        } else if (selectedImageFile) {
            imageStatus.textContent =
                "Python checked the photo for common shapes. Confirm its suggestions below.";
        }

        if (!result.ready) {
            showMessage("More information needed", result.issue || "Add a clear target and measurements.");
            return;
        }

        answerHeading.textContent = "Check my interpretation";
        answerMessage.textContent =
            "Review the shapes, target, measurements, and diagram. Confirm only if they match the question.";
        confirmButton.hidden = false;
    } catch (error) {
        pendingResult = null;
        const message = error instanceof Error
            ? error.message
            : "The Python service could not analyze this question.";
        showMessage("Python solver unavailable", message);
        if (selectedImageFile) imageStatus.textContent = message;
    } finally {
        solveButton.disabled = false;
    }
}

function revealSolution() {
    if (!pendingResult || !pendingResult.ready || !pendingResult.steps.length) return;
    confirmButton.hidden = true;
    visibleStepCount = 0;
    answerHeading.textContent = "Let's work it out";
    answerMessage.textContent =
        "Read each step in order. The conclusion, including the result, is revealed last.";
    explanation.hidden = false;
    answerSteps.replaceChildren(
        ...pendingResult.steps.map((step, index) => {
            const item = document.createElement("li");
            item.textContent = step;
            item.hidden = index > 0;
            if (index === pendingResult.steps.length - 1) {
                item.className = "conclusion-step";
                item.hidden = true;
            }
            return item;
        }),
    );
    visibleStepCount = 1;
    nextStepButton.hidden = false;
    nextStepButton.disabled = false;
    nextStepButton.textContent =
        pendingResult.steps.length > 1 ? "Show next step" : "Show conclusion";
}

function revealNextStep() {
    if (!pendingResult || visibleStepCount >= pendingResult.steps.length) return;
    answerSteps.children[visibleStepCount].hidden = false;
    visibleStepCount += 1;
    if (visibleStepCount >= pendingResult.steps.length) {
        nextStepButton.textContent = "Explanation complete";
        nextStepButton.disabled = true;
    } else {
        nextStepButton.textContent = "Show next step";
    }
}

function saveDiagram() {
    if (!pendingResult || !pendingResult.diagram_svg) {
        diagramSaveStatus.textContent = "Analyze a question before saving its diagram.";
        return;
    }
    const binary = atob(pendingResult.diagram_svg);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const blob = new Blob([bytes], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const download = document.createElement("a");
    download.href = url;
    download.download = "geometry-diagram.svg";
    document.body.append(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    diagramSaveStatus.textContent = "Diagram saved as an SVG image.";
}

imageInput.addEventListener("change", () => {
    const file = imageInput.files && imageInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        imageStatus.textContent = "Choose an image file to continue.";
        imageInput.value = "";
        return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
        imageStatus.textContent = "Choose an image smaller than 20 MB.";
        imageInput.value = "";
        return;
    }

    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);
    selectedImageFile = file;
    imagePreview.src = imageUrl;
    imagePreview.hidden = false;
    imageActions.hidden = false;
    imageInput.value = "";
    imageStatus.textContent =
        "Picture ready. Analyze to have Python read the text and check for common shapes.";
    invalidateAnalysis();
});

document.getElementById("choose-image").addEventListener("click", () => {
    imageInput.click();
});
solveButton.addEventListener("click", analyzeCurrentQuestion);
confirmButton.addEventListener("click", revealSolution);
nextStepButton.addEventListener("click", revealNextStep);
document.getElementById("save-diagram").addEventListener("click", saveDiagram);
document.querySelectorAll(".symbol-button").forEach((button) => {
    button.addEventListener("click", () => insertSymbol(button));
});
diagramDescriptionInput.addEventListener("input", invalidateAnalysis);
questionInput.addEventListener("input", invalidateAnalysis);

const handleQuestionShortcut = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        analyzeCurrentQuestion();
    }
};
diagramDescriptionInput.addEventListener("keydown", handleQuestionShortcut);
questionInput.addEventListener("keydown", handleQuestionShortcut);
