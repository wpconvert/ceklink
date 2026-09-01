const API_URL =
    "https://script.google.com/macros/s/AKfycbxIBZ1WTXgkyChtnfsAS40lP1PoCkKxOkMZolx5JxgFtIdTjmCIQFZkPAU5InLDb8zxZQ/exec";

const SYNC_COOLDOWN_MS = 90000;
const CHECK_POLL_INTERVAL_MS = 10000;
const CHECK_MAX_WAIT_MS = 150000;

let links = [];
let activeCheck = false;
let checkStartedAt = 0;

const urlInput =
    document.getElementById("urlInput");

const addButton =
    document.getElementById("addButton");

const linkTable =
    document.getElementById("linkTable");

const emptyState =
    document.getElementById("emptyState");

const searchInput =
    document.getElementById("searchInput");

const filterStatus =
    document.getElementById("filterStatus");

const message =
    document.getElementById("message");

const themeToggle =
    document.getElementById("themeToggle");

const themeIcon =
    document.getElementById("themeIcon");

const checkAllButton =
    document.getElementById("checkAllButton");

const checkModal =
    document.getElementById("checkModal");

const modalClose =
    document.getElementById("modalClose");

const modalLoader =
    document.getElementById("modalLoader");

const modalSuccessIcon =
    document.getElementById("modalSuccessIcon");

const modalTitle =
    document.getElementById("modalTitle");

const modalText =
    document.getElementById("modalText");

const modalProgress =
    document.getElementById("modalProgress");

const modalSummary =
    document.getElementById("modalSummary");

const modalNormal =
    document.getElementById("modalNormal");

const modalNawala =
    document.getElementById("modalNawala");

const modalDone =
    document.getElementById("modalDone");


function apiRequest(params) {

    return new Promise(
        function(resolve, reject) {

            const callbackName =
                "nawalaCallback_" +
                Date.now() +
                "_" +
                Math.floor(
                    Math.random() * 100000
                );

            const script =
                document.createElement("script");

            const query =
                new URLSearchParams({
                    ...params,
                    callback:
                        callbackName
                }).toString();

            let finished = false;

            const timeout =
                setTimeout(
                    function() {

                        finishError(
                            new Error(
                                "Server tidak merespons."
                            )
                        );

                    },
                    15000
                );


            function cleanup() {

                delete window[
                    callbackName
                ];

                if (
                    script.parentNode
                ) {

                    script.parentNode.removeChild(
                        script
                    );

                }

            }


            function finishSuccess(data) {

                if (finished) {
                    return;
                }

                finished = true;

                clearTimeout(timeout);

                cleanup();

                resolve(data);

            }


            function finishError(error) {

                if (finished) {
                    return;
                }

                finished = true;

                clearTimeout(timeout);

                cleanup();

                reject(error);

            }


            window[callbackName] =
                function(data) {

                    finishSuccess(data);

                };


            script.onerror =
                function() {

                    finishError(
                        new Error(
                            "Gagal menghubungi GAS."
                        )
                    );

                };


            script.src =
                API_URL +
                "?" +
                query;


            document.body.appendChild(
                script
            );

        }
    );

}


function normalizeUrl(url) {

    let value =
        String(
            url || ""
        ).trim();


    if (!value) {
        return "";
    }


    if (
        !value.startsWith("http://") &&
        !value.startsWith("https://")
    ) {

        value =
            "https://" +
            value;

    }


    return value;

}


function formatTime(timestamp) {

    if (!timestamp) {
        return "-";
    }


    const date =
        new Date(
            timestamp
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "-";

    }


    return date.toLocaleString(
        "id-ID",
        {
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    );

}


function sleep(milliseconds) {

    return new Promise(
        function(resolve) {

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}


async function loadLinks(
    silent = false
) {

    try {

        const result =
            await apiRequest({
                action:
                    "list"
            });


        if (
            !result ||
            !result.success
        ) {

            throw new Error(
                result &&
                result.message
                    ? result.message
                    : "Gagal mengambil data."
            );

        }


        links =
            Array.isArray(
                result.data
            )
                ? result.data
                : [];


        render();

        updateLastUpdate();


        return true;


    } catch (error) {

        console.error(
            "LOAD LINKS ERROR:",
            error
        );


        if (!silent) {

            showMessage(
                "Gagal mengambil data dari server.",
                "error"
            );

        }


        return false;

    }

}


async function addLink() {

    const url =
        normalizeUrl(
            urlInput.value
        );


    if (!url) {

        showMessage(
            "URL tidak boleh kosong.",
            "error"
        );

        return;

    }


    try {

        new URL(url);

    } catch (error) {

        showMessage(
            "Format URL tidak valid.",
            "error"
        );

        return;

    }


    addButton.disabled =
        true;


    try {

        const result =
            await apiRequest({

                action:
                    "add",

                url:
                    url

            });


        if (
            !result ||
            !result.success
        ) {

            showMessage(
                result &&
                result.message
                    ? result.message
                    : "Gagal menambahkan link.",
                "error"
            );

            return;

        }


        urlInput.value =
            "";


        showMessage(
            "Link berhasil ditambahkan.",
            "success"
        );


        await loadLinks();


        /*
         * Setelah link baru ditambahkan,
         * mulai proses pengecekan di background.
         */
        triggerSyncInBackground(
            true
        );


    } catch (error) {

        console.error(
            "ADD LINK ERROR:",
            error
        );


        showMessage(
            "Gagal menambahkan link.",
            "error"
        );


    } finally {

        addButton.disabled =
            false;

    }

}


async function checkAllLinks() {

    if (activeCheck) {

        showMessage(
            "Pengecekan sedang berjalan.",
            "error"
        );

        return;

    }


    if (
        links.length === 0
    ) {

        showMessage(
            "Belum ada link untuk dicek.",
            "error"
        );

        return;

    }


    await runFullCheck();

}


async function runFullCheck() {

    if (activeCheck) {
        return;
    }


    activeCheck =
        true;

    checkStartedAt =
        Date.now();


    /*
     * Semua baris langsung berubah menjadi
     * status MENGECEK di tampilan.
     */
    render();

    setCheckingControls(
        true
    );

    showCheckModal();


    try {

        modalTitle.textContent =
            "Pengecekan Link";


        modalText.textContent =
            "Memulai pengecekan semua link...";


        const syncResult =
            await triggerSync();


        if (
            !syncResult ||
            !syncResult.success
        ) {

            throw new Error(
                syncResult &&
                syncResult.message
                    ? syncResult.message
                    : "Gagal memulai checker."
            );

        }


        modalText.textContent =
            "Semua link sedang diperiksa. Mohon tunggu...";


        const completed =
            await waitForCheckComplete();


        if (!completed) {

            throw new Error(
                "Pengecekan membutuhkan waktu lebih lama dari perkiraan."
            );

        }


        const loaded =
            await loadLinks(
                true
            );


        if (!loaded) {

            throw new Error(
                "Status terbaru gagal diambil."
            );

        }


        finishCheckModal();


        showMessage(
            "Semua link selesai diperiksa.",
            "success"
        );


    } catch (error) {

        console.error(
            "FULL CHECK ERROR:",
            error
        );


        await loadLinks(
            true
        );


        showCheckModalError(
            error.message ||
            "Gagal menjalankan pengecekan."
        );


    } finally {

        activeCheck =
            false;

        setCheckingControls(
            false
        );

        render();

    }

}


async function waitForCheckComplete() {

    const started =
        Date.now();


    while (
        Date.now() -
        started <
        CHECK_MAX_WAIT_MS
    ) {

        await sleep(
            CHECK_POLL_INTERVAL_MS
        );


        const result =
            await getLatestLinks();


        if (
            !result ||
            !result.success
        ) {

            continue;

        }


        const data =
            Array.isArray(
                result.data
            )
                ? result.data
                : [];


        if (
            data.length === 0
        ) {

            return true;

        }


        const allChecked =
            data.every(
                function(item) {

                    if (
                        !item.lastChecked
                    ) {

                        return false;

                    }


                    const checkedTime =
                        new Date(
                            item.lastChecked
                        ).getTime();


                    return (
                        checkedTime >=
                        checkStartedAt - 10000
                    );

                }
            );


        if (
            allChecked
        ) {

            links =
                data;

            render();

            updateLastUpdate();

            return true;

        }

    }


    return false;

}


async function getLatestLinks() {

    try {

        return await apiRequest({
            action:
                "list"
        });


    } catch (error) {

        console.warn(
            "POLL ERROR:",
            error
        );

        return null;

    }

}


function triggerSync() {

    return apiRequest({
        action:
            "sync"
    })
    .catch(
        function(error) {

            return {

                success:
                    false,

                status:
                    "error",

                message:
                    error.message

            };

        }
    );

}


function triggerSyncInBackground(
    force = false
) {

    if (
        !force &&
        !shouldTriggerSync()
    ) {

        return;

    }


    setLastSyncTrigger();


    triggerSync()
        .then(
            function(result) {

                if (
                    !result ||
                    !result.success
                ) {

                    console.warn(
                        "BACKGROUND SYNC FAILED:",
                        result
                    );

                    return;

                }


                console.log(
                    "BACKGROUND SYNC STARTED"
                );

            }
        )
        .catch(
            function(error) {

                console.warn(
                    "BACKGROUND SYNC ERROR:",
                    error
                );

            }
        );

}


function getLastSyncTrigger() {

    const value =
        localStorage.getItem(
            "nawalaLastSyncTrigger"
        );


    if (!value) {
        return 0;
    }


    const timestamp =
        Number(value);


    if (
        !Number.isFinite(
            timestamp
        )
    ) {

        return 0;

    }


    return timestamp;

}


function setLastSyncTrigger() {

    localStorage.setItem(
        "nawalaLastSyncTrigger",
        String(
            Date.now()
        )
    );

}


function shouldTriggerSync() {

    const lastSync =
        getLastSyncTrigger();


    return (
        Date.now() -
        lastSync >=
        SYNC_COOLDOWN_MS
    );

}


function setCheckingControls(
    checking
) {

    if (
        checkAllButton
    ) {

        checkAllButton.disabled =
            checking;


        if (checking) {

            checkAllButton.dataset.originalText =
                checkAllButton.textContent;

            checkAllButton.textContent =
                "⏳ Mengecek Semua...";

        } else {

            checkAllButton.textContent =
                checkAllButton.dataset.originalText ||
                "↻ Cek Semua Link";

            delete checkAllButton.dataset.originalText;

        }

    }

}


function showCheckModal() {

    if (!checkModal) {
        return;
    }


    modalLoader.style.display =
        "flex";


    modalSuccessIcon.classList.remove(
        "show"
    );


    modalProgress.style.display =
        "block";


    modalSummary.classList.remove(
        "show"
    );


    modalDone.classList.remove(
        "show"
    );


    modalClose.style.display =
        "none";


    modalTitle.textContent =
        "Pengecekan Link";


    modalText.textContent =
        "Memulai pengecekan...";


    checkModal.classList.add(
        "show"
    );


    checkModal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "modal-open"
    );

}


function finishCheckModal() {

    const normalCount =
        links.filter(
            function(item) {

                return (
                    item.status ===
                    "normal"
                );

            }
        ).length;


    const nawalaCount =
        links.filter(
            function(item) {

                return (
                    item.status ===
                    "nawala"
                );

            }
        ).length;


    modalLoader.style.display =
        "none";


    modalProgress.style.display =
        "none";


    modalSuccessIcon.classList.add(
        "show"
    );


    modalTitle.textContent =
        "Pengecekan Selesai";


    modalText.textContent =
        "Status seluruh link sudah diperbarui.";


    modalNormal.textContent =
        normalCount;


    modalNawala.textContent =
        nawalaCount;


    modalSummary.classList.add(
        "show"
    );


    modalDone.classList.add(
        "show"
    );


    modalClose.style.display =
        "flex";

}


function showCheckModalError(
    text
) {

    modalLoader.style.display =
        "none";


    modalProgress.style.display =
        "none";


    modalSuccessIcon.classList.remove(
        "show"
    );


    modalSummary.classList.remove(
        "show"
    );


    modalDone.classList.add(
        "show"
    );


    modalClose.style.display =
        "flex";


    modalTitle.textContent =
        "Pengecekan Gagal";


    modalText.textContent =
        text;


    checkModal.classList.add(
        "show"
    );


    checkModal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "modal-open"
    );

}


function closeCheckModal() {

    if (!checkModal) {
        return;
    }


    if (activeCheck) {

        return;

    }


    checkModal.classList.remove(
        "show"
    );


    checkModal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "modal-open"
    );

}


function getStatusHTML(
    status
) {

    if (
        status ===
        "normal"
    ) {

        return `
            <span class="status status-normal">
                <span class="status-dot"></span>
                NORMAL
            </span>
        `;

    }


    if (
        status ===
        "nawala"
    ) {

        return `
            <span class="status status-nawala">
                <span class="status-dot"></span>
                NAWALA
            </span>
        `;

    }


    if (
        status ===
        "checking"
    ) {

        return `
            <span class="status status-unchecked">
                <span class="status-dot"></span>
                ⏳ MENGECEK...
            </span>
        `;

    }


    if (
        status ===
        "unknown"
    ) {

        return `
            <span class="status status-unchecked">
                <span class="status-dot"></span>
                UNKNOWN
            </span>
        `;

    }


    if (
        status ===
        "error"
    ) {

        return `
            <span class="status status-unchecked">
                <span class="status-dot"></span>
                ERROR
            </span>
        `;

    }


    return `
        <span class="status status-unchecked">
            <span class="status-dot"></span>
            BELUM DICEK
        </span>
    `;

}


function getDisplayStatus(
    item
) {

    if (
        activeCheck
    ) {

        return "checking";

    }


    return (
        item.status ||
        "unchecked"
    );

}


function render() {

    const search =
        searchInput.value
            .toLowerCase()
            .trim();


    const filter =
        filterStatus.value;


    let filtered =
        links.filter(
            function(item) {

                return String(
                    item.url || ""
                )
                .toLowerCase()
                .includes(
                    search
                );

            }
        );


    if (
        filter !==
        "all"
    ) {

        filtered =
            filtered.filter(
                function(item) {

                    return (
                        item.status ===
                        filter
                    );

                }
            );

    }


    linkTable.innerHTML =
        "";


    emptyState.style.display =
        filtered.length ===
        0
            ? "block"
            : "none";


    filtered.forEach(
        function(item) {

            const row =
                document.createElement(
                    "tr"
                );


            const displayStatus =
                getDisplayStatus(
                    item
                );


            row.innerHTML = `

                <td>
                    <div class="url-cell">
                        ${escapeHtml(
                            item.url
                        )}
                    </div>
                </td>

                <td>
                    ${getStatusHTML(
                        displayStatus
                    )}
                </td>

                <td>
                    <span class="time-cell">
                        ${
                            activeCheck
                                ? "Sedang diperiksa..."
                                : formatTime(
                                    item.lastChecked
                                )
                        }
                    </span>
                </td>

                <td>
                    <div class="action-group">

                        <button
                            class="btn-action btn-delete"
                            data-delete-id="${escapeHtml(
                                String(item.id)
                            )}"
                            type="button"
                        >
                            🗑 Hapus
                        </button>

                    </div>
                </td>

            `;


            linkTable.appendChild(
                row
            );

        }
    );


    updateStatistics();

}


function updateStatistics() {

    const total =
        links.length;


    const normal =
        links.filter(
            function(item) {

                return (
                    item.status ===
                    "normal"
                );

            }
        ).length;


    const nawala =
        links.filter(
            function(item) {

                return (
                    item.status ===
                    "nawala"
                );

            }
        ).length;


    const unchecked =
        links.filter(
            function(item) {

                return (
                    item.status ===
                    "unchecked" ||
                    item.status ===
                    "unknown"
                );

            }
        ).length;


    const totalElement =
        document.getElementById(
            "totalLinks"
        );


    const normalElement =
        document.getElementById(
            "normalLinks"
        );


    const blockedElement =
        document.getElementById(
            "blockedLinks"
        );


    const uncheckedElement =
        document.getElementById(
            "uncheckedLinks"
        );


    if (
        totalElement
    ) {

        totalElement.textContent =
            total;

    }


    if (
        normalElement
    ) {

        normalElement.textContent =
            normal;

    }


    if (
        blockedElement
    ) {

        blockedElement.textContent =
            nawala;

    }


    if (
        uncheckedElement
    ) {

        uncheckedElement.textContent =
            unchecked;

    }

}


function updateLastUpdate() {

    const element =
        document.getElementById(
            "lastUpdate"
        );


    if (!element) {
        return;
    }


    element.textContent =
        new Date().toLocaleTimeString(
            "id-ID",
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit",

                second:
                    "2-digit"
            }
        );

}


function showMessage(
    text,
    type
) {

    if (!message) {
        return;
    }


    message.textContent =
        text;


    message.className =
        type ===
        "success"
            ? "message-success"
            : "message-error";


    setTimeout(
        function() {

            message.textContent =
                "";

            message.className =
                "";

        },
        3000
    );

}


function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value || ""
        );


    return div.innerHTML;

}


function loadTheme() {

    const savedTheme =
        localStorage.getItem(
            "nawalaTheme"
        );


    if (
        savedTheme ===
        "dark"
    ) {

        document.body.classList.add(
            "dark"
        );

        themeIcon.textContent =
            "☀";

    } else {

        document.body.classList.remove(
            "dark"
        );

        themeIcon.textContent =
            "☀";

    }

}


function toggleTheme() {

    document.body.classList.toggle(
        "dark"
    );


    const dark =
        document.body.classList.contains(
            "dark"
        );


    localStorage.setItem(
        "nawalaTheme",
        dark
            ? "dark"
            : "light"
    );


    themeIcon.textContent =
        "☀";

}


if (themeToggle) {

    themeToggle.addEventListener(
        "click",
        toggleTheme
    );

}


if (addButton) {

    addButton.addEventListener(
        "click",
        addLink
    );

}


if (urlInput) {

    urlInput.addEventListener(
        "keydown",
        function(event) {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                addLink();

            }

        }
    );

}


if (searchInput) {

    searchInput.addEventListener(
        "input",
        render
    );

}


if (filterStatus) {

    filterStatus.addEventListener(
        "change",
        render
    );

}


if (checkAllButton) {

    checkAllButton.addEventListener(
        "click",
        checkAllLinks
    );

}


/*
 * Tombol Hapus ditangani di satu tempat.
 * Tidak menggunakan onclick inline.
 */
if (linkTable) {

    linkTable.addEventListener(
        "click",
        async function(event) {

            const deleteButton =
                event.target.closest(
                    "[data-delete-id]"
                );


            if (
                !deleteButton
            ) {

                return;

            }


            const id =
                deleteButton.getAttribute(
                    "data-delete-id"
                );


            await deleteLink(
                id
            );

        }
    );

}


async function deleteLink(
    id
) {

    if (!id) {

        showMessage(
            "ID link tidak ditemukan.",
            "error"
        );

        return;

    }


    const confirmed =
        window.confirm(
            "Hapus link ini dari monitoring?"
        );


    if (!confirmed) {

        return;

    }


    try {

        showMessage(
            "Menghapus link...",
            "success"
        );


        const result =
            await apiRequest({

                action:
                    "delete",

                id:
                    id

            });


        if (
            !result ||
            !result.success
        ) {

            showMessage(
                result &&
                result.message
                    ? result.message
                    : "Gagal menghapus link.",
                "error"
            );

            return;

        }


        /*
         * Pastikan data diambil ulang
         * dari Google Sheets.
         */
        const loaded =
            await loadLinks(
                true
            );


        if (!loaded) {

            throw new Error(
                "Data terbaru gagal diambil."
            );

        }


        showMessage(
            "Link berhasil dihapus.",
            "success"
        );


    } catch (error) {

        console.error(
            "DELETE LINK ERROR:",
            error
        );


        showMessage(
            error.message ||
            "Gagal menghapus link.",
            "error"
        );

    }

}


if (modalClose) {

    modalClose.addEventListener(
        "click",
        closeCheckModal
    );

}


if (modalDone) {

    modalDone.addEventListener(
        "click",
        closeCheckModal
    );

}


if (checkModal) {

    checkModal.addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                checkModal &&
                !activeCheck
            ) {

                closeCheckModal();

            }

        }
    );

}


document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key ===
            "Escape" &&
            !activeCheck &&
            checkModal &&
            checkModal.classList.contains(
                "show"
            )
        ) {

            closeCheckModal();

        }

    }
);


loadTheme();


(async function init() {

    await loadLinks();

    /*
     * Tetap melakukan sync otomatis
     * saat website dibuka/refresh.
     */
    triggerSyncInBackground();

})();
