import { Chart } from "chart.js";
import { DATABASE, fileSizeString, getDomain, verb_err, verb_log } from "../lib";

let currentChart: Chart<any>;
const canvas = document.getElementById("chart")! as HTMLCanvasElement;
const dropdown = document.getElementById("graph-dropdown")! as HTMLSelectElement;
const params = new URLSearchParams(new URL(document.URL).search);
const colourPalette = [
    'rgba(255, 99, 132, 1)',
    'rgba(54, 162, 235, 1)',
    'rgba(255, 206, 86, 1)',
    'rgba(75, 192, 192, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(255, 159, 64, 1)'
];

const defaultOptions = "<p>No options to display for current graph!</p>";
const topTrackersOptions = `
<div>
    <p class="pb-2">Domain to view graph for: </p>
    <div class="flex space-x-2">
        <form>
            <input type="text" id="form-graph-domain" name="form-graph-domain" class="rounded-xl flex-grow">
        </form>

        <button type="button" id="graph-domain-button" class="border-2 rounded-xl p-1.5 border-purple-700 bg-purple-200 font-semibold">Go!</button>
    </div>
</div>`;

enum GraphType {
    TopTrackers = "top-trackers",
    WebsiteRank = "website-rank",
}

// Makes it look like these are methods on the enum
namespace GraphType {
    export function fromURLSearchParams(params: URLSearchParams): GraphType | undefined {
        for (let name of Object.values(GraphType)) {
            if (params.has(name.toString())) {
                return name as GraphType;
            }
        }
        return undefined;
    }

    export function fromString(str: string): GraphType | undefined {
        // Convert dashed-case to UpperCamel so we can cast
        let camelCase = str.split("-")
            .map((str, _, __) => `${str[0].toUpperCase()}${str.substring(1)}`)
            .join("");
        return (<any>GraphType)[camelCase];
    }
}

function createChart(type: GraphType | undefined, canvas: HTMLCanvasElement, destroy: boolean = false) {
    if (destroy && type !== undefined) currentChart.destroy();

    switch (type) {
        case GraphType.WebsiteRank:
            createWebsiteRankChart(canvas);
            break;
        case GraphType.TopTrackers:
            createTopTrackersChart(canvas, params.get(type));
            break;
        default:
            verb_err(`Unknown graph type requested`);
            return;
    }

    setDropDown(type);
    updateOptionsPane(type);
}

async function createWebsiteRankChart(canvas: HTMLCanvasElement) {
    verb_log("Requested website rank chart");
    let labels: string[] = [];
    let data: number[] = [];
    await DATABASE.topDomains(5)
        .then(dts => dts.forEach(dt => {
            labels.push(dt.domain);
            data.push(dt.bytesExchanged);
        }));
    
    currentChart = new Chart(canvas, {
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
    
    currentChart = new Chart(canvas, {
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

function updateOptionsPane(graph: GraphType) {
    const graphOptionsElement = document.getElementById("graph-options")!;
    graphOptionsElement.innerHTML = "";
    switch (graph) {
        case GraphType.TopTrackers:
            graphOptionsElement.insertAdjacentHTML("beforeend", topTrackersOptions);
            let button = document.getElementById("graph-domain-button")!;
            let input = document.getElementById("form-graph-domain")! as HTMLInputElement;
            button.addEventListener("click", _ => domainEntryBox(input.value));
            break;
        default:
            graphOptionsElement.insertAdjacentHTML("afterbegin", defaultOptions);
    } // doesn't need a default case as the error will have already been thrown
}

// TODO: present things more nicely than using an alert
// TODO: update the URL
async function domainEntryBox(input: string) {
    return DATABASE.domainTotals.get(input.trim())
        .then(maybeDT => {
            if (maybeDT === undefined) {
                return Promise.reject("No tracking requests have been made while you've been on this domain (if you've even been on it)");
            } else {
                return maybeDT.domain;
            }
        }).then(domain => {
            currentChart.destroy();
            createTopTrackersChart(canvas, domain);
        }).catch(err => alert(err));
}

// TODO: update the URL
function onDropDownChange() {
    createChart(GraphType.fromString(dropdown.value), canvas, true);
}

function setDropDown(type: GraphType) {
    dropdown.value = type;
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
createChart(GraphType.fromURLSearchParams(params), canvas);
dropdown.addEventListener("change", onDropDownChange);
