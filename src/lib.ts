import Dexie from "dexie";
import psl from "psl";
import { v4 as uuid } from "uuid";

// URI MANIPULATION

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

// DEBUGGING/LOGGING

export function verb_log(msg: string) {
    if (VERBOSE) console.log(msg);
}

export function verb_err(msg: string) {
    if (VERBOSE) console.error(msg);
}

// DATABASE

class SiphonDatabase extends Dexie {
    trackerRequests: Dexie.Table<ITrackerRequest>;
    domainSessions:  Dexie.Table<IDomainSession, string>;

    constructor() {
        super("SiphonDatabase");
        this.version(1).stores({
            // Include only indexed columns
            trackerRequests: ", hostname, sessionUUID", // No primary key
            domainSessions: "sessionUUID, domain, startTime, endTime" // sessionUUID as primary key
        });

        this.trackerRequests = this.table("trackerRequests");
        this.domainSessions = this.table("domainSessions");
    }

    async totalBytesSentToTracker(hostname: string): Promise<number> {
        return this.trackerBytesTotal("hostname", hostname);
    }

    /**
     * Gets a list of all the domain sessions between two dates, optionally filtered by domain
     */
    private async allSessionsBetween(startTime: number, endTime: number, domain?: string): Promise<IDomainSession[]> {
        return this.domainSessions
            .where("startTime")
            .between(startTime, endTime)
            .filter(domainSession => domain ? domainSession.domain === domain : true)
            .filter(domainSession => domainSession.endTime <= endTime && domainSession.endTime > startTime)
            .toArray();
    }

    async totalBytesSentDuringSession(sessionUUID: string): Promise<number> {
        return this.trackerBytesTotal("sessionUUID", sessionUUID);
    }

    /**
     * Provides reasonably general totalling of bytesExchanged
     * You can filter one field to one exact value (case sensitive)
     */
    private async trackerBytesTotal(searchField: string, searchTerm: string | number): Promise<number> {
        return this.trackerRequests
            .where(searchField)
            .equals(searchTerm)
            .toArray()
            .then(list => list.reduce((acc, trackerRequest) => acc + trackerRequest.bytesExchanged, 0));
    }

    async uniqueHostsConnectedToDuring(sessionUUID: string): Promise<Set<string>> {
        let requestHosts = await this.trackerRequests
            .where("sessionUUID")
            .equals(sessionUUID)
            .toArray();
        return new Set(requestHosts.map(trackerRequest => trackerRequest.hostname));
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

export class ActiveDomainSession implements IActiveDomainSession {
    domain: string;
    sessionUUID: string;
    startTime: number;
    
    constructor(domain: string) {
        this.domain = domain;
        this.sessionUUID = uuid();
        this.startTime = Date.now();
    }
}

export const FLAGGED_HOSTS = "siphonFlaggedHosts";
export const DARK_MODE = "siphonDarkMode";
export const DATABASE = new SiphonDatabase();

const VERBOSE = true;
