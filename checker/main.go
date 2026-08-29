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
	Success bool   `json:"success"`
	Domain  string `json:"domain"`
	Status  string `json:"status"`
	Blocked bool   `json:"blocked"`
	Server  string `json:"server,omitempty"`
	Message string `json:"message,omitempty"`
}

type HealthResponse struct {
	Success bool   `json:"success"`
	Status  string `json:"status"`
	Service string   `json:"service"`
	Time    string   `json:"time"`
}

type DNSServer struct {
	Address string
	Keyword string
}

var dnsServers = []DNSServer{

	{
		Address: "103.155.26.28",
		Keyword: "trustpositif",
	},

	{
		Address: "103.155.26.29",
		Keyword: "komdigi",
	},

	{
		Address: "180.131.144.144",
		Keyword: "internetpositif",
	},

	{
		Address: "180.131.145.145",
		Keyword: "internetpositif",
	},
}

var domainRegex =
	regexp.MustCompile(
		`^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$`,
	)

func main() {

	http.HandleFunc(
		"/",
		handleRoot,
	)

	http.HandleFunc(
		"/health",
		handleHealth,
	)

	http.HandleFunc(
		"/check",
		handleCheck,
	)

	port := "8080"

	log.Println(
		"Nawala Checker Server berjalan di port",
		port,
	)

	err := http.ListenAndServe(
		":" + port,
		nil,
	)

	if err != nil {

		log.Fatal(err)

	}
}

func handleRoot(
	w http.ResponseWriter,
	r *http.Request,
) {

	writeJSON(
		w,
		http.StatusOK,
		map[string]interface{}{

			"success": true,

			"service":
				"Nawala Checker Server",

			"endpoints": []string{

				"/health",

				"/check?domain=example.com",
			},
		},
	)
}

func handleHealth(
	w http.ResponseWriter,
	r *http.Request,
) {

	response := HealthResponse{

		Success: true,

		Status: "online",

		Service:
			"Nawala Checker Server",

		Time:
			time.Now().UTC().Format(
				time.RFC3339,
			),
	}

	writeJSON(
		w,
		http.StatusOK,
		response,
	)
}

func handleCheck(
	w http.ResponseWriter,
	r *http.Request,
) {

	if r.Method != http.MethodGet {

		writeJSON(
			w,
			http.StatusMethodNotAllowed,
			CheckResponse{

				Success: false,

				Status: "error",

				Message:
					"Method harus GET.",
			},
		)

		return
	}

	rawDomain :=
		r.URL.Query().Get(
			"domain",
		)

	domain :=
		normalizeDomain(
			rawDomain,
		)

	if domain == "" {

		writeJSON(
			w,
			http.StatusBadRequest,
			CheckResponse{

				Success: false,

				Status: "error",

				Message:
					"Domain tidak valid.",
			},
		)

		return
	}

	result :=
		checkDomain(
			domain,
		)

	writeJSON(
		w,
		http.StatusOK,
		result,
	)
}

func normalizeDomain(
	input string,
) string {

	value :=
		strings.TrimSpace(
			strings.ToLower(
				input,
			),
		)

	if value == "" {
		return ""
	}

	// Kalau user memasukkan URL lengkap.
	if strings.HasPrefix(
		value,
		"http://",
	) ||
		strings.HasPrefix(
			value,
			"https://",
		) {

		parsed, err :=
			url.Parse(
				value,
			)

		if err != nil {
			return ""
		}

		value =
			parsed.Hostname()

	} else {

		// Hapus path/query/fragment.
		value =
			strings.Split(
				value,
				"/",
			)[0]

		value =
			strings.Split(
				value,
				"?",
			)[0]

		value =
			strings.Split(
				value,
				"#",
			)[0]
	}

	value =
		strings.TrimSuffix(
			value,
			".",
		)

	value =
		strings.TrimPrefix(
			value,
			"www.",
		)

	if value == "" {
		return ""
	}

	if len(value) > 253 {
		return ""
	}

	if !domainRegex.MatchString(
		value,
	) {

		return ""
	}

	return value
}

func checkDomain(
	domain string,
) CheckResponse {

	for _, server :=
		range dnsServers {

		blocked, err :=
			queryDNS(
				domain,
				server,
			)

		if err != nil {

			log.Printf(
				"DNS %s gagal untuk %s: %v",
				server.Address,
				domain,
				err,
			)

			continue
		}

		if blocked {

			return CheckResponse{

				Success: true,

				Domain: domain,

				Status: "nawala",

				Blocked: true,

				Server:
					server.Address,
			}
		}

	}

	// Semua resolver berhasil di-query
	// tetapi tidak menemukan indikator block.
	return CheckResponse{

		Success: true,

		Domain: domain,

		Status: "normal",

		Blocked: false,
	}
}

func queryDNS(
	domain string,
	server DNSServer,
) (bool, error) {

	client := &dns.Client{

		Timeout:
			5 * time.Second,
	}

	message := new(
		dns.Msg,
	)

	message.SetQuestion(
		dns.Fqdn(domain),
		dns.TypeA,
	)

	message.RecursionDesired = true

	serverAddress :=
		server.Address +
			":53"

	response, _, err :=
		client.Exchange(
			message,
			serverAddress,
		)

	if err != nil {

		return false, err

	}

	if response == nil {

		return false,
			fmt.Errorf(
				"DNS response kosong",
			)
	}

	/*
		Periksa seluruh bagian DNS response.

	Ini penting karena indikator Komdigi
	dapat muncul pada OPT / Extra section.
	*/

	records :=
		[]dns.RR{}

	records =
		append(
			records,
			response.Answer...,
		)

	records =
		append(
			records,
			response.Ns...,
		)

	records =
		append(
			records,
			response.Extra...,
		)

	keyword :=
		strings.ToLower(
			server.Keyword,
		)

	for _, record :=
		range records {

		recordText :=
			strings.ToLower(
				record.String(),
			)

		if strings.Contains(
			recordText,
			keyword,
		) {

			return true, nil
		}

	}

	/*
		Deteksi khusus EDE 15.

	Komdigi menggunakan EDE 15
	(Blocked) pada response DNS.
	*/

	for _, record :=
		range response.Extra {

		recordText :=
			strings.ToLower(
				record.String(),
			)

		if strings.Contains(
			recordText,
			"ede: 15",
		) &&
			(
				strings.Contains(
					recordText,
					"trustpositif",
				) ||
					strings.Contains(
						recordText,
						"komdigi",
					)
			) {

			return true, nil
		}

	}

	return false, nil
}

func writeJSON(
	w http.ResponseWriter,
	status int,
	data interface{},
) {

	w.Header().Set(
		"Content-Type",
		"application/json; charset=utf-8",
	)

	w.Header().Set(
		"Access-Control-Allow-Origin",
		"*",
	)

	w.Header().Set(
		"Access-Control-Allow-Methods",
		"GET, OPTIONS",
	)

	w.Header().Set(
		"Access-Control-Allow-Headers",
		"Content-Type",
	)

	w.WriteHeader(status)

	encoder :=
		json.NewEncoder(w)

	encoder.SetEscapeHTML(
		false,
	)

	if err :=
		encoder.Encode(data); err != nil {

		log.Println(
			"JSON encode error:",
			err,
		)
	}
}
