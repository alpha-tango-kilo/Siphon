import Dexie from "dexie";
import fileSize from "filesize";
import psl from "psl";
import { v5 as uuid } from "uuid";

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
    if (VERBOSE) console.log(`${new Date().toLocaleTimeString()}: ${msg}`);
}

export function verb_err(msg: string) {
    if (VERBOSE) console.error(`${new Date().toLocaleTimeString()}: ${msg}`);
}

// DATABASE

class SiphonDatabase extends Dexie {
    trackerRequests:       Dexie.Table<ITrackerRequest>;
    domainSessions:        Dexie.Table<IDomainSession, string>;
    domainTrackerTotals:   Dexie.Table<IDomainTrackerTotal, string>;
    domainTotals:          Dexie.Table<IDomainTotal, string>;
    // Referred to as volatile because it clears when the browser is opened
    trackerTotalsVolatile: Dexie.Table<ITrackerTotal, string>;

    constructor() {
        super("SiphonDatabase");
        this.version(1).stores({
            // Include only indexed columns
            trackerRequests: "++, hostname, sessionUUID", // Auto-incremented hidden primary key
            domainSessions: "sessionUUID, domain, startTime, endTime", // sessionUUID as primary key
            domainTrackerTotals: "[domain+trackerHostname], bytesExchanged", // compound primary key with domain & tracker hostname
            domainTotals: "domain, bytesExchanged", // domain as primary key
            trackerTotalsVolatile: "hostname, bytesExchanged", // hostname as primary key
        });

        this.trackerRequests = this.table("trackerRequests");
        this.domainSessions = this.table("domainSessions");
        this.domainTrackerTotals = this.table("domainTrackerTotals");
        this.domainTotals = this.table("domainTotals");
        this.trackerTotalsVolatile = this.table("trackerTotalsVolatile");
    }

    async clearTrackerTotals(): Promise<void> {
        return this.trackerTotalsVolatile.clear();
    }

    async totalBytesSentToTracker(hostname: string): Promise<number> {
        return this.trackerBytesTotal("hostname", hostname);
    }

    /**
     * Gets a list of all the domain sessions between two dates, optionally filtered by domain
     */
    async allSessionsBetween(startTime: number, endTime: number, domain?: string): Promise<IDomainSession[]> {
        return this.domainSessions
            .where("startTime")
            .between(startTime, endTime, true, true)
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
        let trackerRequests = await this.trackerRequestsDuringSession(sessionUUID);
        return new Set(trackerRequests.map(trackerRequest => trackerRequest.hostname));
    }

    async trackerRequestsDuringSession(sessionUUID: string): Promise<ITrackerRequest[]> {
        return this.trackerRequests
            .where("sessionUUID")
            .equals(sessionUUID)
            .toArray();
    }

    async allRequestsTo(domain: string, extraUUIDs?: string[]): Promise<ITrackerRequest[]> {
        let sessions = await this.domainSessions
            .where("domain")
            .equalsIgnoreCase(domain)
            .toArray();
        let uuids = sessions.map(session => session.sessionUUID);
        uuids = extraUUIDs ? uuids.concat(extraUUIDs) : uuids; // Add extra UUIDs if present
        let requestPromises = uuids.map(async uuid => {
            return this.trackerRequests
                .where("sessionUUID")
                .equals(uuid)
                .toArray();
        });
        let trackerRequests2D = await Promise.all(requestPromises);
        return trackerRequests2D.reduce((acc, ls) => acc.concat(ls), []);
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
    readonly domain: string;
    readonly sessionUUID: string;
    readonly startTime: number;
    
    constructor(domain: string) {
        this.domain = domain;
        this.startTime = Date.now();
        this.sessionUUID = uuid(this.domain + this.startTime, SIPHON_NAMESPACE);
    }
}

// MISC

export function fileSizeString(bytes: number, short?: boolean): string {
    return fileSize(bytes, { fullform: !short, round: 1 });
}

export interface IProxyState {
    readonly startupTime: number;
    readonly focussedSession: IActiveDomainSession;
    readonly currentSessions: Map<number, IActiveDomainSession>;
}

// CONSTANTS

export const FLAGGED_HOSTS = "siphonFlaggedHosts";
export const DARK_MODE = "siphonDarkMode";
export const DATABASE = new SiphonDatabase();
export const SIPHON_NAMESPACE = "12c1cbc1-42b0-44e3-828a-ddfd9f1077e4";
export const CONNECTION_NAME = "Siphon pop-up";

const VERBOSE = true;
