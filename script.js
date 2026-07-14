// Supabase Setup
const SUPABASE_URL = "https://hcipkkfyopuslgtzmifa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6qyKoD86F29kvGivX7QzRg_5hPgX9xD";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Global State
let currentReceiveSessionCode = "";
let currentReceiveSessionExpiry = null;
let expiryInterval = null;
let currentUploadedFiles = [];
// Page Elements
const homePage = document.getElementById("homePage");
const receivePage = document.getElementById("receivePage");
const uploadPage = document.getElementById("uploadPage");

const receiveBtn = document.getElementById("receiveBtn");
const uploadToReceiverBtn = document.getElementById("uploadToReceiverBtn");
// Receive Page Elements
const createReceiveSessionBtn = document.getElementById("createReceiveSessionBtn");
const receiveCode = document.getElementById("receiveCode");
const receiveExpiryDisplay = document.getElementById("receiveExpiryDisplay");
const receiveQRCode = document.getElementById("receiveQRCode");
const receiveStatus = document.getElementById("receiveStatus");
const checkReceiveSessionBtn = document.getElementById("checkReceiveSessionBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const receiveMessageSection = document.getElementById("receiveMessageSection");
const receiveDownloadSection = document.getElementById("receiveDownloadSection");
// Upload Page Elements
const uploadSessionCodeInput = document.getElementById("uploadSessionCodeInput");
const uploadMessageInput = document.getElementById("uploadMessageInput");
const uploadFileInput = document.getElementById("uploadFileInput");
const uploadToSessionBtn = document.getElementById("uploadToSessionBtn");
const uploadStatus = document.getElementById("uploadStatus");
// Page Switching
function hideAllPages() {
    homePage.style.display = "none";
    receivePage.style.display = "none";
    uploadPage.style.display = "none";
}

function showHomePage() {
    hideAllPages();
    homePage.style.display = "block";
}

function showReceivePage() {
    hideAllPages();
    receivePage.style.display = "block";
}

function showUploadPage() {
    hideAllPages();
    uploadPage.style.display = "block";
}
// Button Events
receiveBtn.addEventListener("click", showReceivePage);
uploadToReceiverBtn.addEventListener("click", showUploadPage);

const backHomeBtns = document.querySelectorAll(".backHomeBtn");

backHomeBtns.forEach(function (button) {
    button.addEventListener("click", showHomePage);
});
// Helper Functions
function generateTransferCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function isImageFile(fileName) {
    const lowerName = fileName.toLowerCase();

    return (
        lowerName.endsWith(".png") ||
        lowerName.endsWith(".jpg") ||
        lowerName.endsWith(".jpeg") ||
        lowerName.endsWith(".gif") ||
        lowerName.endsWith(".webp")
    );
}

function formatTimeLeft(expiryDate) {
    const now = new Date();
    const timeLeftMs = expiryDate - now;

    if (timeLeftMs <= 0) {
        return "Expired";
    }

    const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));

    return hours + "h " + minutes + "m left";
}

function startExpiryCountdown(expiryDate) {
    currentReceiveSessionExpiry = expiryDate;

    if (expiryInterval !== null) {
        clearInterval(expiryInterval);
    }

    receiveExpiryDisplay.textContent =
        "Session expires in: " + formatTimeLeft(expiryDate);

    expiryInterval = setInterval(function () {
        const timeLeftText = formatTimeLeft(expiryDate);

        receiveExpiryDisplay.textContent =
            "Session expires in: " + timeLeftText;

        if (timeLeftText === "Expired") {
            clearInterval(expiryInterval);
            receiveStatus.textContent = "This receive session has expired.";
            checkReceiveSessionBtn.style.display = "none";
            downloadAllBtn.style.display = "none";
        }
    }, 60000);
}

async function downloadFileFromSignedUrl(signedUrl, fileName, statusElement) {
    const lowerFileName = fileName.toLowerCase();

    const isPdf = lowerFileName.endsWith(".pdf");
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isPdf && isMobile) {
        statusElement.textContent =
            "Opening PDF. Use your browser's share/download button to save it.";

        window.open(signedUrl, "_blank");
        return;
    }

    const response = await fetch(signedUrl);

    if (!response.ok) {
        statusElement.textContent = "Download failed.";
        return;
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const temporaryLink = document.createElement("a");
    temporaryLink.href = objectUrl;
    temporaryLink.download = fileName;

    document.body.appendChild(temporaryLink);
    temporaryLink.click();
    document.body.removeChild(temporaryLink);

    URL.revokeObjectURL(objectUrl);

    statusElement.textContent = "Download started.";
}

async function showImagePreview(file, previewElementId) {
    const previewElement = document.getElementById(previewElementId);

    if (!previewElement) {
        return;
    }

    previewElement.textContent = "Loading preview...";

    const signedUrlResult = await supabaseClient
        .storage
        .from("transfer-files")
        .createSignedUrl(file.file_path, 60);

    if (signedUrlResult.error) {
        previewElement.textContent = "Preview unavailable.";
        return;
    }

    previewElement.innerHTML = `
        <img
            src="${signedUrlResult.data.signedUrl}"
            alt="${file.file_name}"
            class="image-preview"
        >
    `;
}

function makeClickableText(text) {
    const escapedText = text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    const urlPattern = /(https?:\/\/[^\s]+)/g;

    return escapedText.replace(urlPattern, function (url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}
// Create Receive Session + QR + Expiry
createReceiveSessionBtn.addEventListener("click", createReceiveSession);

async function createReceiveSession() {
    receiveStatus.textContent = "Creating receive session...";
    receiveCode.textContent = "";
    receiveExpiryDisplay.textContent = "";
    receiveQRCode.innerHTML = "";
    receiveMessageSection.innerHTML = "";
    receiveMessageSection.style.display = "none";
    receiveDownloadSection.innerHTML = "";
    receiveDownloadSection.style.display = "none";
    checkReceiveSessionBtn.style.display = "none";
    downloadAllBtn.style.display = "none";
    currentUploadedFiles = [];

    if (expiryInterval !== null) {
        clearInterval(expiryInterval);
    }

    const receiveSessionCode = generateTransferCode();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const result = await supabaseClient
        .from("transfer_sessions")
        .insert({
            code: receiveSessionCode,
            status: "waiting",
            expires_at: expiresAt.toISOString()
        });

    if (result.error) {
        receiveStatus.textContent =
            "Could not create receive session: " + result.error.message;
        return;
    }

    currentReceiveSessionCode = receiveSessionCode;

    receiveCode.textContent = receiveSessionCode;

    startExpiryCountdown(expiresAt);

    const uploadUrl =
        window.location.origin +
        window.location.pathname +
        "?upload=" +
        receiveSessionCode;

    new QRCode(receiveQRCode, {
        text: uploadUrl,
        width: 180,
        height: 180
    });

    receiveStatus.textContent =
        "Waiting for sender to upload file(s), text, or links. Scan the QR code or enter the code manually.";

    checkReceiveSessionBtn.style.display = "block";
}
// Upload Files + Text/Links to Receiver Session
uploadToSessionBtn.addEventListener("click", uploadToReceiverSession);

async function uploadToReceiverSession() {
    const receiverCode = uploadSessionCodeInput.value.trim();
    const messageText = uploadMessageInput.value.trim();
    const files = uploadFileInput.files;

    if (receiverCode === "") {
        uploadStatus.textContent = "Please enter the receiver's session code.";
        return;
    }

    if (files.length === 0 && messageText === "") {
        uploadStatus.textContent = "Please choose at least one file or enter a message.";
        return;
    }

    const maxFileSize = 50 * 1024 * 1024;

    for (let i = 0; i < files.length; i++) {
        if (files[i].size > maxFileSize) {
            uploadStatus.textContent =
                files[i].name + " is too large. Maximum size is 50 MB.";
            return;
        }
    }

    uploadStatus.textContent = "Checking receiver session...";

    const sessionResult = await supabaseClient
        .from("transfer_sessions")
        .select("*")
        .eq("code", receiverCode)
        .single();

    if (sessionResult.error) {
        uploadStatus.textContent = "No receive session found for this code.";
        return;
    }

    const session = sessionResult.data;

    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    if (now > expiresAt) {
        uploadStatus.textContent = "This receive session has expired.";
        return;
    }

    if (messageText !== "") {
        uploadStatus.textContent = "Sending text/link...";

        const messageResult = await supabaseClient
            .from("transfer_session_messages")
            .insert({
                session_code: receiverCode,
                message_text: messageText
            });

        if (messageResult.error) {
            uploadStatus.textContent =
                "Could not send message: " + messageResult.error.message;
            return;
        }
    }

    if (files.length > 0) {
        uploadStatus.textContent = "Uploading " + files.length + " file(s)...";

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            const uniqueFilePath =
                "receive-uploads/" +
                receiverCode +
                "/" +
                Date.now() +
                "-" +
                i +
                "-" +
                file.name;

            const uploadResult = await supabaseClient
                .storage
                .from("transfer-files")
                .upload(uniqueFilePath, file);

            if (uploadResult.error) {
                uploadStatus.textContent =
                    "Upload failed for " + file.name + ": " + uploadResult.error.message;
                return;
            }

            const insertFileResult = await supabaseClient
                .from("transfer_session_files")
                .insert({
                    session_code: receiverCode,
                    file_name: file.name,
                    file_path: uniqueFilePath,
                    file_size: file.size
                });

            if (insertFileResult.error) {
                uploadStatus.textContent =
                    "Could not save file record for " +
                    file.name +
                    ": " +
                    insertFileResult.error.message;
                return;
            }

            uploadStatus.textContent =
                "Uploaded " + (i + 1) + " of " + files.length + " file(s)...";
        }
    }

    const updateResult = await supabaseClient
        .from("transfer_sessions")
        .update({
            status: "uploaded"
        })
        .eq("code", receiverCode);

    if (updateResult.error) {
        uploadStatus.textContent =
            "Sent, but session status update failed: " + updateResult.error.message;
        return;
    }

    uploadStatus.textContent = "Transfer complete. Receiver can now check for updates.";

    uploadMessageInput.value = "";
    uploadFileInput.value = "";
}
// Check Receive Session
checkReceiveSessionBtn.addEventListener("click", checkReceiveSession);

async function checkReceiveSession() {
    if (currentReceiveSessionCode === "") {
        receiveStatus.textContent = "No receive session has been created.";
        return;
    }

    receiveStatus.textContent = "Checking for uploaded files and messages...";

    const sessionResult = await supabaseClient
        .from("transfer_sessions")
        .select("*")
        .eq("code", currentReceiveSessionCode)
        .single();

    if (sessionResult.error) {
        receiveStatus.textContent = "Could not check receive session.";
        return;
    }

    const session = sessionResult.data;

    const now = new Date();
    const expiresAt = new Date(session.expires_at);

    if (now > expiresAt) {
        receiveStatus.textContent = "This receive session has expired.";
        checkReceiveSessionBtn.style.display = "none";
        downloadAllBtn.style.display = "none";
        return;
    }

    const messagesResult = await supabaseClient
        .from("transfer_session_messages")
        .select("*")
        .eq("session_code", currentReceiveSessionCode)
        .order("created_at", { ascending: true });

    if (messagesResult.error) {
        receiveStatus.textContent = "Could not load messages.";
        return;
    }

    const filesResult = await supabaseClient
        .from("transfer_session_files")
        .select("*")
        .eq("session_code", currentReceiveSessionCode)
        .order("created_at", { ascending: true });

    if (filesResult.error) {
        receiveStatus.textContent = "Could not load uploaded files.";
        return;
    }

    const messages = messagesResult.data;
    const files = filesResult.data;

    currentUploadedFiles = files;

    if (messages.length === 0 && files.length === 0) {
        receiveStatus.textContent = "Still waiting for sender to send something.";
        receiveMessageSection.style.display = "none";
        receiveDownloadSection.style.display = "none";
        downloadAllBtn.style.display = "none";
        return;
    }

    receiveStatus.textContent =
        messages.length + " message(s), " + files.length + " file(s) received.";

    displayReceivedMessages(messages);
    displayReceivedFiles(files);
}
// Display Received Messages
function displayReceivedMessages(messages) {
    receiveMessageSection.innerHTML = "";

    if (messages.length === 0) {
        receiveMessageSection.style.display = "none";
        return;
    }

    const heading = document.createElement("h3");
    heading.textContent = "Received Text / Links";
    receiveMessageSection.appendChild(heading);

    messages.forEach(function (message) {
        const messageCard = document.createElement("div");
        messageCard.className = "message-card";

        const messageText = document.createElement("p");
        messageText.innerHTML = makeClickableText(message.message_text);

        const copyButton = document.createElement("button");
        copyButton.textContent = "Copy Text";

        copyButton.addEventListener("click", async function () {
            await navigator.clipboard.writeText(message.message_text);
            receiveStatus.textContent = "Text copied.";
        });

        messageCard.appendChild(messageText);
        messageCard.appendChild(copyButton);

        receiveMessageSection.appendChild(messageCard);
    });

    receiveMessageSection.style.display = "block";
}
// Display Received Files
function displayReceivedFiles(files) {
    receiveDownloadSection.innerHTML = "";

    if (files.length === 0) {
        receiveDownloadSection.style.display = "none";
        downloadAllBtn.style.display = "none";
        return;
    }

    downloadAllBtn.style.display = "block";

    files.forEach(function (file) {
        const fileCard = document.createElement("div");
        fileCard.className = "file-card";

        fileCard.innerHTML = `
            <p><strong>${file.file_name}</strong></p>
            <p>Size: ${formatFileSize(file.file_size)}</p>

            <div
                class="image-preview-container"
                id="preview-${file.id}"
            ></div>

            <button
                class="downloadSessionFileBtn"
                data-path="${file.file_path}"
                data-name="${file.file_name}"
            >
                Open / Download
            </button>
        `;

        receiveDownloadSection.appendChild(fileCard);

        if (isImageFile(file.file_name)) {
            showImagePreview(file, "preview-" + file.id);
        }
    });

    receiveDownloadSection.style.display = "block";

    const downloadButtons = document.querySelectorAll(".downloadSessionFileBtn");

    downloadButtons.forEach(function (button) {
        button.addEventListener("click", async function () {
            const filePath = button.dataset.path;
            const fileName = button.dataset.name;

            receiveStatus.textContent = "Preparing file...";

            const signedUrlResult = await supabaseClient
                .storage
                .from("transfer-files")
                .createSignedUrl(filePath, 60);

            if (signedUrlResult.error) {
                receiveStatus.textContent = "Could not create download link.";
                return;
            }

            await downloadFileFromSignedUrl(
                signedUrlResult.data.signedUrl,
                fileName,
                receiveStatus
            );
        });
    });
}
// Download All Files as ZIP
downloadAllBtn.addEventListener("click", downloadAllFiles);

async function downloadAllFiles() {
    if (currentUploadedFiles.length === 0) {
        receiveStatus.textContent = "No files available to download.";
        return;
    }

    receiveStatus.textContent = "Preparing ZIP file...";

    const zip = new JSZip();

    for (let i = 0; i < currentUploadedFiles.length; i++) {
        const file = currentUploadedFiles[i];

        receiveStatus.textContent =
            "Adding " +
            (i + 1) +
            " of " +
            currentUploadedFiles.length +
            " file(s) to ZIP...";

        const signedUrlResult = await supabaseClient
            .storage
            .from("transfer-files")
            .createSignedUrl(file.file_path, 60);

        if (signedUrlResult.error) {
            receiveStatus.textContent =
                "Could not prepare " + file.file_name + " for download.";
            return;
        }

        const response = await fetch(signedUrlResult.data.signedUrl);

        if (!response.ok) {
            receiveStatus.textContent =
                "Could not fetch " + file.file_name + ".";
            return;
        }

        const blob = await response.blob();

        zip.file(file.file_name, blob);
    }

    receiveStatus.textContent = "Creating ZIP file...";

    const zipBlob = await zip.generateAsync({
        type: "blob"
    });

    const objectUrl = URL.createObjectURL(zipBlob);

    const temporaryLink = document.createElement("a");
    temporaryLink.href = objectUrl;
    temporaryLink.download = "handoff-files.zip";

    document.body.appendChild(temporaryLink);
    temporaryLink.click();
    document.body.removeChild(temporaryLink);

    URL.revokeObjectURL(objectUrl);

    receiveStatus.textContent = "Download all started.";
}
// Handle QR URL
function handleUploadCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const uploadCode = params.get("upload");

    if (uploadCode === null) {
        return;
    }

    uploadSessionCodeInput.value = uploadCode;
    showUploadPage();

    uploadStatus.textContent =
        "Receiver code filled from QR. Choose files or paste text/link to send.";
}

handleUploadCodeFromUrl();