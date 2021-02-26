const VERBOSE = true;

export function getHostname(url: string): string | undefined {
    let parts = url.split("/");

    if (parts.length < 3) {
        // We're on a special page, like a tab page, or a settings page
        return undefined;
    } else {
        // [2] should be the bit after the protocol
        // Now we just check if we have a proper website (i.e. domain.tld)

        let domain = parts[2];

        if (domain.split(".").length < 2) {
            return undefined;
        } else {
            return domain;
        }
    }
}

export function verb_log(msg: string) {
    if (VERBOSE) console.log(msg);
}

export function verb_err(msg: string) {
    if (VERBOSE) console.error(msg);
}

export class TrackerRequest {
    readonly sessionID: string; // UUID of tab session
    readonly bytesExchanged: number;

    constructor(sessionID: string, bytesExchanged: number) {
        this.sessionID = sessionID;
        this.bytesExchanged = bytesExchanged;
    }
}

export class HostSession extends TrackerRequest {
    readonly startTime: Date;
    readonly endTime: Date;

    constructor(sessionID: string, bytesExchanged: number, startTime: Date, endTime: Date) {
        super(sessionID, bytesExchanged);
        this.startTime = startTime;
        this.endTime = endTime;
    }
}
