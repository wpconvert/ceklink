const API_URL = "https://script.google.com/macros/s/AKfycbyNJpi_5Nz5huR-hzaG2wh1Pxc5LO2D0etDMAKgyaxUjIj_1sebsjdx0ivitP_mnF__mw/exec";

let links = [];

const urlInput = document.getElementById("urlInput");
const addButton = document.getElementById("addButton");
const linkTable = document.getElementById("linkTable");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const filterStatus = document.getElementById("filterStatus");
const message = document.getElementById("message");

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");


function apiRequest(params) {

    return new Promise((resolve, reject) => {

        const callbackName =
            "nawalaCallback_" +
            Date.now() +
            "_" +
            Math.floor(Math.random() * 100000);

        const script =
            document.createElement("script");

        const query =
            new URLSearchParams({
                ...params,
                callback: callbackName
            }).toString();

        const timeout =
            setTimeout(() => {

                cleanup();

                reject(
                    new Error(
                        "Server tidak merespons."
                    )
                );

            }, 15000);


        window[callbackName] =
            function(data) {

                clearTimeout(timeout);

                cleanup();

                resolve(data);

            };


        function cleanup() {

            delete window[callbackName];

            if (script.parentNode) {

                script.parentNode.removeChild(
                    script
                );

            }

        }


        script.onerror =
            function() {

                clearTimeout(timeout);

                cleanup();

                reject(
                    new Error(
                        "Gagal menghubungi GAS."
                    )
                );

            };


        script.src =
            `${API_URL}?${query}`;

        document.body.appendChild(
            script
        );

    });
}


function normalizeUrl(url) {

    url = url.trim();

    if (!url) return "";

    if (
        !url.startsWith("http://") &&
        !url.startsWith("https://")
    ) {

        url = "https://" + url;

    }

    return url;
}


function formatTime(timestamp) {

    if (!timestamp) return "-";

    return new Date(timestamp).toLocaleString(
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


async function loadLinks() {

    try {

        const result =
            await apiRequest({
                action: "list"
            });


        if (!result.success) {

            throw new Error(
                result.message ||
                "Gagal mengambil data."
            );

        }


        links =
            result.data || [];


        render();

        updateLastUpdate();


    } catch (error) {

        console.error(
            "LOAD LINKS ERROR:",
            error
        );

        showMessage(
            "Gagal mengambil data dari server.",
            "error"
        );

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

    } catch {

        showMessage(
            "Format URL tidak valid.",
            "error"
        );

        return;
    }


    addButton.disabled = true;


    try {

        const result =
            await apiRequest({

                action: "add",

                url: url

            });


        if (!result.success) {

            showMessage(
                result.message ||
                "Gagal menambahkan link.",
                "error"
            );

            return;
        }


        urlInput.value = "";


        showMessage(
            "Link berhasil ditambahkan.",
            "success"
        );


        await loadLinks();


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

        addButton.disabled = false;

    }
}


async function checkUrl(id) {

    const link =
        links.find(
            item =>
                String(item.id) ===
                String(id)
        );


    if (!link) return;


    showMessage(
        "Fitur pengecekan Nawala belum diaktifkan.",
        "error"
    );
}


async function deleteLink(id) {

    if (
        !confirm(
            "Hapus link ini dari monitoring?"
        )
    ) {

        return;

    }


    try {

        const result =
            await apiRequest({

                action: "delete",

                id: id

            });


        if (!result.success) {

            showMessage(
                result.message ||
                "Gagal menghapus link.",
                "error"
            );

            return;
        }


        showMessage(
            "Link berhasil dihapus.",
            "success"
        );


        await loadLinks();


    } catch (error) {

        console.error(
            "DELETE LINK ERROR:",
            error
        );

        showMessage(
            "Gagal menghapus link.",
            "error"
        );

    }
}


function getStatusHTML(status) {

    if (status === "normal") {

        return `
            <span class="status status-normal">
                <span class="status-dot"></span>
                NORMAL
            </span>
        `;

    }


    if (status === "nawala") {

        return `
            <span class="status status-nawala">
                <span class="status-dot"></span>
                NAWALA
            </span>
        `;

    }


    if (status === "checking") {

        return `
            <span class="status status-unchecked">
                <span class="status-dot"></span>
                CHECKING...
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


    emptyState.style.display =
        filtered.length === 0
            ? "block"
            : "none";


    filtered.forEach(item => {

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
                        class="btn-action btn-check"
                        onclick="checkUrl('${item.id}')"
                    >
                        🔍 Cek
                    </button>

                    <button
                        class="btn-action btn-delete"
                        onclick="deleteLink('${item.id}')"
                    >
                        🗑 Hapus
                    </button>

                </div>

            </td>
        `;


        linkTable.appendChild(row);

    });


    updateStatistics();
}


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


function updateLastUpdate() {

    document.getElementById(
        "lastUpdate"
    ).textContent =
        new Date().toLocaleTimeString(
            "id-ID",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );
}


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

            message.textContent = "";

            message.className = "";

        },
        3000
    );
}


function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value;

    return div.innerHTML;
}


/* THEME */

function loadTheme() {

    const savedTheme =
        localStorage.getItem(
            "nawalaTheme"
        );


    if (savedTheme === "dark") {

        document.body.classList.add(
            "dark"
        );

        themeIcon.textContent = "☀";

    } else {

        document.body.classList.remove(
            "dark"
        );

        themeIcon.textContent = "☀";

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
        dark ? "dark" : "light"
    );


    themeIcon.textContent =
        dark ? "☀" : "☀";
}


themeToggle.addEventListener(
    "click",
    toggleTheme
);


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


loadTheme();

loadLinks();
