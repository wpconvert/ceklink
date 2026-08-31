const API_URL =
    "https://script.google.com/macros/s/AKfycbwuoM9qglC30KUtqTozVwI3CRVN74HeAWn0VJbJ10YEzd9Wny7wH0XuD4NkwLnDQcitbQ/exec";

let links = [];

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
                document.createElement(
                    "script"
                );


            const query =
                new URLSearchParams({
                    ...params,
                    callback:
                        callbackName
                }).toString();


            let finished = false;


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


            function finishSuccess(
                data
            ) {

                if (finished) {
                    return;
                }

                finished = true;

                cleanup();

                resolve(data);

            }


            function finishError(
                error
            ) {

                if (finished) {
                    return;
                }

                finished = true;

                cleanup();

                reject(error);

            }


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


            window[callbackName] =
                function(data) {

                    clearTimeout(
                        timeout
                    );

                    finishSuccess(
                        data
                    );

                };


            script.onerror =
                function() {

                    clearTimeout(
                        timeout
                    );

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

    url =
        String(
            url || ""
        ).trim();


    if (!url) {
        return "";
    }


    if (
        !url.startsWith(
            "http://"
        ) &&
        !url.startsWith(
            "https://"
        )
    ) {

        url =
            "https://" +
            url;

    }


    return url;

}


function formatTime(
    timestamp
) {

    if (!timestamp) {
        return "-";
    }


    const date =
        new Date(timestamp);


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


function asyncDelay(
    milliseconds
) {

    return new Promise(
        function(resolve) {

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}


async function loadLinks() {

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


async function checkUrl(id) {

    const link =
        links.find(
            function(item) {

                return String(
                    item.id
                ) ===
                String(id);

            }
        );


    if (!link) {
        return;
    }


    const button =
        document.querySelector(
            '[data-check-id="' +
            String(id) +
            '"]'
        );


    if (button) {

        button.disabled =
            true;

        button.dataset.originalText =
            button.textContent;

        button.textContent =
            "⏳ Mengecek...";

    }


    try {

        const result =
            await apiRequest({

                action:
                    "check",

                url:
                    link.url

            });


        if (
            !result ||
            !result.success
        ) {

            showMessage(
                result &&
                result.message
                    ? result.message
                    : "Status belum dapat diperiksa.",
                "error"
            );

            return;

        }


        const index =
            links.findIndex(
                function(item) {

                    return String(
                        item.id
                    ) ===
                    String(id);

                }
            );


        if (
            index !== -1
        ) {

            links[index].status =
                result.status;

            links[index].lastChecked =
                result.lastChecked ||
                link.lastChecked ||
                null;

        }


        render();

        showMessage(
            "Status terbaru berhasil diambil.",
            "success"
        );


    } catch (error) {

        console.error(
            "CHECK ERROR:",
            error
        );


        showMessage(
            "Gagal mengecek status.",
            "error"
        );


    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                button.dataset.originalText ||
                "🔍 Cek";

            delete button.dataset.originalText;

        }

    }

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


function getStatusHTML(
    status
) {

    if (
        status === "normal"
    ) {

        return `
            <span class="status status-normal">
                <span class="status-dot"></span>
                NORMAL
            </span>
        `;

    }


    if (
        status === "nawala"
    ) {

        return `
            <span class="status status-nawala">
                <span class="status-dot"></span>
                NAWALA
            </span>
        `;

    }


    if (
        status === "checking"
    ) {

        return `
            <span class="status status-unchecked">
                <span class="status-dot"></span>
                CHECKING...
            </span>
        `;

    }


    if (
        status === "unknown"
    ) {

        return `
            <span class="status status-unchecked">
                <span class="status-dot"></span>
                UNKNOWN
            </span>
        `;

    }


    if (
        status === "error"
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
        filter !== "all"
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
        filtered.length === 0
            ? "block"
            : "none";


    filtered.forEach(
        function(item) {

            const row =
                document.createElement(
                    "tr"
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
                        item.status
                    )}
                </td>

                <td>
                    <span class="time-cell">
                        ${formatTime(
                            item.lastChecked
                        )}
                    </span>
                </td>

                <td>
                    <div class="action-group">

                        <button
                            class="btn-action btn-check"
                            data-check-id="${escapeHtml(
                                String(item.id)
                            )}"
                            onclick="checkUrl('${escapeJs(
                                item.id
                            )}')"
                        >
                            🔍 Cek
                        </button>

                        <button
                            class="btn-action btn-delete"
                            onclick="deleteLink('${escapeJs(
                                item.id
                            )}')"
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


    if (totalElement) {

        totalElement.textContent =
            total;

    }


    if (normalElement) {

        normalElement.textContent =
            normal;

    }


    if (blockedElement) {

        blockedElement.textContent =
            nawala;

    }


    if (uncheckedElement) {

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

    message.textContent =
        text;


    message.className =
        type === "success"
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


function escapeJs(
    value
) {

    return String(
        value || ""
    )
    .replace(
        /\\/g,
        "\\\\"
    )
    .replace(
        /'/g,
        "\\'"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /\r/g,
        ""
    )
    .replace(
        /\n/g,
        "\\n"
    );

}


function loadTheme() {

    const savedTheme =
        localStorage.getItem(
            "nawalaTheme"
        );


    if (
        savedTheme === "dark"
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
        dark
            ? "☀"
            : "☀";

}


async function refreshData() {

    await loadLinks();

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


searchInput.addEventListener(
    "input",
    render
);


filterStatus.addEventListener(
    "change",
    render
);


loadTheme();

refreshData();
