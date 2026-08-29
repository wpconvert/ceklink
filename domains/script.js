let domains = JSON.parse(
    localStorage.getItem("trustMonitorDomains")
) || [
    {
        id: 1,
        domain: "example.com",
        status: "safe",
        lastChecked: "2 menit lalu"
    },
    {
        id: 2,
        domain: "abc-example.com",
        status: "blocked",
        lastChecked: "5 menit lalu"
    },
    {
        id: 3,
        domain: "website-demo.net",
        status: "safe",
        lastChecked: "8 menit lalu"
    },
    {
        id: 4,
        domain: "test-domain.id",
        status: "checking",
        lastChecked: "Belum pernah"
    }
];

function saveDomains() {
    localStorage.setItem(
        "trustMonitorDomains",
        JSON.stringify(domains)
    );
}

function renderDomains() {
    const list = document.getElementById("domainList");
    const searchInput = document.getElementById("searchInput");
    const filterStatus = document.getElementById("filterStatus");

    const search = searchInput.value
        .trim()
        .toLowerCase();

    const filter = filterStatus.value;

    const filteredDomains = domains.filter((item) => {

        const matchesSearch =
            item.domain
                .toLowerCase()
                .includes(search);

        const matchesFilter =
            filter === "all" ||
            item.status === filter;

        return matchesSearch && matchesFilter;
    });

    if (filteredDomains.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    ◈
                </div>

                <strong>
                    Tidak ada domain
                </strong>

                <p>
                    Tambahkan domain untuk mulai monitoring.
                </p>
            </div>
        `;

        updateStats();
        return;
    }

    list.innerHTML = filteredDomains
        .map((item) => {

            let statusText = "Checking";
            let statusClass = "checking";

            if (item.status === "safe") {
                statusText = "Normal";
                statusClass = "safe";
            }

            if (item.status === "blocked") {
                statusText = "Blocked";
                statusClass = "blocked";
            }

            return `
                <div class="domain-row">

                    <div class="domain-name-wrapper">

                        <div class="domain-name">
                            ${escapeHtml(item.domain)}
                        </div>

                        <div class="domain-url">
                            https://${escapeHtml(item.domain)}
                        </div>

                    </div>

                    <div class="domain-status">

                        <span class="status-badge ${statusClass}">

                            <span class="status-indicator"></span>

                            ${statusText}

                        </span>

                    </div>

                    <div class="domain-time">
                        ${item.lastChecked}
                    </div>

                    <div class="domain-actions">

                        <button
                            class="action-button"
                            onclick="checkDomain(${item.id})"
                            title="Check domain"
                        >
                            ↻
                        </button>

                        <button
                            class="action-button delete"
                            onclick="removeDomain(${item.id})"
                            title="Delete domain"
                        >
                            ×
                        </button>

                    </div>

                </div>
            `;
        })
        .join("");

    updateStats();
}

function updateStats() {
    const total = domains.length;

    const safe = domains.filter(
        (item) => item.status === "safe"
    ).length;

    const checking = domains.filter(
        (item) => item.status === "checking"
    ).length;

    const blocked = domains.filter(
        (item) => item.status === "blocked"
    ).length;

    document.getElementById(
        "totalDomains"
    ).textContent = total;

    document.getElementById(
        "safeDomains"
    ).textContent = safe;

    document.getElementById(
        "checkingDomains"
    ).textContent = checking;

    document.getElementById(
        "blockedDomains"
    ).textContent = blocked;
}

function openModal() {
    const modal = document.getElementById(
        "modalOverlay"
    );

    const input = document.getElementById(
        "domainInput"
    );

    modal.classList.add("show");

    input.value = "";

    setTimeout(() => {
        input.focus();
    }, 100);
}

function closeModal(event) {
    if (
        event &&
        event.target !== document.getElementById(
            "modalOverlay"
        )
    ) {
        return;
    }

    document.getElementById(
        "modalOverlay"
    ).classList.remove("show");
}

function addDomain(event) {
    event.preventDefault();

    const input = document.getElementById(
        "domainInput"
    );

    let domain = input.value
        .trim()
        .toLowerCase();

    domain = domain
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/.*$/, "");

    if (!domain) {
        return;
    }

    const exists = domains.some(
        (item) => item.domain === domain
    );

    if (exists) {
        showToast(
            "Domain sudah ada",
            `${domain} sudah ada dalam monitoring.`
        );

        return;
    }

    const newDomain = {
        id: Date.now(),
        domain: domain,
        status: "checking",
        lastChecked: "Belum pernah"
    };

    domains.unshift(newDomain);

    saveDomains();

    renderDomains();

    closeModal();

    showToast(
        "Domain ditambahkan",
        `${domain} berhasil masuk monitoring.`
    );

    setTimeout(() => {
        checkDomain(newDomain.id);
    }, 800);
}

function removeDomain(id) {
    const domain = domains.find(
        (item) => item.id === id
    );

    if (!domain) {
        return;
    }

    const confirmed = confirm(
        `Hapus ${domain.domain} dari monitoring?`
    );

    if (!confirmed) {
        return;
    }

    domains = domains.filter(
        (item) => item.id !== id
    );

    saveDomains();

    renderDomains();

    showToast(
        "Domain dihapus",
        `${domain.domain} telah dihapus.`
    );
}

function checkDomain(id) {
    const domain = domains.find(
        (item) => item.id === id
    );

    if (!domain) {
        return;
    }

    domain.status = "checking";

    domain.lastChecked = "Checking...";

    renderDomains();

    setTimeout(() => {

        const randomResult =
            Math.random() > 0.25
                ? "safe"
                : "blocked";

        domain.status = randomResult;

        domain.lastChecked = "Baru saja";

        saveDomains();

        renderDomains();

        if (randomResult === "blocked") {

            showToast(
                "⚠️ Domain Blocked",
                `${domain.domain} terdeteksi terblokir.`
            );

        } else {

            showToast(
                "Domain Normal",
                `${domain.domain} tidak terdeteksi terblokir.`
            );
        }

    }, 1200);
}

function checkAll() {
    if (domains.length === 0) {

        showToast(
            "Tidak ada domain",
            "Tambahkan domain terlebih dahulu."
        );

        return;
    }

    domains.forEach((domain) => {

        domain.status = "checking";

        domain.lastChecked = "Checking...";

    });

    renderDomains();

    setTimeout(() => {

        domains.forEach((domain) => {

            domain.status =
                Math.random() > 0.25
                    ? "safe"
                    : "blocked";

            domain.lastChecked =
                "Baru saja";

        });

        saveDomains();

        renderDomains();

        showToast(
            "Check selesai",
            `${domains.length} domain berhasil diperiksa.`
        );

    }, 1500);
}

function showToast(title, message) {

    const toast = document.getElementById(
        "toast"
    );

    document.getElementById(
        "toastTitle"
    ).textContent = title;

    document.getElementById(
        "toastMessage"
    ).textContent = message;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 3500);
}

function escapeHtml(value) {
    const div = document.createElement("div");

    div.textContent = value;

    return div.innerHTML;
}

document.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Escape") {
            closeModal();
        }

    }
);

renderDomains();
