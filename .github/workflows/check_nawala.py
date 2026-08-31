import os
import re
import sys
import requests

GAS_URL = os.environ.get("GAS_URL", "").strip()

BLOCKLIST_BASE_URL = (
    "https://raw.githubusercontent.com/"
    "Skiddle-ID/blocklist/main/"
)

BLOCKLIST_FILES = [
    "domains_001.txt",
    "domains_002.txt",
    "domains_003.txt",
    "domains_004.txt",
    "domains_005.txt",
]


def extract_domain(value):
    value = str(value or "").strip().lower()

    value = re.sub(
        r"^https?://",
        "",
        value,
        flags=re.IGNORECASE
    )

    value = value.split("/")[0]
    value = value.split("?")[0]
    value = value.split("#")[0]

    value = re.sub(
        r"^www\.",
        "",
        value,
        flags=re.IGNORECASE
    )

    return value.strip().rstrip(".")


def get_monitored_domains():
    if not GAS_URL:
        raise RuntimeError(
            "Secret GAS_URL belum tersedia."
        )

    response = requests.get(
        GAS_URL,
        params={
            "action": "list"
        },
        timeout=30
    )

    response.raise_for_status()

    data = response.json()

    if not data.get("success"):
        raise RuntimeError(
            "GAS gagal mengembalikan daftar domain."
        )

    result = []

    for item in data.get("data", []):
        domain = extract_domain(
            item.get("url", "")
        )

        if domain:
            result.append({
                "id": item.get("id"),
                "url": item.get("url"),
                "domain": domain
            })

    return result


def build_lookup(domains):
    lookup = {}

    for item in domains:
        lookup[item["domain"]] = item

    return lookup


def domain_matches(
    blocklisted_domain,
    monitored_domain
):
    if blocklisted_domain == monitored_domain:
        return True

    if monitored_domain.endswith(
        "." + blocklisted_domain
    ):
        return True

    return False


def scan_blocklist(
    lookup
):
    found = set()

    for filename in BLOCKLIST_FILES:
        url = BLOCKLIST_BASE_URL + filename

        print(
            f"Membaca {filename}..."
        )

        response = requests.get(
            url,
            timeout=180,
            stream=True
        )

        response.raise_for_status()

        for raw_line in response.iter_lines(
            decode_unicode=True
        ):
            if not raw_line:
                continue

            line = raw_line.strip()

            if not line:
                continue

            if line.startswith("#"):
                continue

            candidate = extract_domain(
                line
            )

            if not candidate:
                continue

            if candidate in lookup:
                found.add(candidate)
                continue

            for monitored_domain in lookup:
                if domain_matches(
                    candidate,
                    monitored_domain
                ):
                    found.add(
                        monitored_domain
                    )

        print(
            f"{filename} selesai."
        )

    return found


def update_gas(
    item,
    status
):
    response = requests.get(
        GAS_URL,
        params={
            "action": "update",
            "id": item["id"],
            "status": status
        },
        timeout=30
    )

    response.raise_for_status()

    data = response.json()

    if not data.get("success"):
        raise RuntimeError(
            f"GAS gagal update {item['domain']}: "
            f"{data.get('message', 'unknown error')}"
        )


def main():
    domains = get_monitored_domains()

    if not domains:
        print(
            "Tidak ada domain yang sedang dimonitor."
        )
        return

    lookup = build_lookup(
        domains
    )

    print(
        f"Total domain yang dipantau: {len(domains)}"
    )

    found = scan_blocklist(
        lookup
    )

    normal = 0
    nawala = 0

    for item in domains:
        domain = item["domain"]

        if domain in found:
            status = "nawala"
            nawala += 1
        else:
            status = "normal"
            normal += 1

        update_gas(
            item,
            status
        )

        print(
            f"{domain} -> {status}"
        )

    print("")
    print(
        f"Total  : {len(domains)}"
    )
    print(
        f"Normal : {normal}"
    )
    print(
        f"Nawala : {nawala}"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(
            f"ERROR: {error}",
            file=sys.stderr
        )
        sys.exit(1)
