import { Chart } from "chart.js";
import { DATABASE, fileSizeString, verb_log } from "../lib";

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
    await DATABASE.topDomains(5)
        .then(dts => dts.forEach(dt => {
            labels.push(dt.domain);
            data.push(dt.bytesExchanged);
        }));
    
    new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data,
            }],
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Top websites you've visited by tracking data exchanged",
                },
                legend: {
                    display: false,
                },
                tooltip: {
                    callbacks: {
                        title: _ => [],
                        label: tooltip => {
                            return tooltip.label;
                        },
                        footer: tooltips => {
                            // Gets the number of bytes and formats it nicely
                            return tooltips.map(tip => fileSizeString(tip.dataset.data[tip.dataIndex] as number));
                        },
                    },
                }
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
async function createTopTrackersChart(canvas: HTMLCanvasElement, domain: string | null) {
    let chartTitle: string;
    if (domain) {
        chartTitle = `Top trackers for ${domain}`;
        verb_log(`Requested top trackers chart for ${domain}`);
    } else {
        chartTitle = "Top trackers while browser has been open";
        verb_log("Requested top trackers chart while browser has been open");
    }

    let labels: string[] = [];
    let data: number[] = [];
    let promise = domain ? DATABASE.topTrackersOn(domain, 5) : DATABASE.topTrackers(5);
    await promise.then(tts => tts.forEach(tt => {
        labels.push(tt.hostname);
        data.push(tt.bytesExchanged);
    }));
    
    new Chart(canvas, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{ data }],
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: chartTitle,
                },
                tooltip: {
                    callbacks: {
                        label: tooltip => {
                            return tooltip.label;
                        },
                        footer: tooltips => {
                            // Gets the number of bytes and formats it nicely
                            return tooltips.map(tip => fileSizeString(tip.dataset.data[tip.dataIndex] as number));
                        },
                    },
                }
            }
        }
    });
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
Chart.defaults.maintainAspectRatio = false; 
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
Chart.defaults.datasets.bar.backgroundColor = colourPalette;
Chart.defaults.datasets.doughnut.backgroundColor = colourPalette;
Chart.defaults.plugins.tooltip.footerAlign = "center";

// MAKE GRAPHS

if (params.has("website-rank")) {
    createWebsiteRankChart(graph);
} else {
    createTopTrackersChart(graph, params.get("top-trackers"));
}
