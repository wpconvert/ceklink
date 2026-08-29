let domains = [
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
        status: "unknown",
        lastChecked: "-"
    }
];

let activities = [
    {
        type: "blocked",
        title: "abc-example.com",
        message: "Status terdeteksi sebagai terblokir.",
        time: "5 menit lalu"
    },
    {
        type: "safe",
        title: "example.com",
        message: "Pengecekan selesai. Domain normal.",
        time: "2 menit lalu"
    },
    {
        type: "info",
        title: "Monitoring Service",
        message: "Pengecekan otomatis berhasil dijalankan.",
        time: "10 menit lalu"
    }
];

function renderDomains() {
    const list = document.getElementById("domainList");
    const search = document.getElementById("searchInput").value.toLowerCase();
    const filter = document.getElementById("filterStatus").value;

    const filtered = domains.filter((item) => {
        const matchesSearch = item.domain.includes(search);
        const matchesFilter =
            filter === "all" || item.status === filter;

        return matchesSearch && matchesFilter;
    });

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⌕</div>
                <strong>Domain tidak ditemukan</strong>
                <p>Coba gunakan kata pencarian yang berbeda.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map((item) => {
        let statusText = "Belum Dicek";
        let statusClass = "unknown";
        let statusIcon = "●";

        if (item.status === "safe") {
            statusText = "Normal";
            statusClass = "safe";
            statusIcon = "✓";
        }

        if (item.status === "blocked") {
            statusText = "Blocked";
            statusClass = "blocked";
            statusIcon = "!";
        }

        return `
            <div class="domain-row">
                <div>
                    <div class="domain-name">${item.domain}</div>
                    <div class="domain-url">https://${item.domain}</div>
                </div>

                <div>
                    <div class="status-badge ${statusClass}">
                        <span>${statusIcon}</span>
                        ${statusText}
                    </div>
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
                        class="action-button"
                        onclick="removeDomain(${item.id})"
                        title="Remove domain"
                    >
                        ×
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function updateStats() {
    const total = domains.length;
    const safe = domains.filter(
        (item) => item.status === "safe"
    ).length;

    const blocked = domains.filter(
        (item) => item.status === "blocked"
    ).length;

    document.getElementById("totalDomains").textContent = total;
    document.getElementById("safeDomains").textContent = safe;
    document.getElementById("blockedDomains").textContent = blocked;
}

function renderActivities() {
    const list = document.getElementById("activityList");

    if (activities.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">◷</div>
                <strong>Belum ada aktivitas</strong>
                <p>Aktivitas monitoring akan muncul di sini.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = activities.slice(0, 6).map((item) => {
        let icon = "i";

        if (item.type === "safe") {
            icon = "✓";
        }

        if (item.type === "blocked") {
            icon = "!";
        }

        return `
            <div class="activity-item">
                <div class="activity-icon ${item.type}">
                    ${icon}
                </div>

                <div class="activity-content">
                    <strong>${item.title}</strong>
                    <p>${item.message}</p>
                    <span class="activity-time">${item.time}</span>
                </div>
            </div>
        `;
    }).join("");
}

function openModal() {
    const modal = document.getElementById("modalOverlay");
    const input = document.getElementById("domainInput");

    modal.classList.add("show");

    setTimeout(() => {
        input.focus();
    }, 100);
}

function closeModal(event) {
    if (
        event &&
        event.target !== document.getElementById("modalOverlay")
    ) {
        return;
    }

    document.getElementById("modalOverlay")
        .classList.remove("show");
}

function addDomain(event) {
    event.preventDefault();

    const input = document.getElementById("domainInput");
    let domain = input.value.trim().toLowerCase();

    domain = domain
        .replace(/^https?:\/\//, "")
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
            `${domain} sudah masuk monitoring.`
        );
        return;
    }

    domains.unshift({
        id: Date.now(),
        domain: domain,
        status: "unknown",
        lastChecked: "-"
    });

    activities.unshift({
        type: "info",
        title: "Domain ditambahkan",
        message: `${domain} masuk ke daftar monitoring.`,
        time: "Baru saja"
    });

    input.value = "";

    closeModal();

    renderAll();

    showToast(
        "Domain berhasil ditambahkan",
        `${domain} sekarang sedang dimonitor.`
    );
}

function removeDomain(id) {
    const domain = domains.find(
        (item) => item.id === id
    );

    if (!domain) {
        return;
    }

    domains = domains.filter(
        (item) => item.id !== id
    );

    activities.unshift({
        type: "info",
        title: "Domain dihapus",
        message: `${domain.domain} dihapus dari monitoring.`,
        time: "Baru saja"
    });

    renderAll();

    showToast(
        "Domain dihapus",
        `${domain.domain} tidak lagi dimonitor.`
    );
}

function checkDomain(id) {
    const domain = domains.find(
        (item) => item.id === id
    );

    if (!domain) {
        return;
    }

    const previousStatus = domain.status;

    domain.status =
        Math.random() > 0.25
            ? "safe"
            : "blocked";

    domain.lastChecked = "Baru saja";

    let message =
        `${domain.domain} selesai diperiksa.`;

    if (
        previousStatus !== domain.status &&
        previousStatus !== "unknown"
    ) {
        message +=
            ` Status berubah menjadi ${domain.status}.`;
    }

    activities.unshift({
        type: domain.status === "blocked"
            ? "blocked"
            : "safe",
        title: domain.domain,
        message: message,
        time: "Baru saja"
    });

    document.getElementById("lastCheck").textContent =
        "Just now";

    renderAll();

    if (domain.status === "blocked") {
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
        domain.status =
            Math.random() > 0.25
                ? "safe"
                : "blocked";

        domain.lastChecked = "Baru saja";
    });

    document.getElementById("lastCheck").textContent =
        "Just now";

    activities.unshift({
        type: "info",
        title: "Full monitoring check",
        message: `${domains.length} domain berhasil diperiksa.`,
        time: "Baru saja"
    });

    renderAll();

    showToast(
        "Check selesai",
        `${domains.length} domain telah diperiksa.`
    );
}

function searchDomains() {
    renderDomains();
}

function filterDomains() {
    renderDomains();
}

function showToast(title, message) {
    const toast = document.getElementById("toast");

    document.getElementById("toastTitle").textContent =
        title;

    document.getElementById("toastMessage").textContent =
        message;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}

function renderAll() {
    renderDomains();
    renderActivities();
    updateStats();
}

renderAll();
