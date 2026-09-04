import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests


GAS_URL = os.environ.get("GAS_URL", "").strip()
GAS_API_KEY = os.environ.get("GAS_API_KEY", "").strip()

BLOCKLIST_BASE_URL = (
    "https://raw.githubusercontent.com/Skiddle-ID/blocklist/main/"
)

BLOCKLIST_FILES = [
    "domains_001.txt",
    "domains_002.txt",
    "domains_003.txt",
    "domains_004.txt",
    "domains_005.txt",
]

BLOCKLIST_WORKERS = 5
UPDATE_WORKERS = 8

REQUEST_TIMEOUT = (
    10,
    30,
)


def gas_params(action, **kwargs):
    params = {
        "action": action,
        "api_key": GAS_API_KEY,
    }

    params.update(kwargs)

    return params


def get_session():
    session = requests.Session()

    session.headers.update({
        "User-Agent": "Nawala-Monitor-Checker/1.0"
    })

    return session


def extract_domain(value):
    value = str(
        value or ""
    ).strip().lower()

    if not value:
        return ""

    value = value.replace(
        "https://",
        "",
        1
    )

    value = value.replace(
        "http://",
        "",
        1
    )

    value = value.split(
        "/",
        1
    )[0]

    value = value.split(
        "?",
        1
    )[0]

    value = value.split(
        "#",
        1
    )[0]

    value = value.strip()

    if value.startswith("www."):
        value = value[4:]

    return value


def download_blocklist(filename):
    url = (
        BLOCKLIST_BASE_URL +
        filename
    )

    session = get_session()

    response = session.get(
        url,
        timeout=REQUEST_TIMEOUT
    )

    response.raise_for_status()

    blocked = set()

    for line in response.text.splitlines():
        domain = line.strip().lower()

        if not domain:
            continue

        if domain.startswith("#"):
            continue

        domain = extract_domain(
            domain
        )

        if domain:
            blocked.add(
                domain
            )

    return blocked


def load_blocklist():
    all_blocked = set()

    print(
        "Mengambil blocklist..."
    )

    with ThreadPoolExecutor(
        max_workers=BLOCKLIST_WORKERS
    ) as executor:

        futures = {
            executor.submit(
                download_blocklist,
                filename
            ): filename
            for filename in BLOCKLIST_FILES
        }

        for future in as_completed(
            futures
        ):

            filename = futures[
                future
            ]

            try:

                blocked = future.result()

                all_blocked.update(
                    blocked
                )

                print(
                    f"{filename}: "
                    f"{len(blocked):,} domain"
                )

            except Exception as error:

                print(
                    f"Gagal mengambil "
                    f"{filename}: {error}"
                )

                raise

    print(
        f"Total blocklist: "
        f"{len(all_blocked):,} domain"
    )

    return all_blocked


def get_links():
    session = get_session()

    response = session.get(
        GAS_URL,
        params=gas_params(
            "list"
        ),
        timeout=REQUEST_TIMEOUT
    )

    response.raise_for_status()

    data = response.json()

    if not data.get(
        "success"
    ):
        raise RuntimeError(
            data.get(
                "message",
                "Gagal mengambil daftar link."
            )
        )

    links = data.get(
        "data",
        []
    )

    return links


def check_domain(
    item,
    blocked_domains
):
    domain = extract_domain(
        item.get(
            "domain"
        ) or item.get(
            "url"
        )
    )

    if not domain:
        return {
            "id": item.get("id"),
            "domain": "",
            "status": "normal",
            "error": "Domain tidak valid."
        }

    status = (
        "nawala"
        if domain in blocked_domains
        else "normal"
    )

    return {
        "id": item.get(
            "id"
        ),
        "domain": domain,
        "status": status,
        "error": ""
    }


def update_status(result):
    item_id = result.get(
        "id"
    )

    status = result.get(
        "status"
    )

    if not item_id:
        return {
            **result,
            "success": False,
            "message": "ID tidak ditemukan."
        }

    session = get_session()

    response = session.get(
        GAS_URL,
        params=gas_params(
            "update",
            id=item_id,
            status=status
        ),
        timeout=REQUEST_TIMEOUT
    )

    response.raise_for_status()

    data = response.json()

    if not data.get(
        "success"
    ):
        raise RuntimeError(
            data.get(
                "message",
                "Update status gagal."
            )
        )

    return {
        **result,
        "success": True,
        "message": data.get(
            "message",
            ""
        )
    }


def main():
    if not GAS_URL:
        raise RuntimeError(
            "GAS_URL belum diset."
        )

    if not GAS_API_KEY:
        raise RuntimeError(
            "GAS_API_KEY belum diset."
        )

    print(
        "Nawala checker mulai..."
    )

    blocked_domains = load_blocklist()

    links = get_links()

    print(
        f"Total link yang dicek: "
        f"{len(links)}"
    )

    if not links:
        print(
            "Tidak ada link untuk dicek."
        )
        return

    results = []

    print(
        "Memeriksa domain..."
    )

    with ThreadPoolExecutor(
        max_workers=UPDATE_WORKERS
    ) as executor:

        check_futures = [
            executor.submit(
                check_domain,
                item,
                blocked_domains
            )
            for item in links
        ]

        for future in as_completed(
            check_futures
        ):

            result = future.result()

            results.append(
                result
            )

    normal_count = sum(
        1
        for item in results
        if item["status"] == "normal"
    )

    nawala_count = sum(
        1
        for item in results
        if item["status"] == "nawala"
    )

    print(
        f"Normal: {normal_count}"
    )

    print(
        f"Nawala: {nawala_count}"
    )

    print(
        "Memperbarui Google Sheets..."
    )

    success_count = 0
    failed_count = 0

    with ThreadPoolExecutor(
        max_workers=UPDATE_WORKERS
    ) as executor:

        update_futures = {
            executor.submit(
                update_status,
                result
            ): result
            for result in results
            if result.get("id")
        }

        for future in as_completed(
            update_futures
        ):

            result = update_futures[
                future
            ]

            try:

                future.result()

                success_count += 1

                print(
                    f"[OK] "
                    f"{result['domain']} "
                    f"-> "
                    f"{result['status'].upper()}"
                )

            except Exception as error:

                failed_count += 1

                print(
                    f"[ERROR] "
                    f"{result['domain']}: "
                    f"{error}"
                )

    print("")
    print(
        "Pengecekan selesai."
    )

    print(
        f"Update berhasil: "
        f"{success_count}"
    )

    print(
        f"Update gagal: "
        f"{failed_count}"
    )


if __name__ == "__main__":
    main()
