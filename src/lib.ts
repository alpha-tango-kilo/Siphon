import Dexie from "dexie";
import psl from "psl";

// https://www.sistrix.com/ask-sistrix/technical-seo/site-structure/what-is-the-difference-between-a-url-domain-subdomain-hostname-etc
export function getHostname(url: string): string | null {
    let parts = url.split("/");

    if (parts.length < 3) {
        // We're on a special page, like a tab page, or a settings page
        return null;
    } else {
        // [2] should be the bit after the protocol
        // Now we just check if we have a proper website (i.e. domain.tld)

        let hostname = parts[2];
        
        if (hostname.split(".").length < 2) {
            return null;
        } else {
            return hostname;
        }
    }
}

export function getDomain(url: string): string | null {
    let host = getHostname(url);
    if (host === null) {
        return null;
    } else {
        return psl.get(host);
    }
}

export function verb_log(msg: string) {
    if (VERBOSE) console.log(msg);
}

export function verb_err(msg: string) {
    if (VERBOSE) console.error(msg);
}

class SiphonDatabase extends Dexie {
    trackerRequests: Dexie.Table<ITrackerRequest>;
    domainSessions:  Dexie.Table<IDomainSession,  string>;

    constructor() {
        super("SiphonDatabase");
        this.version(1).stores({
            trackerRequests: ", hostname, sessionUUID, bytesExchanged", // No primary key
            domainSessions: "sessionUUID, domain, bytesExchanged, startTime, endTime" // sessionUUID as primary key
        });

        this.trackerRequests = this.table("trackerRequests");
        this.domainSessions = this.table("domainSessions");
    }
}

interface ITrackerRequest {
    readonly sessionUUID: string;
    readonly hostname: string;
    readonly bytesExchanged: number;
}

export interface IActiveDomainSession {
    readonly domain: string;
    readonly sessionUUID: string;
    readonly startTime: number;
}

interface IDomainSession extends IActiveDomainSession {
    readonly endTime: number;
}

export const FLAGGED_HOSTS = "siphonFlaggedHosts";
export const DATABASE = new SiphonDatabase();

const VERBOSE = true;
