import { Chart } from "chart.js";
import { verb_log } from "../lib";

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

function createWebsiteRankChart(canvas: HTMLCanvasElement) {
    verb_log("Requested website rank chart");
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

if (params.has("website-rank")) {
    createWebsiteRankChart(graph);
} else {
    createTopTrackersChart(graph, params.get("top-trackers"));
}
