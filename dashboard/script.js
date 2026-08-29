```javascript
/*
    NAWALA MONITOR
    =========================

    Versi awal / prototype.

    Untuk sekarang status Nawala masih
    menggunakan simulasi.

    Nanti fungsi checkUrl() akan kita
    sambungkan ke backend / sumber
    pengecekan Komdigi.
*/


// =========================
// DATABASE SEMENTARA
// =========================

let links = JSON.parse(
    localStorage.getItem("nawalaLinks")
) || [];


// =========================
// ELEMENT
// =========================

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


// =========================
// SAVE DATA
// =========================

function saveLinks() {

    localStorage.setItem(
        "nawalaLinks",
        JSON.stringify(links)
    );

}


// =========================
// FORMAT URL
// =========================

function normalizeUrl(url) {

    url = url.trim();

    if (!url) {
        return "";
    }

    if (
        !url.startsWith("http://") &&
        !url.startsWith("https://")
    ) {
        return "https://" + url;
    }

    return url;

}


// =========================
// FORMAT TIME
// =========================

function formatTime(timestamp) {

    if (!timestamp) {
        return "-";
    }

    const date =
        new Date(timestamp);

    return date.toLocaleString(
        "id-ID",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


// =========================
// ADD LINK
// =========================

function addLink() {

    let url =
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

    } catch {

        showMessage(
            "Format URL tidak valid.",
            "error"
        );

        return;
    }


    // Cek duplikat

    const exists =
        links.some(
            item =>
                item.url.toLowerCase() ===
                url.toLowerCase()
        );


    if (exists) {

        showMessage(
            "URL tersebut sudah ada di monitoring.",
            "error"
        );

        return;
    }


    const newLink = {

        id:
            Date.now(),

        url:
            url,

        status:
            "unchecked",

        lastChecked:
            null

    };


    links.unshift(
        newLink
    );


    saveLinks();

    urlInput.value = "";

    showMessage(
        "Link berhasil ditambahkan.",
        "success"
    );

    render();

}


// =========================
// SIMULASI CHECK
// =========================

async function checkUrl(id) {

    const link =
        links.find(
            item =>
                item.id === id
        );


    if (!link) {
        return;
    }


    // Tampilkan checking

    link.status =
        "checking";

    render();


    /*
        Simulasi proses pengecekan.

        NANTI BAGIAN INI DIGANTI
        DENGAN API / BACKEND KOMDIGI.
    */

    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                1200
            )
    );


    /*
        Untuk demo:

        Secara acak menentukan
        NORMAL atau NAWALA.

        Ini HANYA untuk melihat
        tampilan dashboard.
    */

    const random =
        Math.random();


    if (random < 0.8) {

        link.status =
            "normal";

    } else {

        link.status =
            "nawala";

    }


    link.lastChecked =
        Date.now();


    saveLinks();

    updateLastUpdate();

    render();

}


// =========================
// DELETE LINK
// =========================

function deleteLink(id) {

    const confirmed =
        confirm(
            "Hapus link ini dari monitoring?"
        );


    if (!confirmed) {
        return;
    }


    links =
        links.filter(
            item =>
                item.id !== id
        );


    saveLinks();

    render();

}


// =========================
// STATUS HTML
// =========================

function getStatusHTML(status) {

    if (status === "normal") {

        return `
            <span class="status status-normal">
                <span class="status-dot-small"></span>
                NORMAL
            </span>
        `;

    }


    if (status === "nawala") {

        return `
            <span class="status status-nawala">
                <span class="status-dot-small"></span>
                NAWALA
            </span>
        `;

    }


    if (status === "checking") {

        return `
            <span class="status status-unchecked">
                <span class="status-dot-small"></span>
                CHECKING...
            </span>
        `;

    }


    return `
        <span class="status status-unchecked">
            <span class="status-dot-small"></span>
            BELUM DICEK
        </span>
    `;

}


// =========================
// RENDER TABLE
// =========================

function render() {

    const search =
        searchInput.value
            .toLowerCase()
            .trim();

    const filter =
        filterStatus.value;


    let filtered =
        links.filter(
            item =>
                item.url
                    .toLowerCase()
                    .includes(search)
        );


    if (filter !== "all") {

        filtered =
            filtered.filter(
                item =>
                    item.status === filter
            );

    }


    linkTable.innerHTML = "";


    if (filtered.length === 0) {

        emptyState.style.display =
            "block";

    } else {

        emptyState.style.display =
            "none";

    }


    filtered.forEach(
        item => {

            const row =
                document.createElement("tr");


            row.innerHTML = `

                <td>
                    <div class="url-cell">
                        ${escapeHtml(item.url)}
                    </div>
                </td>

                <td>
                    ${getStatusHTML(item.status)}
                </td>

                <td>
                    <span class="time-cell">
                        ${formatTime(item.lastChecked)}
                    </span>
                </td>

                <td>

                    <div class="action-group">

                        <button
                            class="btn-check"
                            onclick="checkUrl(${item.id})"
                        >
                            🔍 Cek
                        </button>

                        <button
                            class="btn-delete"
                            onclick="deleteLink(${item.id})"
                        >
                            🗑 Hapus
                        </button>

                    </div>

                </td>
            `;


            linkTable.appendChild(row);

        }
    );


    updateStatistics();

}


// =========================
// STATISTICS
// =========================

function updateStatistics() {

    const total =
        links.length;


    const normal =
        links.filter(
            item =>
                item.status === "normal"
        ).length;


    const nawala =
        links.filter(
            item =>
                item.status === "nawala"
        ).length;


    const unchecked =
        links.filter(
            item =>
                item.status === "unchecked"
        ).length;


    document.getElementById(
        "totalLinks"
    ).textContent = total;


    document.getElementById(
        "normalLinks"
    ).textContent = normal;


    document.getElementById(
        "blockedLinks"
    ).textContent = nawala;


    document.getElementById(
        "uncheckedLinks"
    ).textContent = unchecked;

}


// =========================
// LAST UPDATE
// =========================

function updateLastUpdate() {

    document.getElementById(
        "lastUpdate"
    ).textContent =
        new Date().toLocaleTimeString(
            "id-ID",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        );

}


// =========================
// MESSAGE
// =========================

function showMessage(
    text,
    type
) {

    message.textContent =
        text;


    message.className =
        type === "success"
            ? "message-success"
            : "message-error";


    setTimeout(
        () => {

            message.textContent =
                "";

        },
        3000
    );

}


// =========================
// ESCAPE HTML
// =========================

function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value;

    return div.innerHTML;

}


// =========================
// EVENTS
// =========================

addButton.addEventListener(
    "click",
    addLink
);


urlInput.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            addLink();

        }

    }
);


searchInput.addEventListener(
    "input",
    render
);


filterStatus.addEventListener(
    "change",
    render
);


// =========================
// INITIAL LOAD
// =========================

render();

updateLastUpdate();
```
