package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/miekg/dns"
)

type CheckResponse struct {
	Success bool          `json:"success"`
	Domain  string        `json:"domain,omitempty"`
	Status  string        `json:"status"`
	Blocked bool          `json:"blocked"`
	Servers []ServerCheck `json:"servers,omitempty"`
	Message string        `json:"message,omitempty"`
}

type ServerCheck struct {
	Address   string   `json:"address"`
	Keyword   string   `json:"keyword"`
	Success   bool     `json:"success"`
	Protocol  string   `json:"protocol,omitempty"`
	RCode     string   `json:"rcode,omitempty"`
	LatencyMS int64    `json:"latency_ms,omitempty"`
	Blocked   bool     `json:"blocked"`
	Detection string   `json:"detection,omitempty"`
	Answers   []string `json:"answers,omitempty"`
	Authority []string `json:"authority,omitempty"`
	Extra     []string `json:"extra,omitempty"`
	Error     string   `json:"error,omitempty"`
}

type HealthResponse struct {
	Success bool   `json:"success"`
	Status  string `json:"status"`
	Service string `json:"service"`
	Time    string `json:"time"`
}

type DNSServer struct {
	Address string
	Keyword string
}

var dnsServers = []DNSServer{
	{
		Address: "180.131.144.144",
		Keyword: "internetpositif",
	},
	{
		Address: "180.131.145.145",
		Keyword: "internetpositif",
	},
	{
		Address: "103.155.26.28",
		Keyword: "trustpositif",
	},
}

var domainRegex = regexp.MustCompile(
	`^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$`,
)

func main() {
	http.HandleFunc("/", handleRoot)
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/check", handleCheck)

	port := "8080"

	log.Println("Nawala Checker Server berjalan di port", port)

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func handleRoot(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"service": "Nawala Checker Server",
		"endpoints": []string{
			"/health",
			"/check?domain=example.com",
		},
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, HealthResponse{
		Success: true,
		Status:  "online",
		Service: "Nawala Checker Server",
		Time:    time.Now().UTC().Format(time.RFC3339),
	})
}

func handleCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, CheckResponse{
			Success: false,
			Status:  "error",
			Message: "Method harus GET.",
		})
		return
	}

	domain := normalizeDomain(r.URL.Query().Get("domain"))

	if domain == "" {
		writeJSON(w, http.StatusBadRequest, CheckResponse{
			Success: false,
			Status:  "error",
			Message: "Domain tidak valid.",
		})
		return
	}

	result := checkDomain(domain)

	statusCode := http.StatusOK

	if result.Status == "error" {
		statusCode = http.StatusBadGateway
	}

	writeJSON(w, statusCode, result)
}

func normalizeDomain(input string) string {
	value := strings.TrimSpace(strings.ToLower(input))

	if value == "" {
		return ""
	}

	if strings.HasPrefix(value, "http://") ||
		strings.HasPrefix(value, "https://") {

		parsed, err := url.Parse(value)

		if err != nil {
			return ""
		}

		value = parsed.Hostname()

	} else {
		value = strings.Split(value, "/")[0]
		value = strings.Split(value, "?")[0]
		value = strings.Split(value, "#")[0]
	}

	value = strings.TrimSuffix(value, ".")
	value = strings.TrimPrefix(value, "www.")

	if value == "" || len(value) > 253 {
		return ""
	}

	if !domainRegex.MatchString(value) {
		return ""
	}

	return value
}

func checkDomain(domain string) CheckResponse {
	results := make([]ServerCheck, 0, len(dnsServers))
	successfulQueries := 0
	blocked := false

	for _, server := range dnsServers {
		result := inspectDNSServer(domain, server)
		results = append(results, result)

		if result.Success {
			successfulQueries++
		}

		if result.Blocked {
			blocked = true
		}
	}

	if blocked {
		return CheckResponse{
			Success: true,
			Domain:  domain,
			Status:  "nawala",
			Blocked: true,
			Servers: results,
		}
	}

	if successfulQueries == 0 {
		return CheckResponse{
			Success: false,
			Domain:  domain,
			Status:  "unknown",
			Blocked: false,
			Servers: results,
			Message: "Tidak ada DNS resolver yang berhasil memberikan respons.",
		}
	}

	return CheckResponse{
		Success: true,
		Domain:  domain,
		Status:  "normal",
		Blocked: false,
		Servers: results,
	}
}

func inspectDNSServer(domain string, server DNSServer) ServerCheck {
	result := ServerCheck{
		Address: server.Address,
		Keyword: server.Keyword,
		Blocked: false,
	}

	protocols := []string{"udp", "tcp"}
	var lastError error

	for _, protocol := range protocols {
		start := time.Now()

		message := new(dns.Msg)
		message.SetQuestion(dns.Fqdn(domain), dns.TypeA)
		message.RecursionDesired = true

		client := &dns.Client{
			Net:     protocol,
			Timeout: 5 * time.Second,
		}

		response, _, err := client.Exchange(
			message,
			server.Address+":53",
		)

		latency := time.Since(start).Milliseconds()

		if err != nil {
			lastError = err
			continue
		}

		if response == nil {
			lastError = fmt.Errorf("DNS response kosong")
			continue
		}

		result.Success = true
		result.Protocol = protocol
		result.LatencyMS = latency
		result.RCode = dns.RcodeToString[response.Rcode]
		result.Answers = rrStrings(response.Answer)
		result.Authority = rrStrings(response.Ns)
		result.Extra = rrStrings(response.Extra)

		blocked, detection := detectBlock(response, server.Keyword)

		result.Blocked = blocked
		result.Detection = detection

		return result
	}

	if lastError != nil {
		result.Error = lastError.Error()
	} else {
		result.Error = "DNS query gagal."
	}

	return result
}

func detectBlock(response *dns.Msg, keyword string) (bool, string) {
	keyword = strings.ToLower(keyword)

	records := make([]dns.RR, 0,
		len(response.Answer)+len(response.Ns)+len(response.Extra),
	)

	records = append(records, response.Answer...)
	records = append(records, response.Ns...)
	records = append(records, response.Extra...)

	for _, record := range records {
		text := strings.ToLower(record.String())

		if keyword != "" && strings.Contains(text, keyword) {
			return true, "keyword:" + keyword
		}

		if strings.Contains(text, "trustpositif.komdigi.go.id") {
			return true, "trustpositif.komdigi.go.id"
		}

		if strings.Contains(text, "trustpositif.kominfo.go.id") {
			return true, "trustpositif.kominfo.go.id"
		}

		if strings.Contains(text, "internetpositif.id") {
			return true, "internetpositif.id"
		}

		if strings.Contains(text, "internetsehatku.com") {
			return true, "internetsehatku.com"
		}
	}

	return false, ""
}

func rrStrings(records []dns.RR) []string {
	if len(records) == 0 {
		return []string{}
	}

	result := make([]string, 0, len(records))

	for _, record := range records {
		result = append(result, record.String())
	}

	return result
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.WriteHeader(status)

	encoder := json.NewEncoder(w)
	encoder.SetEscapeHTML(false)

	if err := encoder.Encode(data); err != nil {
		log.Println("JSON encode error:", err)
	}
}
