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
	flagHost     = flag.String("host", "127.0.0.1", "listen addr")
	flagHttpPort = flag.Int("http-port", 7000, "http port")
	flagUdpPort  = flag.Int("udp-port", 5556, "udp port")
	flagTest     = flag.Bool("test", false, "send test events")
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
	http.Error(w, "ok", 200)
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
	platforms := [...]string{
		"php",
		"python",
		"javascript",
		"java",
		"ruby",
		"other",
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	for {
		b := []byte(fmt.Sprintf(
			`[%d,%d,%d,"%s"]`,
			rng.Intn(180)-90,
			rng.Intn(360)-180,
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
	go func() {
		b := make([]byte, 256)
		for {
			n, _, err := conn.ReadFromUDP(b)
			if err != nil {
				log.Fatal(err)
				return
			} else {
				d := make([]byte, n)
				copy(d, b)
				es.SendEventMessage(d)
			}
		}
	}()

	log.Fatal(http.ListenAndServe(fmt.Sprintf("%s:%d", *flagHost, *flagHttpPort), mux))
}
