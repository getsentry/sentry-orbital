package main

import (
	"flag"
	"fmt"
	"html/template"
	"log"
	"math/rand"
	"net"
	"net/http"
	"time"

	"github.com/mattrobenolt/go-eventsource"
)

var (
	flagHost       = flag.String("host", "127.0.0.1", "listen addr")
	flagHttpPort   = flag.Int("http-port", 7000, "http port")
	flagUdpPort    = flag.Int("udp-port", 5556, "udp port")
	flagTest       = flag.Bool("test", false, "send test events")
	flagSampleRate = flag.Float64("sample-rate", 0.05, "fraction of UDP events to forward to SSE clients (0.0–1.0)")
)

func handleIndex(w http.ResponseWriter, r *http.Request) {
	tmpl := template.Must(template.ParseFiles("./templates/index.html"))
	tmpl.Execute(w, struct {
		Year int
	}{
		Year: time.Now().Year(),
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}

func runTest(port int) {
	conn, err := net.ListenPacket("udp", "127.0.0.1:0")
	if err != nil {
		log.Fatal(err)
	}
	dst := &net.UDPAddr{
		IP:   net.ParseIP("127.0.0.1"),
		Port: port,
	}
	// Platform weights reflect real-world Sentry SDK distribution.
	// TODO: fetch dynamically from https://release-registry.services.sentry.io/sdks
	platforms := [...]string{
		"javascript",
		"javascript",
		"javascript",
		"node",
		"node",
		"node",
		"python",
		"python",
		"java",
		"java",
		"cocoa",
		"php",
		"csharp",
		"ruby",
		"go",
		"native",
		"elixir",
	}

	// Real city coordinates — events only appear where people actually are
	cities := [][2]float64{
		{40.7, -74.0},  // New York
		{37.8, -122.4}, // San Francisco
		{51.5, -0.1},   // London
		{48.9, 2.3},    // Paris
		{52.5, 13.4},   // Berlin
		{35.7, 139.7},  // Tokyo
		{39.9, 116.4},  // Beijing
		{31.2, 121.5},  // Shanghai
		{-33.9, 151.2}, // Sydney
		{-23.5, -46.6}, // São Paulo
		{19.1, 72.9},   // Mumbai
		{12.9, 77.6},   // Bangalore
		{30.0, 31.2},   // Cairo
		{6.5, 3.4},     // Lagos
		{19.4, -99.1},  // Mexico City
		{-34.6, -58.4}, // Buenos Aires
		{55.8, 37.6},   // Moscow
		{41.0, 29.0},   // Istanbul
		{37.6, 127.0},  // Seoul
		{1.3, 103.8},   // Singapore
		{25.2, 55.3},   // Dubai
		{43.7, -79.4},  // Toronto
		{41.9, -87.6},  // Chicago
		{34.1, -118.2}, // Los Angeles
		{47.6, -122.3}, // Seattle
		{25.8, -80.2},  // Miami
		{52.4, 4.9},    // Amsterdam
		{59.3, 18.1},   // Stockholm
		{40.4, -3.7},   // Madrid
		{41.9, 12.5},   // Rome
		{22.3, 114.2},  // Hong Kong
		{-6.2, 106.8},  // Jakarta
		{13.8, 100.5},  // Bangkok
		{-1.3, 36.8},   // Nairobi
		{-33.9, 18.4},  // Cape Town
		{4.7, -74.1},   // Bogotá
		{-12.0, -77.0}, // Lima
		{-33.5, -70.6}, // Santiago
		{45.5, -73.6},  // Montreal
		{50.1, 8.7},    // Frankfurt
		{53.3, -6.3},   // Dublin
		{59.9, 10.8},   // Oslo
		{60.2, 25.0},   // Helsinki
		{47.4, 8.5},    // Zurich
		{50.9, 4.4},    // Brussels
		{38.7, -9.1},   // Lisbon
		{37.9, 23.7},   // Athens
		{44.8, 20.5},   // Belgrade
		{50.1, 14.4},   // Prague
		{47.5, 19.1},   // Budapest
		{52.2, 21.0},   // Warsaw
		{59.4, 24.7},   // Tallinn
		{23.1, 113.3},  // Guangzhou
		{28.6, 77.2},   // New Delhi
		{24.9, 67.0},   // Karachi
		{33.7, 73.1},   // Islamabad
		{23.8, 90.4},   // Dhaka
		{6.9, 79.9},    // Colombo
		{3.1, 101.7},   // Kuala Lumpur
		{14.6, 121.0},  // Manila
		{10.8, 106.7},  // Ho Chi Minh City
		{16.8, 96.2},   // Yangon
		{27.7, 85.3},   // Kathmandu
		{-4.3, 15.3},   // Kinshasa
		{5.6, -0.2},    // Accra
		{12.4, -1.5},   // Ouagadougou
		{9.1, 7.4},     // Abuja
		{-26.2, 28.0},  // Johannesburg
		{-17.8, 31.0},  // Harare
		{-8.8, 13.2},   // Luanda
		{33.9, -6.9},   // Rabat
		{36.8, 10.2},   // Tunis
		{32.9, 13.2},   // Tripoli
		{15.6, 32.5},   // Khartoum
		{2.0, 45.3},    // Mogadishu
		{-18.9, 47.5},  // Antananarivo
		{-25.9, 32.6},  // Maputo
		{-15.4, 28.3},  // Lusaka
		{-13.0, -38.5}, // Salvador
		{-3.1, -60.0},  // Manaus
		{-30.0, -51.2}, // Porto Alegre
		{10.5, -66.9},  // Caracas
		{-0.2, -78.5},  // Quito
		{-16.5, -68.2}, // La Paz
		{-11.2, 17.9},  // Luanda surrounds
		{32.1, 34.8},   // Tel Aviv
		{33.9, 35.5},   // Beirut
		{33.3, 44.4},   // Baghdad
		{35.7, 51.4},   // Tehran
		{41.3, 69.3},   // Tashkent
		{43.3, 76.9},   // Almaty
		{51.2, 71.5},   // Astana
		{47.9, 106.9},  // Ulaanbaatar
		{-36.9, 174.8}, // Auckland
		{-27.5, 153.0}, // Brisbane
		{-31.9, 115.9}, // Perth
		{-37.8, 145.0}, // Melbourne
		{21.3, -157.8}, // Honolulu
		{61.2, -149.9}, // Anchorage
		{64.8, -147.7}, // Fairbanks
		{45.4, -75.7},  // Ottawa
		{49.3, -123.1}, // Vancouver
		{51.0, -114.1}, // Calgary
		{53.5, -113.5}, // Edmonton
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	for {
		city := cities[rng.Intn(len(cities))]
		// Add small jitter so repeated city hits don't stack exactly
		lat := city[0] + (rng.Float64()-0.5)*2.0
		lng := city[1] + (rng.Float64()-0.5)*2.0
		b := []byte(fmt.Sprintf(
			`[%.4f,%.4f,%d,"%s"]`,
			lat,
			lng,
			int(time.Now().UnixNano()/1000000),
			platforms[rng.Intn(len(platforms))],
		))
		time.Sleep(time.Millisecond / 2)
		conn.WriteTo(b, dst)
	}
}

func init() {
	flag.Parse()
}

func main() {
	if *flagTest {
		runTest(*flagUdpPort)
		return
	}
	es := eventsource.New(&eventsource.Settings{
		Timeout:        1 * time.Second,
		IdleTimeout:    1 * time.Minute,
		CloseOnTimeout: true,
		Gzip:           false,
	}, nil)
	defer es.Close()

	mux := http.NewServeMux()

	mux.HandleFunc("/", handleIndex)
	mux.HandleFunc("/healthz", handleHealth)
	mux.Handle("/static/", http.FileServer(http.Dir(".")))
	mux.Handle("/stream", es)

	conn, err := net.ListenUDP("udp", &net.UDPAddr{
		IP:   net.ParseIP(*flagHost),
		Port: *flagUdpPort,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	go func() {
		b := make([]byte, 256)
		for {
			n, _, err := conn.ReadFromUDP(b)
			if err != nil {
				log.Fatal(err)
				return
			}
			if rng.Float64() >= *flagSampleRate {
				continue
			}
			d := make([]byte, n)
			copy(d, b)
			es.SendEventMessage(d)
		}
	}()

	log.Fatal(http.ListenAndServe(fmt.Sprintf("%s:%d", *flagHost, *flagHttpPort), mux))
}
