// Supabase Setup
const SUPABASE_URL = "https://hcipkkfyopuslgtzmifa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6qyKoD86F29kvGivX7QzRg_5hPgX9xD";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Global State
let currentReceiveSessionCode = "";
// Page Elements
const homePage = document.getElementById("homePage");
const sendPage = document.getElementById("sendPage");
const receivePage = document.getElementById("receivePage");
const uploadPage = document.getElementById("uploadPage");
const codePage = document.getElementById("codePage");
const myTransfersPage = document.getElementById("myTransfersPage");
const directDownloadPage = document.getElementById("directDownloadPage");

const sendBtn = document.getElementById("sendBtn");
const receiveBtn = document.getElementById("receiveBtn");
const uploadToReceiverBtn = document.getElementById("uploadToReceiverBtn");
const enterCodeBtn = document.getElementById("enterCodeBtn");
const myTransfersBtn = document.getElementById("myTransfersBtn");


// Send Page Elements
const sendFileInput = document.getElementById("sendFileInput");
const uploadAndCreateLinkBtn = document.getElementById("uploadAndCreateLinkBtn");
const sendCode = document.getElementById("sendCode");
const sendStatus = document.getElementById("sendStatus");



// Receive Page Elements
const createReceiveSessionBtn = document.getElementById("createReceiveSessionBtn");
const receiveCode = document.getElementById("receiveCode");
const receiveQRCode = document.getElementById("receiveQRCode");
const receiveStatus = document.getElementById("receiveStatus");
const checkReceiveSessionBtn = document.getElementById("checkReceiveSessionBtn");
const receiveDownloadSection = document.getElementById("receiveDownloadSection");
const receiveFileNameDisplay = document.getElementById("receiveFileNameDisplay");
const receiveFileSizeDisplay = document.getElementById("receiveFileSizeDisplay");
const receiveDownloadBtn = document.getElementById("receiveDownloadBtn");



// Upload To Receiver Elements
const uploadSessionCodeInput = document.getElementById("uploadSessionCodeInput");
const uploadFileInput = document.getElementById("uploadFileInput");
const uploadToSessionBtn = document.getElementById("uploadToSessionBtn");
const uploadStatus = document.getElementById("uploadStatus");



// Code Page Elements
const codeInput = document.getElementById("codeInput");
const getFileBtn = document.getElementById("getFileBtn");
const codeStatus = document.getElementById("codeStatus");



// My Transfers Elements
const refreshMyTransfersBtn = document.getElementById("refreshMyTransfersBtn");
const myTransfersList = document.getElementById("myTransfersList");



// Page Switching
function hideAllPages() {
    homePage.style.display = "none";
    sendPage.style.display = "none";
    receivePage.style.display = "none";
    uploadPage.style.display = "none";
    codePage.style.display = "none";
    myTransfersPage.style.display = "none";
    directDownloadPage.style.display = "none";
}

function showHomePage() {
    hideAllPages();
    homePage.style.display = "block";
}

function showSendPage() {
    hideAllPages();
    sendPage.style.display = "block";
}

function showReceivePage() {
    hideAllPages();
    receivePage.style.display = "block";
}

function showUploadPage() {
    hideAllPages();
    uploadPage.style.display = "block";
}

function showCodePage() {
    hideAllPages();
    codePage.style.display = "block";
}

function showMyTransfersPage() {
    hideAllPages();
    myTransfersPage.style.display = "block";
    loadMyTransfers();
}
// Button Events
sendBtn.addEventListener("click", showSendPage);
receiveBtn.addEventListener("click", showReceivePage);
uploadToReceiverBtn.addEventListener("click", showUploadPage);
enterCodeBtn.addEventListener("click", showCodePage);
myTransfersBtn.addEventListener("click", showMyTransfersPage);

const backHomeBtns = document.querySelectorAll(".backHomeBtn");

backHomeBtns.forEach(function (button) {
    button.addEventListener("click", showHomePage);
});

refreshMyTransfersBtn.addEventListener("click", loadMyTransfers);

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

function saveTransferCodeToLocalStorage(code) {
    const savedCodes = localStorage.getItem("myTransferCodes");

    let codes = [];

    if (savedCodes !== null) {
        codes = JSON.parse(savedCodes);
    }

    if (!codes.includes(code)) {
        codes.push(code);
    }

    localStorage.setItem("myTransferCodes", JSON.stringify(codes));
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

async function downloadFileFromSignedUrl(signedUrl, fileName, statusElement) {
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

// Send-First Upload
uploadAndCreateLinkBtn.addEventListener("click", async function () {
    const file = sendFileInput.files[0];

    if (!file) {
        sendStatus.textContent = "Please choose a file first.";
        return;
    }

    const maxFileSize = 50 * 1024 * 1024;

    if (file.size > maxFileSize) {
        sendStatus.textContent = "File too large. Maximum size is 50 MB.";
        return;
    }

    sendCode.textContent = "";
    sendStatus.textContent = "Uploading...";

    const transferCode = generateTransferCode();
    const filePath = "uploads/" + transferCode + "/" + file.name;

    const uploadResult = await supabaseClient
        .storage
        .from("transfer-files")
        .upload(filePath, file);

    if (uploadResult.error) {
        sendStatus.textContent = "Upload failed: " + uploadResult.error.message;
        return;
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const insertResult = await supabaseClient
        .from("transfer_files")
        .insert({
            code: transferCode,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            expires_at: expiresAt.toISOString()
        });

    if (insertResult.error) {
        sendStatus.textContent = "Database save failed: " + insertResult.error.message;
        return;
    }

    sendCode.textContent = transferCode;

    saveTransferCodeToLocalStorage(transferCode);

    sendStatus.textContent =
        "Upload complete. Use this code on the other device. File size: " +
        formatFileSize(file.size);
});

// Receive Session Creation + QR
createReceiveSessionBtn.addEventListener("click", createReceiveSession);

async function createReceiveSession() {
    receiveStatus.textContent = "Creating receive session...";
    receiveCode.textContent = "";
    receiveQRCode.innerHTML = "";
    receiveDownloadSection.innerHTML = "";
    receiveDownloadSection.style.display = "none";
    checkReceiveSessionBtn.style.display = "none";

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
        "Waiting for sender to upload file(s). Scan the QR code or enter the code manually.";

    checkReceiveSessionBtn.style.display = "block";
}

// Upload Multiple Files to Receiver Session
uploadToSessionBtn.addEventListener("click", uploadToReceiverSession);

async function uploadToReceiverSession() {
    const receiverCode = uploadSessionCodeInput.value.trim();
    const files = uploadFileInput.files;

    if (receiverCode === "") {
        uploadStatus.textContent = "Please enter the receiver's session code.";
        return;
    }

    if (files.length === 0) {
        uploadStatus.textContent = "Please choose at least one file.";
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

    const updateResult = await supabaseClient
        .from("transfer_sessions")
        .update({
            status: "uploaded"
        })
        .eq("code", receiverCode);

    if (updateResult.error) {
        uploadStatus.textContent =
            "Files uploaded, but session status update failed: " +
            updateResult.error.message;
        return;
    }

    uploadStatus.textContent =
        "Upload complete. Receiver can now download " + files.length + " file(s).";
}


// Check Receive Session For Multiple Files + Image Preview
checkReceiveSessionBtn.addEventListener("click", checkReceiveSession);

async function checkReceiveSession() {
    if (currentReceiveSessionCode === "") {
        receiveStatus.textContent = "No receive session has been created.";
        return;
    }

    receiveStatus.textContent = "Checking for uploaded files...";

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

    const files = filesResult.data;

    if (files.length === 0) {
        receiveStatus.textContent = "Still waiting for sender to upload files.";
        return;
    }

    receiveStatus.textContent = files.length + " file(s) uploaded.";

    receiveDownloadSection.innerHTML = "";

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
                Download
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

            receiveStatus.textContent = "Preparing download...";

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

            receiveStatus.textContent = "Download started.";
        });
    });
}


// Old Single Download Button Fallback
if (receiveDownloadBtn) {
    receiveDownloadBtn.addEventListener("click", function () {
        receiveStatus.textContent =
            "Use the individual Download buttons shown under each file.";
    });
}

// Download File by Code
getFileBtn.addEventListener("click", async function () {
    const enteredCode = codeInput.value.trim();

    if (enteredCode === "") {
        codeStatus.textContent = "Please enter a transfer code.";
        return;
    }

    codeStatus.textContent = "Searching...";

    const result = await supabaseClient
        .from("transfer_files")
        .select("*")
        .eq("code", enteredCode)
        .single();

    if (result.error) {
        codeStatus.textContent = "No file found for this code.";
        return;
    }

    const fileData = result.data;

    const now = new Date();
    const expiresAt = new Date(fileData.expires_at);

    if (now > expiresAt) {
        codeStatus.textContent = "This transfer has expired.";
        return;
    }

    const signedUrlResult = await supabaseClient
        .storage
        .from("transfer-files")
        .createSignedUrl(fileData.file_path, 60);

    if (signedUrlResult.error) {
        codeStatus.textContent = "Could not create download link.";
        return;
    }

    codeStatus.innerHTML = `
        <p>File found: ${fileData.file_name}</p>
        <p>Size: ${formatFileSize(fileData.file_size)}</p>
        <button id="downloadFoundFileBtn">Download File</button>
    `;

    const downloadFoundFileBtn = document.getElementById("downloadFoundFileBtn");

    downloadFoundFileBtn.addEventListener("click", async function () {
        await downloadFileFromSignedUrl(
            signedUrlResult.data.signedUrl,
            fileData.file_name,
            codeStatus
        );
    });
});



// My Transfers
async function loadMyTransfers() {
    myTransfersList.textContent = "Loading...";

    const savedCodes = localStorage.getItem("myTransferCodes");

    if (savedCodes === null) {
        myTransfersList.textContent = "No transfers created from this browser.";
        return;
    }

    const codes = JSON.parse(savedCodes);

    if (codes.length === 0) {
        myTransfersList.textContent = "No transfers created from this browser.";
        return;
    }

    const result = await supabaseClient
        .from("transfer_files")
        .select("*")
        .in("code", codes)
        .order("created_at", { ascending: false });

    if (result.error) {
        myTransfersList.textContent =
            "Could not load transfers: " + result.error.message;
        return;
    }

    const now = new Date();

    const activeTransfers = result.data.filter(function (file) {
        return new Date(file.expires_at) > now;
    });

    if (activeTransfers.length === 0) {
        myTransfersList.textContent = "No active transfers left.";
        return;
    }

    myTransfersList.innerHTML = "";

    activeTransfers.forEach(function (file) {
        const expiresAt = new Date(file.expires_at);
        const timeLeftMs = expiresAt - now;

        const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
        const minutesLeft = Math.floor(
            (timeLeftMs % (1000 * 60 * 60)) / (1000 * 60)
        );

        const fileCard = document.createElement("div");
        fileCard.className = "file-card";

        fileCard.innerHTML = `
            <p><strong>${file.file_name}</strong></p>
            <p>Code: ${file.code}</p>
            <p>Size: ${formatFileSize(file.file_size)}</p>
            <p>Time left: ${hoursLeft}h ${minutesLeft}m</p>
            <button class="useTransferCodeBtn" data-code="${file.code}">
                Use this code
            </button>
        `;

        myTransfersList.appendChild(fileCard);
    });

    const useTransferCodeBtns = document.querySelectorAll(".useTransferCodeBtn");

    useTransferCodeBtns.forEach(function (button) {
        button.addEventListener("click", function () {
            const code = button.dataset.code;

            codeInput.value = code;
            showCodePage();
        });
    });
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
        "Receiver code filled from QR. Choose one or more files to upload.";
}

handleUploadCodeFromUrl();