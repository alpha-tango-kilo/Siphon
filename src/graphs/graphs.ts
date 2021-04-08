import { Chart } from "chart.js";
import { DATABASE, verb_log } from "../lib";

const graph = document.getElementById("chart")! as HTMLCanvasElement;
const params = new URLSearchParams(new URL(document.URL).search);
const colourPalette = [
    'rgba(255, 99, 132, 1)',
    'rgba(54, 162, 235, 1)',
    'rgba(255, 206, 86, 1)',
    'rgba(75, 192, 192, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(255, 159, 64, 1)'
];

async function createWebsiteRankChart(canvas: HTMLCanvasElement) {
    verb_log("Requested website rank chart");
    let labels: string[] = [];
    let data: number[] = [];
    await DATABASE.topThreeDomains()
        .then(dts => dts.forEach(dt => {
            console.log(dt);
            labels.push(dt.domain);
            data.push(dt.bytesExchanged);
        }));
    
    new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "I don't know how to get rid of this", // TODO
                data,
                backgroundColor: colourPalette,
            }],
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Top websites you've visited by tracking data exchanged",
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Website domain",
                        //align: "start", // TODO: (bug) this shouldn't make VSC angry
                        font: {
                            weight: "600",
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: "Bytes sent",
                        font: {
                            weight: "600",
                        }
                    }
                }
            }
        }
    });
}

/**
 * Creates a pie chart showing all the top trackers for a particular domain
 * If domain is not supplied, show top trackers while browser has been open
 */
function createTopTrackersChart(canvas: HTMLCanvasElement, domain: string | null) {
    if (domain) {
        verb_log(`Requested top trackers chart for ${domain}`);

    } else {
        verb_log("Requested top trackers chart while browser has been open");

    }
}

// GRAPH DEFAULTS
// Title
// TODO: (bug) Box gets bigger but font actually doesn't
Chart.defaults.plugins.title.font.size = 48;
Chart.defaults.plugins.title.font.weight = "800";
Chart.defaults.plugins.title.align = "center";

// TODO: defaults for axes labels

// General
// Don't maintain a set aspect ratio
Chart.defaults.aspectRatio = 0; 
Chart.defaults.font = {
    // Copy font family string from Tailwind
    family: "system-ui,\
		-apple-system,\
		'Segoe UI',\
		Roboto,\
		Helvetica,\
		Arial,\
		sans-serif,\
		'Apple Color Emoji',\
		'Segoe UI Emoji'",
    size: 18,
    style: "normal",
    lineHeight: 1.2,
    weight: "400",
};

// MAKE GRAPHS

if (params.has("website-rank")) {
    createWebsiteRankChart(graph);
} else {
    createTopTrackersChart(graph, params.get("top-trackers"));
}
